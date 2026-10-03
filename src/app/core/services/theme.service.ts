import { Service, effect, signal } from '@angular/core';
import type { ThemePreference } from '../models/app.models';

@Service()
export class ThemeService {
  readonly preference = signal<ThemePreference>(
    (localStorage.getItem('ping-metric.theme') as ThemePreference) || 'system',
  );
  constructor() {
    effect(() => {
      const preference = this.preference();
      localStorage.setItem('ping-metric.theme', preference);
      document.documentElement.dataset['theme'] = preference;
    });
  }
}
