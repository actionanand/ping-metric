import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { IpAddressService } from '../../core/services/ip-address.service';
import { IpIntelligenceService } from '../../core/services/ip-intelligence.service';
import { LatencyService } from '../../core/services/latency.service';
import { NetworkInfoService } from '../../core/services/network-info.service';
import { SpeedTestService } from '../../core/services/speed-test.service';
import { WebRtcLeakService } from '../../core/services/webrtc-leak.service';
import type {
  IpAddresses,
  IpIntelligence,
  LatencyResult,
  WebRtcLeakResult,
} from '../../core/models/app.models';
import { retransmissionPercent } from '../../shared/utils/network.utils';

@Component({
  selector: 'app-dashboard',
  imports: [NgOptimizedImage, RouterLink, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly speed = inject(SpeedTestService);
  protected readonly network = inject(NetworkInfoService);
  private readonly ipService = inject(IpAddressService);
  private readonly intelligenceService = inject(IpIntelligenceService);
  private readonly latencyService = inject(LatencyService);
  private readonly history = inject(HistoryService);
  private readonly webrtc = inject(WebRtcLeakService);
  private readonly router = inject(Router);
  protected readonly ips = signal<IpAddresses | undefined>(undefined);
  protected readonly intelligence = signal<IpIntelligence | undefined>(undefined);
  protected readonly latency = signal<LatencyResult | undefined>(undefined);
  protected readonly rtc = signal<WebRtcLeakResult | undefined>(undefined);
  protected readonly consent = signal(
    localStorage.getItem('ping-metric.mlab-consent') === 'accepted',
  );
  protected readonly showDisclosure = signal(false);
  constructor() {
    void this.refreshNetwork();
  }
  async refreshNetwork(): Promise<void> {
    const ips = await this.ipService.lookupAll();
    this.ips.set(ips);
    const ip = ips.default.value?.address ?? ips.ipv4.value?.address ?? ips.ipv6.value?.address;
    if (ip) {
      const result = await this.intelligenceService.lookup(ip);
      this.intelligence.set(result.value);
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
    this.speed.reset();
    this.speed.phase.set('preparing');
    const latency = await this.latencyService.measure();
    this.latency.set(latency.value);
    const result = await this.speed.run();
    if (result) {
      result.latency = latency.value;
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
    if (value) void navigator.clipboard?.writeText(value);
  }
  async lock(): Promise<void> {
    this.auth.lock();
    await this.router.navigateByUrl('/lock');
  }
  protected retransmission(): number | undefined {
    return retransmissionPercent(this.speed.upload().tcp ?? this.speed.download().tcp);
  }
}
