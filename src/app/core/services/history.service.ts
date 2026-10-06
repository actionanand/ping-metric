import { Service, computed, signal } from '@angular/core';
import type { StoredSpeedTestResult } from '../models/app.models';
import { environment } from '../../../environments/environment';

const key = 'ping-metric.history.v1';
@Service()
export class HistoryService {
  readonly maximumEntries = Math.max(1, Math.floor(environment.history.maxEntries));
  readonly entries = signal<StoredSpeedTestResult[]>(this.read());
  readonly summary = computed(() => summary(this.entries()));
  add(value: StoredSpeedTestResult): void {
    this.entries.update((entries) => [value, ...entries].slice(0, this.maximumEntries));
    this.save();
  }
  remove(id: string): void {
    this.entries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.save();
  }
  clear(): void {
    this.entries.set([]);
    localStorage.removeItem(key);
  }
  private read(): StoredSpeedTestResult[] {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      const validEntries = Array.isArray(stored) ? stored.filter(isStored) : [];
      const retainedEntries = validEntries.slice(0, this.maximumEntries);
      if (retainedEntries.length !== validEntries.length)
        localStorage.setItem(key, JSON.stringify(retainedEntries));
      return retainedEntries;
    } catch {
      return [];
    }
  }
  private save(): void {
    localStorage.setItem(key, JSON.stringify(this.entries()));
  }
}
function isStored(value: unknown): value is StoredSpeedTestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}
function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}
function summary(entries: StoredSpeedTestResult[]) {
  const download = entries
    .map((entry) => entry.download.mbps)
    .filter((value): value is number => value !== undefined);
  const upload = entries
    .map((entry) => entry.upload.mbps)
    .filter((value): value is number => value !== undefined);
  const latency = entries
    .map((entry) => entry.latency?.medianMs)
    .filter((value): value is number => value !== undefined);
  return {
    averageDownload: average(download),
    averageUpload: average(upload),
    bestDownload: download.length ? Math.max(...download) : undefined,
    bestUpload: upload.length ? Math.max(...upload) : undefined,
    averageLatency: average(latency),
    lowestLatency: latency.length ? Math.min(...latency) : undefined,
  };
}
