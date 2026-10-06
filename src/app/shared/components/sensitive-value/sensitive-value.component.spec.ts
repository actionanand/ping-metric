import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrivacyDisplayService } from '../../../core/services/privacy-display.service';
import { SensitiveValueComponent } from './sensitive-value.component';

describe('SensitiveValueComponent', () => {
  let privacy: PrivacyDisplayService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensitiveValueComponent],
      providers: [PrivacyDisplayService],
    }).compileComponents();
    privacy = TestBed.inject(PrivacyDisplayService);
    privacy.hide();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('hides sensitive text accessibly and removes it again after hiding', () => {
    const secret = '198.51.100.42';
    const fixture = TestBed.createComponent(SensitiveValueComponent);
    fixture.componentRef.setInput('value', secret);
    fixture.detectChanges();

    expect(privacy.sensitiveVisible()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain(secret);
    expect(
      fixture.nativeElement.querySelector('[aria-label="Sensitive information hidden"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.mask i')).toHaveLength(3);

    privacy.show();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(secret);

    privacy.hide();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(secret);
    expect(
      fixture.nativeElement.querySelector('[aria-label="Sensitive information hidden"]'),
    ).not.toBeNull();
  });
});
