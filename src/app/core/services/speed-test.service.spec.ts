import { describe, expect, it } from 'vitest';
import { canStartMeasurement, measurementFrom, mergeDirection } from './speed-test.service';

describe('speed-test state and measurement normalization', () => {
  it('does not allow a second test while a lifecycle phase is active', () => {
    expect(canStartMeasurement('idle')).toBe(true);
    expect(canStartMeasurement('preparing')).toBe(false);
    expect(canStartMeasurement('measuring-latency')).toBe(false);
    expect(canStartMeasurement('download')).toBe(false);
    expect(canStartMeasurement('complete')).toBe(true);
  });

  it('keeps client application throughput and server TCP information together', () => {
    const client = measurementFrom(
      { ElapsedTime: 2, NumBytes: 25_000_000, MeanClientMbps: 100 },
      'client',
    );
    const server = measurementFrom(
      {
        AppInfo: { ElapsedTime: 2_000_000, NumBytes: 25_000_000 },
        TCPInfo: { RTT: 18_000, RTTVar: 2_000, BytesSent: 1_000, BytesRetrans: 15 },
        ConnectionInfo: { Client: '[2001:db8::1]:1234' },
      },
      'server',
    );
    expect(mergeDirection(client, server)).toMatchObject({
      mbps: 100,
      liveMbps: 100,
      bytes: 25_000_000,
      durationMs: 2000,
      tcp: { rttMs: 18, rttVarMs: 2, bytesRetrans: 15 },
    });
  });

  it('does not erase populated client values when a server callback omits AppInfo', () => {
    const current = measurementFrom(
      { ElapsedTime: 1, NumBytes: 1_000_000, MeanClientMbps: 8 },
      'client',
    );
    expect(
      mergeDirection(current, measurementFrom({ TCPInfo: { RTT: 10 } }, 'server')),
    ).toMatchObject({ mbps: 8, bytes: 1_000_000, tcp: { rttMs: 0.01 } });
  });
});
