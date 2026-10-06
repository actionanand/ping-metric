import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { IpAddressService } from '../../core/services/ip-address.service';
import { IpIntelligenceService } from '../../core/services/ip-intelligence.service';
import { IpIntelligencePreferenceService } from '../../core/services/ip-intelligence-preference.service';
import { CurrentNetworkContextService } from '../../core/services/current-network-context.service';
import { NetworkInfoService } from '../../core/services/network-info.service';
import { SpeedTestService } from '../../core/services/speed-test.service';
import { WebRtcLeakService } from '../../core/services/webrtc-leak.service';
import { PrivacyDisplayService } from '../../core/services/privacy-display.service';
import { SpeedUnitService } from '../../core/services/speed-unit.service';
import { SensitiveValueComponent } from '../../shared/components/sensitive-value/sensitive-value.component';
import type {
  IpAddresses,
  IpIntelligence,
  IpIntelligenceMode,
  WebRtcLeakResult,
} from '../../core/models/app.models';
import { retransmissionPercent } from '../../shared/utils/network.utils';

export function providerStatusIcon(
  enabled: boolean,
  loading: boolean,
  mode: IpIntelligenceMode | undefined,
): string {
  if (!enabled || mode === 'disabled') return 'cloud_off';
  if (loading) return 'progress_activity';
  if (mode === 'keyed') return 'verified';
  if (mode === 'anonymous' || mode === 'anonymous-fallback') return 'info';
  return 'cloud_off';
}

@Component({
  selector: 'app-dashboard',
  imports: [NgOptimizedImage, RouterLink, DecimalPipe, SensitiveValueComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly speed = inject(SpeedTestService);
  protected readonly privacy = inject(PrivacyDisplayService);
  protected readonly network = inject(NetworkInfoService);
  protected readonly speedUnit = inject(SpeedUnitService);
  protected readonly intelligencePreference = inject(IpIntelligencePreferenceService);
  private readonly currentNetworkContext = inject(CurrentNetworkContextService);
  private readonly ipService = inject(IpAddressService);
  private readonly intelligenceService = inject(IpIntelligenceService);
  private readonly history = inject(HistoryService);
  private readonly webrtc = inject(WebRtcLeakService);
  private readonly router = inject(Router);
  private intelligenceAbortController: AbortController | undefined;
  private intelligenceRequestGeneration = 0;
  private requestedIntelligenceIp: string | undefined;
  protected readonly mobileNavigation =
    viewChild.required<ElementRef<HTMLDialogElement>>('mobileNavigation');
  protected readonly ips = signal<IpAddresses | undefined>(undefined);
  protected readonly intelligence = signal<IpIntelligence | undefined>(undefined);
  protected readonly intelligenceMode = signal<IpIntelligenceMode | undefined>('disabled');
  protected readonly intelligenceLoading = signal(false);
  protected readonly refreshingNetwork = signal(false);
  protected readonly lastNetworkRefresh = signal<Date | undefined>(undefined);
  protected readonly rtc = signal<WebRtcLeakResult | undefined>(undefined);
  protected readonly securityRows = computed(() => {
    const rows = [
      ['VPN', 'vpn', 'factual'],
      ['Proxy', 'proxy', 'factual'],
      ['Tor', 'tor', 'factual'],
      ['Datacenter', 'datacenter', 'factual'],
      ['Known abusive IP', 'abuser', 'risk'],
      ['Mobile network', 'mobile', 'informational'],
      ['Satellite', 'satellite', 'informational'],
      ['Anycast', 'anycast', 'informational'],
      ['Bogon / reserved', 'bogon', 'risk'],
      ['Crawler / bot', 'crawler', 'informational'],
    ] as const;
    const intelligence = this.intelligence();
    return rows.filter(([, key]) => typeof intelligence?.security[key] === 'boolean');
  });
  protected readonly consent = signal(
    localStorage.getItem('ping-metric.mlab-consent') === 'accepted',
  );
  protected readonly showDisclosure = signal(false);
  constructor() {
    effect((onCleanup) => {
      const enabled = this.intelligencePreference.enabled();
      const addresses = this.ips();

      if (!enabled) {
        this.cancelIntelligenceRequest();
        this.clearIntelligence('disabled');
        return;
      }

      const ip =
        addresses?.default.value?.address ??
        addresses?.ipv4.value?.address ??
        addresses?.ipv6.value?.address;
      if (!ip) {
        const refreshing = this.refreshingNetwork();
        this.cancelIntelligenceRequest();
        this.intelligence.set(undefined);
        this.intelligenceMode.set(undefined);
        this.intelligenceLoading.set(refreshing);
        this.currentNetworkContext.updateIntelligence(undefined);
        return;
      }

      if (
        this.requestedIntelligenceIp === ip &&
        this.intelligenceAbortController &&
        !this.intelligenceAbortController.signal.aborted
      )
        return;

      this.intelligenceAbortController?.abort();
      const controller = new AbortController();
      this.intelligenceAbortController = controller;
      this.requestedIntelligenceIp = ip;
      const generation = ++this.intelligenceRequestGeneration;
      this.intelligence.set(undefined);
      this.intelligenceMode.set(undefined);
      this.intelligenceLoading.set(true);
      onCleanup(() => controller.abort());

      void this.intelligenceService
        .lookup(ip, controller.signal)
        .then((result) => {
          if (
            controller.signal.aborted ||
            generation !== this.intelligenceRequestGeneration ||
            !this.intelligencePreference.enabled()
          )
            return;
          this.intelligence.set(result.value);
          this.intelligenceMode.set(result.providerMode);
          this.currentNetworkContext.updateIntelligence(result.value);
          this.intelligenceLoading.set(false);
        })
        .catch(() => {
          if (controller.signal.aborted || generation !== this.intelligenceRequestGeneration)
            return;
          this.intelligence.set(undefined);
          this.intelligenceMode.set(undefined);
          this.currentNetworkContext.updateIntelligence(undefined);
          this.intelligenceLoading.set(false);
        });
    });
    void this.refreshNetwork();
  }
  openNavigation(): void {
    this.mobileNavigation().nativeElement.showModal();
  }
  closeNavigation(): void {
    this.mobileNavigation().nativeElement.close();
  }
  closeNavigationOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeNavigation();
  }
  async refreshNetwork(): Promise<void> {
    if (this.refreshingNetwork()) return;
    this.refreshingNetwork.set(true);
    try {
      const ips = await this.ipService.lookupAll();
      this.ips.set(ips);
      this.currentNetworkContext.updateNetwork(ips, this.network.info());
      this.lastNetworkRefresh.set(new Date());
    } catch {
      this.ips.set(undefined);
      this.currentNetworkContext.clearNetwork(this.network.info());
    } finally {
      this.refreshingNetwork.set(false);
    }
  }
  setIntelligenceEnabled(enabled: boolean): void {
    this.intelligencePreference.setEnabled(enabled);
    if (enabled) {
      this.intelligence.set(undefined);
      this.intelligenceMode.set(undefined);
      this.intelligenceLoading.set(true);
      return;
    }
    this.cancelIntelligenceRequest();
    this.clearIntelligence('disabled');
  }
  requestTest(): void {
    if (this.consent()) {
      void this.startTest();
      return;
    }
    this.showDisclosure.set(true);
  }
  acceptDisclosure(): void {
    localStorage.setItem('ping-metric.mlab-consent', 'accepted');
    this.consent.set(true);
    this.showDisclosure.set(false);
    void this.startTest();
  }
  async startTest(): Promise<void> {
    if (!this.network.info().online) return;
    const result = await this.speed.run();
    if (result) {
      const saved = {
        ...result,
        version: 1 as const,
        ip: this.ips(),
        intelligence: this.intelligence(),
        capabilities: this.network.info(),
        retransmissionPercent: retransmissionPercent(result.upload.tcp ?? result.download.tcp),
      };
      this.history.add(saved);
    }
  }
  async testWebRtc(): Promise<void> {
    this.rtc.set(await this.webrtc.test(this.ips()));
  }
  copy(value: string | undefined): void {
    if (value && this.privacy.sensitiveVisible()) void navigator.clipboard?.writeText(value);
  }
  async lock(): Promise<void> {
    this.closeNavigation();
    this.privacy.hide();
    this.auth.lock();
    await this.router.navigateByUrl('/lock');
  }
  protected retransmission(): number | undefined {
    return retransmissionPercent(this.speed.upload().tcp ?? this.speed.download().tcp);
  }
  protected bytes(value: number | undefined): string {
    if (value === undefined) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(
      Math.floor(Math.log(Math.max(value, 1)) / Math.log(1000)),
      units.length - 1,
    );
    return `${(value / 1000 ** index).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[index]}`;
  }
  protected present(value: string | number | undefined | null): string {
    return value === undefined || value === null || value === '' ? 'Not available' : String(value);
  }
  protected hasValue(value: string | number | boolean | undefined | null): boolean {
    return value !== undefined && value !== null && value !== '';
  }
  protected asnValue(): string | undefined {
    return this.intelligence()?.asnDetails?.asn || this.intelligence()?.asn;
  }
  protected ispValue(): string | undefined {
    return this.intelligence()?.companyDetails?.name || this.intelligence()?.organization;
  }
  protected cityValue(): string | undefined {
    return this.intelligence()?.locationDetails?.city || this.intelligence()?.city;
  }
  protected regionValue(): string | undefined {
    return this.intelligence()?.locationDetails?.region || this.intelligence()?.region;
  }
  protected countryValue(): string | undefined {
    return this.intelligence()?.locationDetails?.country || this.intelligence()?.country;
  }
  protected providerDetailsAvailable(): boolean {
    const details = this.intelligence()?.companyDetails;
    return Boolean(
      details?.name ||
      details?.type ||
      details?.domain ||
      details?.network ||
      details?.netname ||
      details?.abuserScore ||
      this.intelligence()?.organization ||
      this.intelligence()?.companyType,
    );
  }
  protected asnDetailsAvailable(): boolean {
    const details = this.intelligence()?.asnDetails;
    return (
      Boolean(
        details && Object.values(details).some((value) => value !== undefined && value !== ''),
      ) || Boolean(this.intelligence()?.asn || this.intelligence()?.rir)
    );
  }
  protected locationDetailsAvailable(): boolean {
    const details = this.intelligence()?.locationDetails;
    return (
      Boolean(
        details && Object.values(details).some((value) => value !== undefined && value !== ''),
      ) ||
      Boolean(
        this.intelligence()?.city || this.intelligence()?.region || this.intelligence()?.country,
      )
    );
  }
  protected abuseDetailsAvailable(): boolean {
    const details = this.intelligence()?.abuseDetails;
    return Boolean(details && Object.values(details).some((value) => Boolean(value)));
  }
  protected coordinates(): string | undefined {
    const location = this.intelligence()?.locationDetails;
    return location?.latitude === undefined || location.longitude === undefined
      ? undefined
      : `${location.latitude}, ${location.longitude}`;
  }
  protected candidateLabel(type: string): string {
    switch (type.toLowerCase()) {
      case 'host':
        return 'Host candidate';
      case 'srflx':
        return 'Server-reflexive (srflx)';
      case 'relay':
        return 'Relay candidate';
      default:
        return `${type} candidate`;
    }
  }
  protected candidateAnchor(type: string): string | undefined {
    const normalized = type.toLowerCase();
    return normalized === 'host' || normalized === 'srflx' || normalized === 'relay'
      ? normalized
      : undefined;
  }
  protected providerTitle(): string {
    if (!this.intelligencePreference.enabled()) return 'IP intelligence off';
    if (this.intelligenceLoading()) return 'Loading IP intelligence';
    if (this.intelligenceMode() === 'keyed') return 'Full IP intelligence';
    if (this.intelligenceMode() === 'anonymous' || this.intelligenceMode() === 'anonymous-fallback')
      return 'Basic IP intelligence';
    return 'IP intelligence unavailable';
  }
  protected providerDetail(): string {
    if (!this.intelligencePreference.enabled()) return 'ipapi.is is not being used';
    if (this.intelligenceLoading()) return 'Loading provider-reported network details';
    if (this.intelligenceMode() === 'keyed') return 'ipapi.is authenticated';
    if (this.intelligenceMode() === 'anonymous-fallback')
      return 'API quota reached · anonymous fallback active';
    if (this.intelligenceMode() === 'anonymous') return 'ipapi.is anonymous mode';
    return 'Provider could not be reached or returned no usable data';
  }
  protected securityText(value: boolean | undefined): string {
    return value === undefined ? 'Not available' : value ? 'Detected' : 'Not detected';
  }
  protected securityClass(kind: string, value: boolean | undefined): string {
    if (value === undefined) return 'status-neutral';
    if (!value) return 'status-good';
    return kind === 'risk'
      ? 'status-risk'
      : kind === 'informational'
        ? 'status-info'
        : 'status-neutral';
  }
  protected securityValue(key: keyof IpIntelligence['security']): boolean | undefined {
    return this.intelligence()?.security[key];
  }
  protected providerStatusClass(): string {
    if (!this.intelligencePreference.enabled()) return 'provider-disabled';
    return this.intelligenceMode() === 'keyed'
      ? 'provider-keyed'
      : this.intelligenceMode() === 'anonymous-fallback'
        ? 'provider-fallback'
        : this.intelligenceMode() === 'anonymous'
          ? 'provider-anonymous'
          : 'provider-unavailable';
  }
  protected providerIcon(): string {
    return providerStatusIcon(
      this.intelligencePreference.enabled(),
      this.intelligenceLoading(),
      this.intelligenceMode(),
    );
  }
  protected speedValue(value: number | undefined): number | undefined {
    return this.speedUnit.displayValue(value);
  }
  private cancelIntelligenceRequest(): void {
    this.intelligenceRequestGeneration++;
    this.intelligenceAbortController?.abort();
    this.intelligenceAbortController = undefined;
    this.requestedIntelligenceIp = undefined;
  }
  private clearIntelligence(mode: IpIntelligenceMode): void {
    this.intelligence.set(undefined);
    this.intelligenceMode.set(mode);
    this.intelligenceLoading.set(false);
    this.currentNetworkContext.updateIntelligence(undefined);
  }
}
