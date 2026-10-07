import {
  DeferBlockBehavior,
  DeferBlockState,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  IpAddresses,
  IpIntelligence,
  IpIntelligenceResult,
} from '../../core/models/app.models';
import { AuthService } from '../../core/services/auth.service';
import { CurrentNetworkContextService } from '../../core/services/current-network-context.service';
import { HistoryService } from '../../core/services/history.service';
import { IpAddressService } from '../../core/services/ip-address.service';
import { IpIntelligenceService } from '../../core/services/ip-intelligence.service';
import {
  IpIntelligencePreferenceService,
  ipIntelligenceStorageKey,
} from '../../core/services/ip-intelligence-preference.service';
import { NetworkInfoService } from '../../core/services/network-info.service';
import { PrivacyDisplayService } from '../../core/services/privacy-display.service';
import { SpeedTestService } from '../../core/services/speed-test.service';
import { WebRtcLeakService } from '../../core/services/webrtc-leak.service';
import { DashboardComponent, providerStatusIcon } from './dashboard.component';
import { GeoMapDataService } from '../../core/services/geo-map-data.service';

// This suite checks dashboard integration, not canvas rendering. Keep the real
// geographic exports/registration but do not require a native jsdom canvas.
vi.mock('chart.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('chart.js')>();
  return {
    ...actual,
    Chart: class {
      static register = (...items: Parameters<typeof actual.Chart.register>) =>
        actual.Chart.register(...items);
      destroy = vi.fn();
      resize = vi.fn();
      update = vi.fn();
    },
  };
});

const addresses: IpAddresses = {
  default: {
    state: 'available',
    value: { address: '198.51.100.20', family: 'ipv4', source: 'default' },
  },
  ipv4: { state: 'available', value: { address: '198.51.100.20', family: 'ipv4', source: 'ipv4' } },
  ipv6: { state: 'unavailable' },
  protocol: 'IPv4 only',
};

const emptySecurity: IpIntelligence['security'] = {
  vpn: undefined,
  proxy: undefined,
  tor: undefined,
  datacenter: undefined,
  abuser: undefined,
  mobile: undefined,
  satellite: undefined,
  anycast: undefined,
  bogon: undefined,
  crawler: undefined,
};

function networkInfo() {
  return {
    online: true,
    effectiveType: '4g',
    downlink: 20,
    rtt: 50,
    secureContext: true,
    webCrypto: true,
    webRtc: true,
    networkInformation: true,
  };
}

type IntelligenceLookup = (ip: string, signal: AbortSignal) => Promise<IpIntelligenceResult>;

async function createDashboardFixture(
  lookup: IntelligenceLookup,
  intelligenceEnabled = true,
): Promise<ComponentFixture<DashboardComponent>> {
  await TestBed.configureTestingModule({
    deferBlockBehavior: DeferBlockBehavior.Manual,
    imports: [DashboardComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: {} },
      { provide: HistoryService, useValue: { add: vi.fn() } },
      { provide: IpAddressService, useValue: { lookupAll: vi.fn().mockResolvedValue(addresses) } },
      { provide: IpIntelligenceService, useValue: { lookup } },
      { provide: NetworkInfoService, useValue: { info: networkInfo } },
      {
        provide: SpeedTestService,
        useValue: {
          phase: () => 'idle',
          isRunning: () => false,
          phaseProgress: () => 0,
          download: () => ({}),
          upload: () => ({}),
          latency: () => undefined,
          latencyError: () => undefined,
          error: () => undefined,
          server: () => undefined,
        },
      },
      { provide: WebRtcLeakService, useValue: { test: vi.fn() } },
      IpIntelligencePreferenceService,
      PrivacyDisplayService,
      {
        provide: GeoMapDataService,
        useValue: {
          location: vi
            .fn()
            .mockResolvedValue({ mode: 'india', features: [], country: 'India', fallback: false }),
        },
      },
    ],
  }).compileComponents();

  TestBed.inject(IpIntelligencePreferenceService).setEnabled(intelligenceEnabled);
  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.detectChanges();
  await Promise.resolve();
  TestBed.flushEffects();
  await Promise.resolve();
  fixture.detectChanges();
  TestBed.flushEffects();
  fixture.detectChanges();
  return fixture;
}

describe('Dashboard IP intelligence opt-in', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
    localStorage.removeItem(ipIntelligenceStorageKey);
  });
  it('defers geometry loading and passes only privacy-safe existing intelligence to the map', async () => {
    const lookup = vi.fn().mockResolvedValue({
      state: 'available',
      providerMode: 'keyed',
      value: {
        ip: addresses.default.value?.address,
        country: 'India',
        countryCode: 'IN',
        region: 'Karnataka',
        security: emptySecurity,
      },
    });
    const fixture = await createDashboardFixture(lookup);
    const geometry = TestBed.inject(GeoMapDataService);
    expect(geometry.location).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Loads when visible');
    const blocks = await fixture.getDeferBlocks();
    await blocks[0].render(DeferBlockState.Complete);
    await fixture.whenStable();
    expect(geometry.location).toHaveBeenLastCalledWith('IN', 'India', undefined);
    TestBed.inject(PrivacyDisplayService).show();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(geometry.location).toHaveBeenLastCalledWith('IN', 'India', 'Karnataka');
    expect(lookup).toHaveBeenCalledTimes(1);
    fixture.componentInstance.setIntelligenceEnabled(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-ip-location-map')).toBeNull();
  });

  it('does not let a response from an in-flight request restore intelligence after disable', async () => {
    let resolveLookup!: (result: IpIntelligenceResult) => void;
    const pendingLookup = new Promise<IpIntelligenceResult>((resolve) => {
      resolveLookup = resolve;
    });
    const lookup = vi.fn((_ip: string, _signal: AbortSignal) => {
      void _ip;
      void _signal;
      return pendingLookup;
    });
    const fixture = await createDashboardFixture(lookup);

    expect(lookup).toHaveBeenCalledTimes(1);
    const requestSignal = lookup.mock.calls[0][1];
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    fixture.componentInstance.setIntelligenceEnabled(false);
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(requestSignal.aborted).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('IP intelligence off');

    resolveLookup({
      state: 'available',
      providerMode: 'keyed',
      value: {
        ip: addresses.default.value?.address ?? '',
        organization: 'Late ISP response',
        security: emptySecurity,
      },
    });
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Late ISP response');
    expect(fixture.nativeElement.textContent).toContain('ipapi.is is not being used');
  });

  it('finishes public IP loading while intelligence is off without running an effect loop or IPAPI request', async () => {
    const lookup = vi.fn((_ip: string, _signal: AbortSignal) => {
      void _ip;
      void _signal;
      return Promise.resolve({ state: 'available' as const, providerMode: 'anonymous' as const });
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const fixture = await createDashboardFixture(lookup, false);
    const currentContext = TestBed.inject(CurrentNetworkContextService);
    const updateIntelligence = vi.spyOn(currentContext, 'updateIntelligence');

    expect(currentContext.snapshot()).toMatchObject({
      protocol: 'IPv4 only',
      ipv4: '198.51.100.20',
    });
    expect(fixture.nativeElement.textContent).toContain('IP intelligence off');
    expect(fixture.nativeElement.textContent).toContain('ipapi.is is not being used');
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-ip-location-map')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Loads when visible');

    currentContext.updateNetwork({ ...addresses, protocol: 'Dual stack' }, networkInfo());
    TestBed.flushEffects();
    expect(updateIntelligence).not.toHaveBeenCalled();
  });

  it('omits empty summary rows, detail groups, and unknown security classifications', async () => {
    const lookup = vi.fn((_ip: string, _signal: AbortSignal) => {
      void _ip;
      void _signal;
      return Promise.resolve({
        state: 'available' as const,
        providerMode: 'anonymous' as const,
        value: { ip: addresses.default.value?.address ?? '', security: emptySecurity },
      });
    });
    const fixture = await createDashboardFixture(lookup);

    expect(fixture.nativeElement.querySelectorAll('.network-facts dt')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.detail-group')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('.security-row')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('app-ip-location-map')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Loads when visible');
    expect(fixture.nativeElement.textContent).toContain(
      'Advanced security classifications are unavailable',
    );
    expect(fixture.nativeElement.querySelector('.intelligence').textContent).not.toContain(
      'Not available',
    );
  });

  it('renders only the available labeled network summary rows', async () => {
    const lookup = vi.fn((_ip: string, _signal: AbortSignal) => {
      void _ip;
      void _signal;
      return Promise.resolve({
        state: 'available' as const,
        providerMode: 'keyed' as const,
        value: {
          ip: addresses.default.value?.address ?? '',
          asn: 'AS64500',
          organization: 'Example ISP',
          city: 'Example City',
          region: 'Example Region',
          country: 'Example Country',
          security: emptySecurity,
        },
      });
    });
    const fixture = await createDashboardFixture(lookup);
    const labels = [...fixture.nativeElement.querySelectorAll('.network-facts dt')].map(
      (element: HTMLElement) => element.textContent?.trim().split(/\s+/)[0],
    );

    expect(labels).toEqual(['ASN', 'ISP', 'City', 'Region', 'Country']);
  });

  it('keeps explicit security false and true values while hiding undefined flags', async () => {
    const lookup = vi.fn((_ip: string, _signal: AbortSignal) => {
      void _ip;
      void _signal;
      return Promise.resolve({
        state: 'available' as const,
        providerMode: 'keyed' as const,
        value: {
          ip: addresses.default.value?.address ?? '',
          security: { ...emptySecurity, vpn: false, proxy: true },
        },
      });
    });
    const fixture = await createDashboardFixture(lookup);
    const rows = [...fixture.nativeElement.querySelectorAll('.security-row')].map(
      (element: HTMLElement) => element.textContent ?? '',
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('VPN');
    expect(rows[0]).toContain('Not detected');
    expect(rows[1]).toContain('Proxy');
    expect(rows[1]).toContain('Detected');
    expect(fixture.nativeElement.textContent).not.toContain('Tor');
  });
});

describe('IP intelligence status icon', () => {
  it('maps every provider mode explicitly instead of relying on string truthiness', () => {
    expect(providerStatusIcon(false, false, 'disabled')).toBe('cloud_off');
    expect(providerStatusIcon(true, false, 'disabled')).toBe('cloud_off');
    expect(providerStatusIcon(true, false, 'keyed')).toBe('verified');
    expect(providerStatusIcon(true, false, 'anonymous')).toBe('info');
    expect(providerStatusIcon(true, false, 'anonymous-fallback')).toBe('info');
    expect(providerStatusIcon(true, true, undefined)).toBe('progress_activity');
    expect(providerStatusIcon(true, false, undefined)).toBe('cloud_off');
  });
});
