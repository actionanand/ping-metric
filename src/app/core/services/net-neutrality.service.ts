import { Service, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  NetNeutralityAttempt,
  NetNeutralityConfiguration,
  NetNeutralityProgress,
  NetNeutralityReport,
  NetNeutralityRound,
  NetNeutralityTargetConfig,
} from '../models/app.models';
import {
  overallClassification,
  shuffle,
  summarizeTargets,
} from '../../shared/utils/net-neutrality.utils';
import { CurrentNetworkContextService } from './current-network-context.service';

const methodologyVersion = 'PingMetric-NN-1';

function immutable<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach((child) => immutable(child));
    Object.freeze(value);
  }
  return value;
}

function reportId(): string {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PM-NN-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

function snapshot(configuration: NetNeutralityConfiguration) {
  return {
    attempts: configuration.attempts,
    timeoutMs: configuration.timeoutMs,
    minimumSuccessfulSamples: configuration.minimumSuccessfulSamples,
    ratioThreshold: configuration.ratioThreshold,
    absoluteDifferenceThresholdMs: configuration.absoluteDifferenceThresholdMs,
  } as const;
}

function explanation(overall: NetNeutralityReport['overall']): string {
  if (overall === 'potential-differential-behavior')
    return 'One or more tested browser-visible paths were repeatedly slower than the comparison set during this measurement. This does not by itself establish ISP throttling or a net-neutrality violation.';
  if (overall === 'no-obvious-differential-behavior')
    return 'No obvious differential behavior was observed during this measurement. This result does not guarantee that all Internet traffic is treated equally.';
  return 'There was not enough consistent successful timing data to compare the tested paths. Failed requests do not by themselves indicate ISP blocking.';
}

@Service()
export class NetNeutralityService {
  private readonly currentNetworkContext = inject(CurrentNetworkContextService);
  readonly running = signal(false);
  readonly progress = signal<NetNeutralityProgress | undefined>(undefined);
  readonly report = signal<NetNeutralityReport | undefined>(undefined);
  private controller: AbortController | undefined;

  async run(): Promise<NetNeutralityReport | undefined> {
    if (this.running()) return undefined;

    const configuration = environment.neutrality;
    const targets = configuration.targets.map((target) => ({ ...target }));
    if (!targets.length) return undefined;
    const networkContext = this.currentNetworkContext.snapshot();

    const snapshotStartedAt = new Date();
    const startedAt = snapshotStartedAt.toISOString();
    const startTime = performance.now();
    const controller = new AbortController();
    this.controller = controller;
    this.running.set(true);
    this.report.set(undefined);

    const attemptsByTarget = new Map<string, NetNeutralityAttempt[]>(
      targets.map((target) => [target.id, []]),
    );
    const rounds: NetNeutralityRound[] = [];
    const totalRequests = configuration.attempts * targets.length;
    let completedRequests = 0;

    try {
      for (let roundNumber = 1; roundNumber <= configuration.attempts; roundNumber++) {
        const order = shuffle(targets);
        const roundAttempts: NetNeutralityAttempt[] = [];
        for (const target of order) {
          if (controller.signal.aborted) return undefined;
          this.progress.set({
            round: roundNumber,
            totalRounds: configuration.attempts,
            targetName: target.name,
            completedRequests,
            totalRequests,
          });
          const attempt = await this.measure(
            target,
            roundNumber,
            configuration.timeoutMs,
            controller.signal,
          );
          if (controller.signal.aborted) return undefined;
          attemptsByTarget.get(target.id)?.push(attempt);
          roundAttempts.push(attempt);
          completedRequests++;
          this.progress.set({
            round: roundNumber,
            totalRounds: configuration.attempts,
            targetName: target.name,
            completedRequests,
            totalRequests,
          });
        }
        rounds.push({
          round: roundNumber,
          order: order.map((target) => target.id),
          attempts: roundAttempts,
        });
      }

      const summaries = summarizeTargets(targets, attemptsByTarget, configuration);
      const overall = overallClassification(summaries, configuration.minimumSuccessfulSamples);
      const completedAt = new Date().toISOString();
      const report = immutable<NetNeutralityReport>({
        id: reportId(),
        methodologyVersion,
        startedAt,
        completedAt,
        durationMs: Math.max(0, performance.now() - startTime),
        configuration: snapshot(configuration),
        rounds,
        targets: summaries,
        networkContext,
        overall,
        explanation: explanation(overall),
      });
      this.report.set(report);
      return report;
    } finally {
      if (this.controller === controller) this.controller = undefined;
      this.running.set(false);
      this.progress.set(undefined);
    }
  }

  cancel(): void {
    this.controller?.abort();
  }

  private async measure(
    target: NetNeutralityTargetConfig,
    round: number,
    timeoutMs: number,
    runSignal: AbortSignal,
  ): Promise<NetNeutralityAttempt> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const requestController = new AbortController();
    let timedOut = false;
    const abortForRun = () => requestController.abort();
    runSignal.addEventListener('abort', abortForRun, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, timeoutMs);

    try {
      const response = await fetch(target.url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: requestController.signal,
      });
      const durationMs = Math.max(0, performance.now() - start);
      return {
        targetId: target.id,
        round,
        startedAt,
        durationMs,
        outcome: response.type === 'opaque' || response.ok ? 'success' : 'failed',
      };
    } catch {
      return {
        targetId: target.id,
        round,
        startedAt,
        durationMs: Math.max(0, performance.now() - start),
        outcome: timedOut ? 'timed-out' : 'failed',
      };
    } finally {
      clearTimeout(timeout);
      runSignal.removeEventListener('abort', abortForRun);
    }
  }
}
