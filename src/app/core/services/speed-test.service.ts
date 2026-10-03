import { Service, computed, inject, signal } from '@angular/core';
import * as ndt7 from '@m-lab/ndt7';
import { environment } from '../../../environments/environment';
import type {
  LatencyResult,
  ServerInfo,
  SpeedDirectionResult,
  SpeedTestResult,
  TestPhase,
  TcpInfo,
} from '../models/app.models';
import { microsecondsToMilliseconds, parseObservedAddress } from '../../shared/utils/network.utils';
import { LatencyService } from './latency.service';

type MeasurementSource = 'client' | 'server';
const runningPhases: TestPhase[] = [
  'preparing',
  'measuring-latency',
  'finding-server',
  'download',
  'upload',
  'finalizing',
];
export function canStartMeasurement(phase: TestPhase): boolean {
  return !runningPhases.includes(phase);
}

@Service()
export class SpeedTestService {
  private readonly latencyService = inject(LatencyService);
  private readonly phaseState = signal<TestPhase>('idle');
  private readonly downloadState = signal<SpeedDirectionResult>({});
  private readonly uploadState = signal<SpeedDirectionResult>({});
  private readonly serverState = signal<ServerInfo | undefined>(undefined);
  private readonly latencyState = signal<LatencyResult | undefined>(undefined);
  readonly phase = this.phaseState.asReadonly();
  readonly download = this.downloadState.asReadonly();
  readonly upload = this.uploadState.asReadonly();
  readonly server = this.serverState.asReadonly();
  readonly latency = this.latencyState.asReadonly();
  readonly error = signal<string | undefined>(undefined);
  readonly latencyError = signal<string | undefined>(undefined);
  readonly isRunning = computed(() => runningPhases.includes(this.phaseState()));
  readonly phaseProgress = computed(
    () =>
      ({
        preparing: 8,
        'measuring-latency': 20,
        'finding-server': 35,
        download: 52,
        upload: 78,
        finalizing: 92,
        complete: 100,
        failed: 100,
        cancelled: 100,
        idle: 0,
      })[this.phaseState()],
  );

  async run(): Promise<SpeedTestResult | undefined> {
    if (!canStartMeasurement(this.phaseState())) return undefined;
    this.resetMeasurement();
    this.phaseState.set('preparing');
    // Yield once so the UI can render the preparing state before asynchronous work begins.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    this.phaseState.set('measuring-latency');
    const latency = await this.latencyService.measure();
    this.latencyState.set(latency.value);
    this.latencyError.set(latency.message);
    // Latency is optional. Its failure must never prevent the bandwidth measurement.
    this.phaseState.set('finding-server');
    try {
      const code = await ndt7.test(this.config(), this.callbacks());
      if (code !== 0 || this.error())
        throw new Error(this.error() ?? 'M-Lab measurement did not complete.');
      this.phaseState.set('finalizing');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const result: SpeedTestResult = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        download: this.download(),
        upload: this.upload(),
        latency: this.latency(),
        server: this.server(),
      };
      this.phaseState.set('complete');
      return result;
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'M-Lab speed test failed.');
      this.phaseState.set('failed');
      return undefined;
    }
  }

  private resetMeasurement(): void {
    this.error.set(undefined);
    this.latencyError.set(undefined);
    this.downloadState.set({});
    this.uploadState.set({});
    this.serverState.set(undefined);
    this.latencyState.set(undefined);
  }
  private config() {
    return {
      metadata: {
        client_name: environment.mlab.clientName,
        client_version: environment.mlab.clientVersion,
      },
      userAcceptedDataPolicy: true,
      downloadworkerfile: new URL('ndt7-download-worker.js', document.baseURI).toString(),
      uploadworkerfile: new URL('ndt7-upload-worker.js', document.baseURI).toString(),
    };
  }
  private callbacks() {
    return {
      error: (error: string | Error) => this.error.set(this.describeError(error)),
      serverDiscovery: () => this.phaseState.set('finding-server'),
      serverChosen: (data: unknown) =>
        this.serverState.update((current) => mergeServer(current, serverFromLocate(data))),
      downloadStart: () => this.phaseState.set('download'),
      uploadStart: () => this.phaseState.set('upload'),
      downloadMeasurement: (event: { Source: MeasurementSource; Data: unknown }) =>
        this.applyMeasurement('download', event.Source, event.Data),
      uploadMeasurement: (event: { Source: MeasurementSource; Data: unknown }) =>
        this.applyMeasurement('upload', event.Source, event.Data),
      downloadComplete: (event: {
        LastClientMeasurement?: unknown;
        LastServerMeasurement?: unknown;
      }) => this.completeMeasurement('download', event),
      uploadComplete: (event: {
        LastClientMeasurement?: unknown;
        LastServerMeasurement?: unknown;
      }) => this.completeMeasurement('upload', event),
    };
  }
  private applyMeasurement(
    direction: 'download' | 'upload',
    source: MeasurementSource,
    data: unknown,
  ): void {
    const partial = measurementFrom(data, source);
    if (direction === 'download')
      this.downloadState.update((current) => mergeDirection(current, partial));
    else this.uploadState.update((current) => mergeDirection(current, partial));
    const server = serverFromMeasurement(data);
    if (server) this.serverState.update((current) => mergeServer(current, server));
  }
  private completeMeasurement(
    direction: 'download' | 'upload',
    event: { LastClientMeasurement?: unknown; LastServerMeasurement?: unknown },
  ): void {
    if (event.LastClientMeasurement)
      this.applyMeasurement(direction, 'client', event.LastClientMeasurement);
    if (event.LastServerMeasurement)
      this.applyMeasurement(direction, 'server', event.LastServerMeasurement);
  }
  private describeError(error: string | Error): string {
    const detail = String(error);
    if (
      /no server|capacity|results|undefined/i.test(detail) &&
      this.phaseState() === 'finding-server'
    )
      return 'No M-Lab measurement server is currently available. Please try again shortly.';
    if (
      /worker|download error|upload error/i.test(detail) &&
      this.phaseState() === 'finding-server'
    )
      return `M-Lab worker loading or connection failed: ${detail}`;
    if (this.phaseState() === 'finding-server') return `M-Lab server discovery failed: ${detail}`;
    if (this.phaseState() === 'download') return `M-Lab download failed: ${detail}`;
    if (this.phaseState() === 'upload') return `M-Lab upload failed: ${detail}`;
    return `M-Lab worker or connection failed: ${detail}`;
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

export function measurementFrom(value: unknown, source: MeasurementSource): SpeedDirectionResult {
  const raw = record(value);
  const app = source === 'server' ? record(raw['AppInfo'] ?? raw['app_info']) : raw;
  const bytes = numeric(app['NumBytes'] ?? app['num_bytes']);
  const elapsedRaw = numeric(app['ElapsedTime'] ?? app['elapsed_time']);
  const durationMs =
    source === 'client'
      ? elapsedRaw === undefined
        ? undefined
        : elapsedRaw * 1000
      : microsecondsToMilliseconds(elapsedRaw);
  const reportedMbps = numeric(app['MeanClientMbps'] ?? app['mean_client_mbps']);
  const calculatedMbps =
    bytes !== undefined && durationMs && durationMs > 0
      ? (bytes * 8) / (durationMs * 1000)
      : undefined;
  const tcp = tcpInfo(record(raw['TCPInfo'] ?? raw['tcp_info']));
  // The NDT7 workers provide application throughput in client callbacks. Server callbacks add
  // authoritative TCP data but must not overwrite client throughput with missing/different fields.
  const throughput = source === 'client' ? (reportedMbps ?? calculatedMbps) : undefined;
  return defined({
    bytes,
    durationMs,
    liveMbps: throughput,
    mbps: throughput,
    tcp,
    loadedLatencyMs: tcp?.rttMs,
  }) as SpeedDirectionResult;
}
export function mergeDirection(
  current: SpeedDirectionResult,
  incoming: SpeedDirectionResult,
): SpeedDirectionResult {
  const mergedTcp = incoming.tcp ? { ...current.tcp, ...defined(incoming.tcp) } : current.tcp;
  return { ...current, ...defined(incoming), ...(mergedTcp ? { tcp: mergedTcp } : {}) };
}
function tcpInfo(value: Record<string, unknown>): TcpInfo | undefined {
  if (!Object.keys(value).length) return undefined;
  const us = (name: string) => microsecondsToMilliseconds(numeric(value[name]));
  return defined({
    minRttMs: us('MinRTT'),
    rttMs: us('RTT'),
    rttVarMs: us('RTTVar'),
    bytesSent: numeric(value['BytesSent']),
    bytesReceived: numeric(value['BytesReceived']),
    bytesAcked: numeric(value['BytesAcked']),
    bytesRetrans: numeric(value['BytesRetrans']),
  }) as TcpInfo;
}
function serverFromLocate(value: unknown): ServerInfo {
  const raw = record(value);
  const location = record(raw['location']);
  const urls = record(raw['urls']);
  const endpoint = Object.values(urls).find((url): url is string => typeof url === 'string');
  return defined({
    hostname: text(raw['machine']) ?? text(raw['hostname']),
    city: text(location['city']) ?? text(raw['city']),
    country: text(location['country']) ?? text(raw['country']),
    endpoint: endpoint ? new URL(endpoint).host : undefined,
  }) as ServerInfo;
}
function serverFromMeasurement(value: unknown): ServerInfo | undefined {
  const connection = record(record(value)['ConnectionInfo'] ?? record(value)['connection_info']);
  const client = text(connection['Client']);
  return client ? { observedClientAddress: parseObservedAddress(client) } : undefined;
}
function mergeServer(current: ServerInfo | undefined, incoming: ServerInfo): ServerInfo {
  return { ...current, ...defined(incoming) };
}
