import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  IpIntelligencePreferenceService,
  ipIntelligenceStorageKey,
} from './ip-intelligence-preference.service';

describe('IpIntelligencePreferenceService', () => {
  beforeEach(() => localStorage.removeItem(ipIntelligenceStorageKey));
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(ipIntelligenceStorageKey);
  });

  it('defaults to disabled on first use', () => {
    const service = TestBed.inject(IpIntelligencePreferenceService);
    expect(service.enabled()).toBe(false);
  });

  it('restores persisted enabled and disabled values', () => {
    localStorage.setItem(ipIntelligenceStorageKey, 'true');
    expect(TestBed.inject(IpIntelligencePreferenceService).enabled()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(ipIntelligenceStorageKey, 'false');
    expect(TestBed.inject(IpIntelligencePreferenceService).enabled()).toBe(false);
  });

  it('persists both toggle directions', () => {
    const service = TestBed.inject(IpIntelligencePreferenceService);
    service.setEnabled(true);
    expect(localStorage.getItem(ipIntelligenceStorageKey)).toBe('true');
    service.setEnabled(false);
    expect(localStorage.getItem(ipIntelligenceStorageKey)).toBe('false');
  });
});
