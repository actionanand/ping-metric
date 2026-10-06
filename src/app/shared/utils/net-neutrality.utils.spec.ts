import { describe, expect, it } from 'vitest';
import type {
  NetNeutralityAttempt,
  NetNeutralityConfiguration,
  NetNeutralityTargetConfig,
} from '../../core/models/app.models';
import {
  maximum,
  median,
  medianAbsoluteDeviation,
  minimum,
  overallClassification,
  shuffle,
  successRate,
  summarizeTargets,
} from './net-neutrality.utils';

const targets: NetNeutralityTargetConfig[] = [
  { id: 'reference-a', name: 'Reference A', url: 'https://a.example' },
  { id: 'reference-b', name: 'Reference B', url: 'https://b.example' },
  { id: 'slow', name: 'Slow', url: 'https://slow.example' },
];
const thresholds: Pick<
  NetNeutralityConfiguration,
  'minimumSuccessfulSamples' | 'ratioThreshold' | 'absoluteDifferenceThresholdMs'
> = { minimumSuccessfulSamples: 3, ratioThreshold: 2.5, absoluteDifferenceThresholdMs: 150 };

function attempts(
  targetId: string,
  timings: readonly (number | 'failed' | 'timed-out')[],
): NetNeutralityAttempt[] {
  return timings.map((timing, index) => ({
    targetId,
    round: index + 1,
    startedAt: `2026-01-01T00:00:0${index}Z`,
    ...(typeof timing === 'number'
      ? { durationMs: timing, outcome: 'success' as const }
      : { outcome: timing }),
  }));
}

describe('net neutrality statistics', () => {
  it('calculates median, minimum, maximum, MAD, and success rate', () => {
    expect(median([9, 1, 5, 3])).toBe(4);
    expect(median([9, 1, 5])).toBe(5);
    expect(minimum([9, 1, 5])).toBe(1);
    expect(maximum([9, 1, 5])).toBe(9);
    expect(medianAbsoluteDeviation([1, 2, 3, 100])).toBe(1);
    expect(successRate(3, 5)).toBe(60);
    expect(median([])).toBeUndefined();
  });

  it('randomizes a copied list without changing its input', () => {
    const values = [1, 2, 3, 4];
    expect(shuffle(values, () => 0)).toEqual([2, 3, 4, 1]);
    expect(values).toEqual([1, 2, 3, 4]);
  });

  it('does not classify a single slow outlier as repeated differential behavior', () => {
    const attemptsByTarget = new Map([
      ['reference-a', attempts('reference-a', [50, 51, 49, 52, 48])],
      ['reference-b', attempts('reference-b', [55, 54, 53, 56, 52])],
      ['slow', attempts('slow', [50, 55, 700, 52, 51])],
    ]);
    const results = summarizeTargets(targets, attemptsByTarget, thresholds);
    expect(results.find((target) => target.id === 'slow')?.classification).toBe('normal');
    expect(overallClassification(results, 3)).toBe('no-obvious-differential-behavior');
  });

  it('requires repeated slower samples and both configured thresholds', () => {
    const attemptsByTarget = new Map([
      ['reference-a', attempts('reference-a', [50, 51, 49, 52, 48])],
      ['reference-b', attempts('reference-b', [55, 54, 53, 56, 52])],
      ['slow', attempts('slow', [400, 420, 410, 50, 52])],
    ]);
    const results = summarizeTargets(targets, attemptsByTarget, thresholds);
    expect(results.find((target) => target.id === 'slow')?.classification).toBe(
      'slower-path-observed',
    );
    expect(overallClassification(results, 3)).toBe('potential-differential-behavior');
  });

  it('does not classify a difference that clears only the ratio threshold', () => {
    const samples = new Map([
      ['reference-a', attempts('reference-a', [100, 100, 100])],
      ['reference-b', attempts('reference-b', [100, 100, 100])],
      ['slow', attempts('slow', [200, 200, 200])],
    ]);
    const result = summarizeTargets(targets, samples, {
      minimumSuccessfulSamples: 3,
      ratioThreshold: 1.5,
      absoluteDifferenceThresholdMs: 150,
    });
    expect(result.find((target) => target.id === 'slow')?.classification).toBe('normal');
  });

  it('does not classify a difference that clears only the absolute threshold', () => {
    const samples = new Map([
      ['reference-a', attempts('reference-a', [100, 100, 100])],
      ['reference-b', attempts('reference-b', [100, 100, 100])],
      ['slow', attempts('slow', [300, 300, 300])],
    ]);
    const result = summarizeTargets(targets, samples, {
      minimumSuccessfulSamples: 3,
      ratioThreshold: 4,
      absoluteDifferenceThresholdMs: 150,
    });
    expect(result.find((target) => target.id === 'slow')?.classification).toBe('normal');
  });

  it('records failures and timeouts and keeps insufficient evidence inconclusive overall', () => {
    const attemptsByTarget = new Map([
      ['reference-a', attempts('reference-a', [50, 51, 49])],
      ['reference-b', attempts('reference-b', [55, 54, 53])],
      ['slow', attempts('slow', [50, 'failed', 'timed-out'])],
    ]);
    const results = summarizeTargets(targets, attemptsByTarget, thresholds);
    expect(results.find((target) => target.id === 'slow')).toMatchObject({
      successfulAttempts: 1,
      failedAttempts: 1,
      timeoutAttempts: 1,
      classification: 'reachability-problem',
    });
    expect(results.find((target) => target.id === 'slow')?.successRate).toBeCloseTo(100 / 3);
    expect(overallClassification(results, 3)).toBe('inconclusive');
  });
});
