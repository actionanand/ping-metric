import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetNeutralityService } from '../../core/services/net-neutrality.service';
import { NetNeutralityComponent } from './net-neutrality.component';

describe('NetNeutralityComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('renders the initial page without sending target requests', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.configureTestingModule({
      imports: [NetNeutralityComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NetNeutralityComponent);
    fixture.detectChanges();
    const service = TestBed.inject(NetNeutralityService);

    expect(fixture.nativeElement.textContent).toContain('Start Net Neutrality Check');
    expect(service.running()).toBe(false);
    expect(service.report()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
