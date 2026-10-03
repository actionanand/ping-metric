import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { ServiceResult, LatencyResult } from '../models/app.models';
import { latencyFromSamples } from '../../shared/utils/network.utils';

@Service()
export class LatencyService {
  async measure(): Promise<ServiceResult<LatencyResult>> {
    try {
      await this.probe(); // Warm-up request is intentionally not included in the reported sample set.
      const samples = await Promise.all(
        Array.from({ length: environment.latency.attempts }, () => this.probe()),
      );
      return { state: 'available', value: latencyFromSamples(samples) };
    } catch (error: unknown) {
      return {
        state:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'timed-out'
            : 'unavailable',
        message: 'HTTP/application latency probe could not be reached.',
      };
    }
  }
  private async probe(): Promise<number> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), environment.latency.timeoutMs);
    const start = performance.now();
    try {
      await fetch(
        `${environment.latency.probeUrl}${environment.latency.probeUrl.includes('?') ? '&' : '?'}_=${Date.now()}`,
        { cache: 'no-store', mode: 'cors', signal: controller.signal },
      );
      return performance.now() - start;
    } finally {
      clearTimeout(timeout);
    }
  }
}
