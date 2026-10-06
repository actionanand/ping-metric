import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import type { IpAddresses, IpIntelligence, NetworkCapabilities } from '../models/app.models';
import { CurrentNetworkContextService } from './current-network-context.service';
import { NetNeutralityService } from './net-neutrality.service';

const originalConfiguration = environment.neutrality;
const fetchMock = vi.fn<typeof fetch>();

function testConfiguration(attempts: number) {
  return {
    attempts,
    timeoutMs: 5000,
    minimumSuccessfulSamples: 1,
    ratioThreshold: 2.5,
    absoluteDifferenceThresholdMs: 150,
    targets: [
      { id: 'one', name: 'Service One', url: 'https://one.example/check' },
      { id: 'two', name: 'Service Two', url: 'https://two.example/check' },
    ],
  };
}

describe('NetNeutralityService', () => {
  beforeEach(() => {
    environment.neutrality = testConfiguration(2);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    environment.neutrality = originalConfiguration;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('does not send requests when the service is constructed', () => {
    const service = TestBed.inject(NetNeutralityService);
    expect(service.running()).toBe(false);
    expect(service.report()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts only on run, measures sequentially, and records an immutable report', async () => {
    let activeRequests = 0;
    let maximumConcurrentRequests = 0;
    fetchMock.mockImplementation(async (_input, init) => {
      activeRequests++;
      maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests);
      await Promise.resolve();
      activeRequests--;
      expect(init).toMatchObject({
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      return new Response(null, { status: 204 });
    });
    const service = TestBed.inject(NetNeutralityService);
    expect(fetchMock).not.toHaveBeenCalled();

    const report = await service.run();

    expect(report).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(maximumConcurrentRequests).toBe(1);
    expect(report?.methodologyVersion).toBe('PingMetric-NN-1');
    expect(report?.rounds).toHaveLength(2);
    expect(report?.targets.every((target) => target.attempts.length === 2)).toBe(true);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report?.rounds)).toBe(true);
    expect(service.report()).toBe(report);
  });

  it('uses five configured targets for 25 mocked requests across five rounds by default', async () => {
    environment.neutrality = originalConfiguration;
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const service = TestBed.inject(NetNeutralityService);

    const report = await service.run();

    expect(report?.targets).toHaveLength(5);
    expect(report?.rounds).toHaveLength(5);
    expect(report?.configuration.attempts).toBe(5);
    expect(report?.rounds.reduce((total, round) => total + round.attempts.length, 0)).toBe(25);
    expect(fetchMock).toHaveBeenCalledTimes(25);
  });

  it('records a timed-out request without treating it as an HTTP response', async () => {
    environment.neutrality = {
      ...testConfiguration(1),
      targets: [testConfiguration(1).targets[0]],
    };
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const service = TestBed.inject(NetNeutralityService);
    const reportPromise = service.run();

    await vi.advanceTimersByTimeAsync(5000);
    const report = await reportPromise;

    expect(report?.rounds[0].attempts[0].outcome).toBe('timed-out');
    expect(report?.targets[0].timeoutAttempts).toBe(1);
  });

  it('can be cancelled explicitly', async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const service = TestBed.inject(NetNeutralityService);
    const run = service.run();
    service.cancel();

    await expect(run).resolves.toBeUndefined();
    expect(service.running()).toBe(false);
    expect(service.report()).toBeUndefined();
  });

  it('uses the network context captured at Start even if current context changes during the run', async () => {
    environment.neutrality = {
      ...testConfiguration(1),
      targets: [testConfiguration(1).targets[0]],
    };
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const context = TestBed.inject(CurrentNetworkContextService);
    const capabilities: NetworkCapabilities = {
      online: true,
      effectiveType: '4g',
      secureContext: true,
      webCrypto: true,
      webRtc: true,
      networkInformation: true,
    };
    const network = (ip: string, protocol: IpAddresses['protocol']): IpAddresses => ({
      default: { state: 'available', value: { address: ip, family: 'ipv4', source: 'default' } },
      ipv4: { state: 'available', value: { address: ip, family: 'ipv4', source: 'ipv4' } },
      ipv6: { state: 'unavailable' },
      protocol,
    });
    const provider = (ip: string, isp: string): IpIntelligence => ({
      ip,
      organization: isp,
      city: isp,
      security: {
        vpn: undefined,
        proxy: undefined,
        tor: undefined,
        datacenter: undefined,
        abuser: undefined,
        mobile: undefined,
        satellite: undefined,
        anycast: undefined,
        bogon: undefined,
        crawler: undefined,
      },
    });
    context.updateNetwork(network('198.51.100.1', 'IPv4 only'), capabilities);
    context.updateIntelligence(provider('198.51.100.1', 'Network A ISP'));
    const service = TestBed.inject(NetNeutralityService);
    const run = service.run();

    context.updateNetwork(network('203.0.113.2', 'Dual stack'), {
      ...capabilities,
      effectiveType: '3g',
    });
    context.updateIntelligence(provider('203.0.113.2', 'Network B ISP'));
    const report = await run;

    expect(report?.networkContext).toMatchObject({
      protocol: 'IPv4 only',
      effectiveType: '4g',
      isp: 'Network A ISP',
      ipv4: '198.51.100.1',
    });
    expect(Object.isFrozen(report?.networkContext)).toBe(true);
  });
});
