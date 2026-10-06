import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { GUIDE_TERMS } from './network-guide.terms';
import { NetworkGuideComponent } from './network-guide.component';

describe('NetworkGuideComponent', () => {
  it('provides unique direct anchors for the indexed terms', async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkGuideComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NetworkGuideComponent);
    fixture.detectChanges();

    const ids = [...fixture.nativeElement.querySelectorAll('[id]')].map(
      (element: HTMLElement) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const term of GUIDE_TERMS) {
      expect(ids).toContain(term.anchor);
    }
  });

  it('searches terms and aliases from the accessible field', async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkGuideComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NetworkGuideComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#guide-search') as HTMLInputElement;

    input.value = 'server reflexive';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('srflx');
    expect(fixture.nativeElement.querySelector('a[href$="#srflx"]')).not.toBeNull();

    input.value = 'unknown term';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No matching network term.');
  });
});
