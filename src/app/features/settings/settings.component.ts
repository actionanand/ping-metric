import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { HistoryService } from '../../core/services/history.service';
import { AuthService } from '../../core/services/auth.service';
import type { ThemePreference } from '../../core/models/app.models';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  protected readonly theme = inject(ThemeService);
  private readonly history = inject(HistoryService);
  private readonly auth = inject(AuthService);
  protected setTheme(value: string): void {
    if (value === 'system' || value === 'light' || value === 'dark')
      this.theme.preference.set(value as ThemePreference);
  }
  protected clearHistory(): void {
    if (confirm('Clear all locally stored test history?')) this.history.clear();
  }
  protected clearLocalPrivacyState(): void {
    localStorage.removeItem('ping-metric.mlab-consent');
    this.auth.lock();
  }
}
