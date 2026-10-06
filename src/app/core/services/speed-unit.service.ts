import { Service, effect, signal } from '@angular/core';
import type { SpeedUnitPreference } from '../models/app.models';

const storageKey = 'ping-metric.speed-unit.v1';
export function readSpeedUnitPreference(value: string | null): SpeedUnitPreference {
  return value === 'megabytes' ? 'megabytes' : 'megabits';
}
export function convertSpeed(
  mbps: number | undefined,
  preference: SpeedUnitPreference,
): number | undefined {
  return mbps === undefined ? undefined : preference === 'megabytes' ? mbps / 8 : mbps;
}
function readPreference(): SpeedUnitPreference {
  return readSpeedUnitPreference(localStorage.getItem(storageKey));
}
@Service()
export class SpeedUnitService {
  readonly preference = signal<SpeedUnitPreference>(readPreference());
  constructor() {
    effect(() => localStorage.setItem(storageKey, this.preference()));
  }
  displayValue(mbps: number | undefined): number | undefined {
    return convertSpeed(mbps, this.preference());
  }
  unitLabel(): 'Mbps' | 'MB/s' {
    return this.preference() === 'megabytes' ? 'MB/s' : 'Mbps';
  }
}
