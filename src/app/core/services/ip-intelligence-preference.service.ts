import { Service, signal } from '@angular/core';

export const ipIntelligenceStorageKey = 'ping-metric.ip-intelligence-enabled.v1';

function readEnabled(): boolean {
  return localStorage.getItem(ipIntelligenceStorageKey) === 'true';
}

@Service()
export class IpIntelligencePreferenceService {
  readonly enabled = signal(readEnabled());

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    localStorage.setItem(ipIntelligenceStorageKey, String(enabled));
  }
}
