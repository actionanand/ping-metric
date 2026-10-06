import { afterEach, describe, expect, it } from 'vitest';
import { convertSpeed, readSpeedUnitPreference } from './speed-unit.service';

const storageKey = 'ping-metric.speed-unit.v1';

describe('speed display units', () => {
  afterEach(() => localStorage.removeItem(storageKey));

  it('keeps Mbps canonical and converts display-only MB/s by eight', () => {
    const canonicalMbps = 80;
    expect(convertSpeed(canonicalMbps, 'megabits')).toBe(80);
    expect(convertSpeed(80, 'megabytes')).toBe(10);
    expect(convertSpeed(20, 'megabytes')).toBe(2.5);
    expect(convertSpeed(undefined, 'megabytes')).toBeUndefined();
    expect(canonicalMbps).toBe(80);
  });
  it('restores a persisted megabytes preference', () => {
    localStorage.setItem(storageKey, 'megabytes');
    expect(readSpeedUnitPreference(localStorage.getItem(storageKey))).toBe('megabytes');
  });
  it('defaults invalid stored values to megabits', () => {
    expect(readSpeedUnitPreference('megabytes')).toBe('megabytes');
    expect(readSpeedUnitPreference('other')).toBe('megabits');
    expect(readSpeedUnitPreference(null)).toBe('megabits');
  });
});
