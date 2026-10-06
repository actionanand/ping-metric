import { describe, expect, it } from 'vitest';
import { convertSpeed, readSpeedUnitPreference } from './speed-unit.service';

describe('speed display units', () => {
  it('keeps Mbps canonical and converts display-only MB/s by eight', () => {
    expect(convertSpeed(80, 'megabits')).toBe(80);
    expect(convertSpeed(80, 'megabytes')).toBe(10);
    expect(convertSpeed(20, 'megabytes')).toBe(2.5);
    expect(convertSpeed(undefined, 'megabytes')).toBeUndefined();
  });
  it('defaults invalid stored values to megabits', () => {
    expect(readSpeedUnitPreference('megabytes')).toBe('megabytes');
    expect(readSpeedUnitPreference('other')).toBe('megabits');
    expect(readSpeedUnitPreference(null)).toBe('megabits');
  });
});
