import { Service, signal } from '@angular/core';
import * as ndt7 from '@m-lab/ndt7';
import { environment } from '../../../environments/environment';
import type {
  ServerInfo,
  SpeedDirectionResult,
  SpeedTestResult,
  TestPhase,
  TcpInfo,
} from '../models/app.models';
import {
  mbps,
  microsecondsToMilliseconds,
  parseObservedAddress,
} from '../../shared/utils/network.utils';

@Service()
export class SpeedTestService {
  readonly phase = signal<TestPhase>('idle');
  readonly download = signal<SpeedDirectionResult>({});
  readonly upload = signal<SpeedDirectionResult>({});
  readonly server = signal<ServerInfo | undefined>(undefined);
  readonly error = signal<string | undefined>(undefined);
  private cancelled = false;
  async run(): Promise<SpeedTestResult | undefined> {
    if (
      this.phase() !== 'idle' &&
      this.phase() !== 'complete' &&
      this.phase() !== 'failed' &&
      this.phase() !== 'cancelled'
    )
      return undefined;
    this.cancelled = false;
    this.error.set(undefined);
    this.download.set({});
    this.upload.set({});
    this.server.set(undefined);
    this.phase.set('finding-server');
    const callbacks = {
      error: (error: string | Error) => {
        if (!this.cancelled) this.error.set(String(error));
      },
      serverDiscovery: () => this.phase.set('finding-server'),
      serverChosen: (data: unknown) => this.server.set(serverFrom(data)),
      downloadStart: () => this.phase.set('download'),
      uploadStart: () => this.phase.set('upload'),
      downloadMeasurement: (event: { Source: 'client' | 'server'; Data: unknown }) =>
        this.update('download', event.Data),
      uploadMeasurement: (event: { Source: 'client' | 'server'; Data: unknown }) =>
        this.update('upload', event.Data),
      downloadComplete: (event: {
        LastClientMeasurement?: unknown;
        LastServerMeasurement?: unknown;
      }) => this.update('download', event.LastServerMeasurement ?? event.LastClientMeasurement),
      uploadComplete: (event: {
        LastClientMeasurement?: unknown;
        LastServerMeasurement?: unknown;
      }) => this.update('upload', event.LastServerMeasurement ?? event.LastClientMeasurement),
    };
    try {
      const code = await ndt7.test(
        {
          metadata: {
            client_name: environment.mlab.clientName,
            client_version: environment.mlab.clientVersion,
          },
          userAcceptedDataPolicy: true,
          downloadworkerfile: new URL('ndt7-download-worker.js', document.baseURI).toString(),
          uploadworkerfile: new URL('ndt7-upload-worker.js', document.baseURI).toString(),
        },
        callbacks,
      );
      if (this.cancelled) {
        this.phase.set('cancelled');
        return undefined;
      }
      if (code !== 0 || this.error())
        throw new Error(this.error() ?? 'NDT7 measurement did not complete.');
      this.phase.set('finalizing');
      const result: SpeedTestResult = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        download: this.download(),
        upload: this.upload(),
        server: this.server(),
      };
      this.phase.set('complete');
      return result;
    } catch (error: unknown) {
      if (this.cancelled) {
        this.phase.set('cancelled');
        return undefined;
      }
      this.error.set(error instanceof Error ? error.message : 'Speed test failed.');
      this.phase.set('failed');
      return undefined;
    }
  }
  cancel(): void {
    this.cancelled = true;
    this.phase.set('cancelled');
  }
  reset(): void {
    this.phase.set('idle');
    this.error.set(undefined);
  }
  private update(direction: 'download' | 'upload', data: unknown): void {
    if (this.cancelled) return;
    const parsed = directionResult(data);
    if (direction === 'download') this.download.update((current) => ({ ...current, ...parsed }));
    else this.upload.update((current) => ({ ...current, ...parsed }));
  }
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function directionResult(value: unknown): SpeedDirectionResult {
  const raw = record(value);
  const app = record(raw['AppInfo'] ?? raw['app_info']);
  const elapsed = numeric(app['ElapsedTime'] ?? app['elapsed_time']);
  const bytes = numeric(app['NumBytes'] ?? app['num_bytes']);
  const tcp = tcpInfo(record(raw['TCPInfo'] ?? raw['tcp_info']));
  return {
    bytes,
    durationMs: microsecondsToMilliseconds(elapsed),
    liveMbps: mbps(bytes, elapsed),
    mbps: mbps(bytes, elapsed),
    tcp,
    loadedLatencyMs: tcp?.rttMs,
  };
}
function tcpInfo(value: Record<string, unknown>): TcpInfo | undefined {
  if (!Object.keys(value).length) return undefined;
  const us = (name: string) => microsecondsToMilliseconds(numeric(value[name]));
  return {
    minRttMs: us('MinRTT'),
    rttMs: us('RTT'),
    rttVarMs: us('RTTVar'),
    bytesSent: numeric(value['BytesSent']),
    bytesReceived: numeric(value['BytesReceived']),
    bytesAcked: numeric(value['BytesAcked']),
    bytesRetrans: numeric(value['BytesRetrans']),
  };
}
function serverFrom(value: unknown): ServerInfo {
  const raw = record(value);
  const urls = record(raw['urls']);
  const endpoint = Object.values(urls).find((url): url is string => typeof url === 'string');
  const connection = record(raw['ConnectionInfo'] ?? raw['connection_info']);
  const client =
    typeof connection['Client'] === 'string'
      ? parseObservedAddress(connection['Client'])
      : undefined;
  return {
    hostname: typeof raw['machine'] === 'string' ? raw['machine'] : undefined,
    city: typeof raw['city'] === 'string' ? raw['city'] : undefined,
    country: typeof raw['country'] === 'string' ? raw['country'] : undefined,
    endpoint: endpoint ? new URL(endpoint).host : undefined,
    observedClientAddress: client,
  };
}
