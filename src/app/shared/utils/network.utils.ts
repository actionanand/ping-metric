import type { IpFamily, LatencyResult, TcpInfo } from '../../core/models/app.models';

export function isIpv4(value: string): boolean {
  const pieces = value.split('.');
  return (
    pieces.length === 4 && pieces.every((piece) => /^\d{1,3}$/.test(piece) && Number(piece) <= 255)
  );
}

export function isIpv6(value: string): boolean {
  // Browser-facing validation: accepts compressed notation and excludes non-address text.
  return value.includes(':') && /^[0-9a-fA-F:.]+$/.test(value) && value.split('::').length <= 2;
}

export function ipFamily(value: string): IpFamily {
  return isIpv4(value) ? 'ipv4' : isIpv6(value) ? 'ipv6' : 'unknown';
}
export function parseObservedAddress(value: string): string | undefined {
  const bracketed = /^\[([^\]]+)](?::\d+)?$/.exec(value);
  if (bracketed) return bracketed[1];
  const ipv4 = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(value);
  return ipv4?.[1] ?? (isIpv6(value) ? value : undefined);
}
export function microsecondsToMilliseconds(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value / 1000;
}
export function mbps(
  bytes: number | undefined,
  elapsedMicroseconds: number | undefined,
): number | undefined {
  if (!bytes || !elapsedMicroseconds || elapsedMicroseconds <= 0) return undefined;
  return (bytes * 8) / elapsedMicroseconds;
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function latencyFromSamples(samplesMs: number[]): LatencyResult | undefined {
  if (!samplesMs.length) return undefined;
  // Jitter is the mean absolute difference between consecutive HTTP/application timings.
  const differences = samplesMs.slice(1).map((value, index) => Math.abs(value - samplesMs[index]));
  return {
    samplesMs,
    medianMs: median(samplesMs),
    minimumMs: Math.min(...samplesMs),
    jitterMs: differences.length
      ? differences.reduce((sum, value) => sum + value, 0) / differences.length
      : 0,
  };
}
export function retransmissionPercent(tcp: TcpInfo | undefined): number | undefined {
  if (!tcp?.bytesSent || tcp.bytesSent <= 0 || tcp.bytesRetrans === undefined) return undefined;
  return (tcp.bytesRetrans / tcp.bytesSent) * 100;
}
export function loadedLatencyDelta(
  idle: number | undefined,
  loaded: number | undefined,
): number | undefined {
  return idle === undefined || loaded === undefined ? undefined : loaded - idle;
}
