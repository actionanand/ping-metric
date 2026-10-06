import { describe, expect, it } from 'vitest';
import { PrivacyDisplayService } from './privacy-display.service';

describe('PrivacyDisplayService', () => {
  it('starts hidden and only keeps reveal state in memory', () => {
    const service = new PrivacyDisplayService();
    expect(service.sensitiveVisible()).toBe(false);
    service.show();
    expect(service.sensitiveVisible()).toBe(true);
    service.hide();
    expect(service.sensitiveVisible()).toBe(false);
  });
});
