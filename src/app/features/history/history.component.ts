import { Component, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../core/services/history.service';
import { SpeedUnitService } from '../../core/services/speed-unit.service';
import { PrivacyDisplayService } from '../../core/services/privacy-display.service';
import { IpIntelligencePreferenceService } from '../../core/services/ip-intelligence-preference.service';
import { SensitiveValueComponent } from '../../shared/components/sensitive-value/sensitive-value.component';

@Component({
  selector: 'app-history',
  imports: [DecimalPipe, DatePipe, RouterLink, SensitiveValueComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  protected readonly history = inject(HistoryService);
  protected readonly speedUnit = inject(SpeedUnitService);
  protected readonly privacy = inject(PrivacyDisplayService);
  protected readonly intelligencePreference = inject(IpIntelligencePreferenceService);
  protected speedValue(value: number | undefined): number | undefined {
    return this.speedUnit.displayValue(value);
  }
  protected clear(): void {
    if (confirm('Clear all locally stored test history?')) this.history.clear();
  }
}
