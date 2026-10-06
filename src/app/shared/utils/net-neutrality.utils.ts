import type {
  NetNeutralityAttempt,
  NetNeutralityConfiguration,
  NetNeutralityOverall,
  NetNeutralityTargetClassification,
  NetNeutralityTargetConfig,
  NetNeutralityTargetResult,
} from '../../core/models/app.models';

export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function minimum(values: readonly number[]): number | undefined {
  return values.length ? Math.min(...values) : undefined;
}

export function maximum(values: readonly number[]): number | undefined {
  return values.length ? Math.max(...values) : undefined;
}

export function medianAbsoluteDeviation(values: readonly number[]): number | undefined {
  const center = median(values);
  return center === undefined ? undefined : median(values.map((value) => Math.abs(value - center)));
}

export function successRate(successes: number, attempts: number): number {
  return attempts ? (successes / attempts) * 100 : 0;
}

function successfulTimings(attempts: readonly NetNeutralityAttempt[]): number[] {
  return attempts.flatMap((attempt) =>
    attempt.outcome === 'success' && attempt.durationMs !== undefined ? [attempt.durationMs] : [],
  );
}

export function summarizeTargets(
  targets: readonly NetNeutralityTargetConfig[],
  attemptsByTarget: ReadonlyMap<string, readonly NetNeutralityAttempt[]>,
  configuration: Pick<
    NetNeutralityConfiguration,
    'minimumSuccessfulSamples' | 'ratioThreshold' | 'absoluteDifferenceThresholdMs'
  >,
): NetNeutralityTargetResult[] {
  const targetTimings = new Map(
    targets.map((target) => [target.id, successfulTimings(attemptsByTarget.get(target.id) ?? [])]),
  );
  const targetMedians = new Map(
    targets.map((target) => [target.id, median(targetTimings.get(target.id) ?? [])]),
  );

  return targets.map((target) => {
    const attempts = attemptsByTarget.get(target.id) ?? [];
    const timings = targetTimings.get(target.id) ?? [];
    const successfulAttempts = timings.length;
    const failedAttempts = attempts.filter((attempt) => attempt.outcome === 'failed').length;
    const timeoutAttempts = attempts.filter((attempt) => attempt.outcome === 'timed-out').length;
    const center = targetMedians.get(target.id);
    const comparisonMedians = targets.flatMap((other) => {
      const value = targetMedians.get(other.id);
      return other.id !== target.id && value !== undefined ? [value] : [];
    });
    const reference = median(comparisonMedians);
    let classification: NetNeutralityTargetClassification;
    let relativeRatio: number | undefined;

    if (successfulAttempts < configuration.minimumSuccessfulSamples) {
      classification = failedAttempts + timeoutAttempts ? 'reachability-problem' : 'inconclusive';
    } else if (center === undefined || reference === undefined) {
      classification = 'inconclusive';
    } else {
      const threshold = Math.max(
        reference * configuration.ratioThreshold,
        reference + configuration.absoluteDifferenceThresholdMs,
      );
      const repeatedSlowSamples = timings.filter((timing) => timing > threshold).length;
      relativeRatio = reference > 0 ? center / reference : undefined;
      classification =
        center > threshold && repeatedSlowSamples >= configuration.minimumSuccessfulSamples
          ? 'slower-path-observed'
          : 'normal';
    }

    return {
      id: target.id,
      name: target.name,
      attempts: [...attempts],
      successfulAttempts,
      failedAttempts,
      timeoutAttempts,
      successRate: successRate(successfulAttempts, attempts.length),
      minimumMs: minimum(timings),
      medianMs: center,
      maximumMs: maximum(timings),
      variationMs: medianAbsoluteDeviation(timings),
      relativeRatio,
      classification,
    };
  });
}

export function overallClassification(
  targets: readonly NetNeutralityTargetResult[],
  minimumSuccessfulSamples: number,
): NetNeutralityOverall {
  if (
    !targets.length ||
    targets.some((target) => target.successfulAttempts < minimumSuccessfulSamples)
  )
    return 'inconclusive';
  return targets.some((target) => target.classification === 'slower-path-observed')
    ? 'potential-differential-behavior'
    : 'no-obvious-differential-behavior';
}

export function shuffle<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
