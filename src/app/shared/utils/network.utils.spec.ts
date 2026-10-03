import { describe, expect, it } from 'vitest';
import {
  ipFamily,
  isIpv4,
  isIpv6,
  latencyFromSamples,
  loadedLatencyDelta,
  mbps,
  microsecondsToMilliseconds,
  parseObservedAddress,
  retransmissionPercent,
} from './network.utils';

describe('network utilities', () => {
  it('validates and classifies IPv4 and IPv6 text', () => {
    expect(isIpv4('192.0.2.1')).toBe(true);
    expect(isIpv4('999.0.2.1')).toBe(false);
    expect(isIpv6('2001:db8::1')).toBe(true);
    expect(ipFamily('2001:db8::1')).toBe('ipv6');
  });
  it('parses NDT7 observed endpoints without splitting IPv6 colons', () => {
    expect(parseObservedAddress('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(parseObservedAddress('192.0.2.1:443')).toBe('192.0.2.1');
  });
  it('converts NDT7 units and derived throughput', () => {
    expect(microsecondsToMilliseconds(18000)).toBe(18);
    expect(mbps(1_000_000, 1_000_000)).toBe(8);
  });
  it('calculates median, consecutive-difference jitter, retransmission, and loaded delta', () => {
    const result = latencyFromSamples([10, 20, 30]);
    expect(result).toMatchObject({ medianMs: 20, jitterMs: 10 });
    expect(retransmissionPercent({ bytesSent: 1000, bytesRetrans: 25 })).toBe(2.5);
    expect(loadedLatencyDelta(18, 74)).toBe(56);
  });
});
