import { Service, signal } from '@angular/core';

@Service()
export class PrivacyDisplayService {
  readonly sensitiveVisible = signal(false);
  toggle(): void {
    this.sensitiveVisible.update((visible) => !visible);
  }
  show(): void {
    this.sensitiveVisible.set(true);
  }
  hide(): void {
    this.sensitiveVisible.set(false);
  }
}
