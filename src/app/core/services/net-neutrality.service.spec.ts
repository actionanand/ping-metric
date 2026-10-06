import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
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
});
