import { Component, inject, input } from '@angular/core';
import { PrivacyDisplayService } from '../../../core/services/privacy-display.service';

@Component({
  selector: 'app-sensitive-value',
  templateUrl: './sensitive-value.component.html',
  styleUrl: './sensitive-value.component.scss',
})
export class SensitiveValueComponent {
  readonly value = input<string | number | undefined | null>();
  readonly privacy = inject(PrivacyDisplayService);
  protected displayValue(): string {
    return this.value() === undefined || this.value() === null || this.value() === ''
      ? 'Not available'
      : String(this.value());
  }
}
