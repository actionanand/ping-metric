import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { IpAddressService } from '../../core/services/ip-address.service';
import { IpIntelligenceService } from '../../core/services/ip-intelligence.service';
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

@Component({
  selector: 'app-dashboard',
  imports: [NgOptimizedImage, RouterLink, DecimalPipe, SensitiveValueComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly speed = inject(SpeedTestService);
  protected readonly network = inject(NetworkInfoService);
  protected readonly privacy = inject(PrivacyDisplayService);
  protected readonly speedUnit = inject(SpeedUnitService);
  private readonly ipService = inject(IpAddressService);
  private readonly intelligenceService = inject(IpIntelligenceService);
  private readonly history = inject(HistoryService);
  private readonly webrtc = inject(WebRtcLeakService);
  private readonly router = inject(Router);
  protected readonly mobileNavigation =
    viewChild.required<ElementRef<HTMLDialogElement>>('mobileNavigation');
  protected readonly ips = signal<IpAddresses | undefined>(undefined);
  protected readonly intelligence = signal<IpIntelligence | undefined>(undefined);
  protected readonly intelligenceMode = signal<IpIntelligenceMode | undefined>(undefined);
  protected readonly intelligenceMessage = signal<string | undefined>(undefined);
  protected readonly refreshingNetwork = signal(false);
  protected readonly lastNetworkRefresh = signal<Date | undefined>(undefined);
  protected readonly rtc = signal<WebRtcLeakResult | undefined>(undefined);
  protected readonly securityRows = computed(
    () =>
      [
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
      ] as const,
  );
  protected readonly consent = signal(
    localStorage.getItem('ping-metric.mlab-consent') === 'accepted',
  );
  protected readonly showDisclosure = signal(false);
  constructor() {
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
    this.intelligenceMessage.set(undefined);
    try {
      const ips = await this.ipService.lookupAll();
      this.ips.set(ips);
      const ip = ips.default.value?.address ?? ips.ipv4.value?.address ?? ips.ipv6.value?.address;
      if (ip) {
        const result = await this.intelligenceService.lookup(ip);
        this.intelligence.set(result.value);
        this.intelligenceMode.set(result.providerMode);
        this.intelligenceMessage.set(result.message);
      }
      this.lastNetworkRefresh.set(new Date());
    } catch {
      this.intelligence.set(undefined);
      this.intelligenceMode.set(undefined);
      this.intelligenceMessage.set('Network information could not be refreshed.');
    } finally {
      this.refreshingNetwork.set(false);
    }
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
  protected coordinates(): string {
    const location = this.intelligence()?.locationDetails;
    return location?.latitude === undefined || location.longitude === undefined
      ? 'Not available'
      : `${location.latitude}, ${location.longitude}`;
  }
  protected providerTitle(): string {
    return this.intelligenceMode() === 'keyed'
      ? 'Full IP intelligence'
      : this.intelligenceMode()
        ? 'Basic IP intelligence'
        : 'IP intelligence unavailable';
  }
  protected providerDetail(): string {
    return this.intelligenceMode() === 'keyed'
      ? 'ipapi.is authenticated'
      : this.intelligenceMode() === 'anonymous-fallback'
        ? 'Daily API quota reached · anonymous fallback active'
        : this.intelligenceMode() === 'anonymous'
          ? 'ipapi.is anonymous mode'
          : 'Speed testing and local browser diagnostics still work';
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
    return this.intelligenceMode() === 'keyed'
      ? 'provider-keyed'
      : this.intelligenceMode() === 'anonymous-fallback'
        ? 'provider-fallback'
        : this.intelligenceMode() === 'anonymous'
          ? 'provider-anonymous'
          : 'provider-unavailable';
  }
  protected speedValue(value: number | undefined): number | undefined {
    return this.speedUnit.displayValue(value);
  }
}
