import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { NetNeutralityReport } from '../../core/models/app.models';
import { NetNeutralityPdfService } from '../../core/services/net-neutrality-pdf.service';
import { NetNeutralityService } from '../../core/services/net-neutrality.service';
import {
  NetNeutralityChartsComponent,
  type NetNeutralityChartImages,
} from '../../shared/components/net-neutrality-charts/net-neutrality-charts.component';

@Component({
  selector: 'app-net-neutrality',
  imports: [DatePipe, DecimalPipe, RouterLink, NetNeutralityChartsComponent],
  templateUrl: './net-neutrality.component.html',
  styleUrl: './net-neutrality.component.scss',
})
export class NetNeutralityComponent {
  protected readonly neutrality = inject(NetNeutralityService);
  protected readonly report = this.neutrality.report;
  protected readonly progress = this.neutrality.progress;
  private readonly pdf = inject(NetNeutralityPdfService);
  protected readonly includeNetworkIdentity = signal(false);
  protected readonly includePublicIp = signal(false);
  private readonly chartImages = signal<NetNeutralityChartImages>({});

  async start(): Promise<void> {
    this.chartImages.set({});
    this.includeNetworkIdentity.set(false);
    this.includePublicIp.set(false);
    await this.neutrality.run();
  }

  cancel(): void {
    this.neutrality.cancel();
  }

  onNetworkIdentityChange(event: Event): void {
    this.includeNetworkIdentity.set((event.currentTarget as HTMLInputElement).checked);
  }

  onPublicIpChange(event: Event): void {
    this.includePublicIp.set((event.currentTarget as HTMLInputElement).checked);
  }

  downloadPdf(report: NetNeutralityReport): void {
    this.pdf.download(
      report,
      {
        includeNetworkIdentity: this.includeNetworkIdentity(),
        includePublicIp: this.includePublicIp(),
      },
      {
        ...this.chartImages(),
      },
    );
  }

  onChartsReady(images: NetNeutralityChartImages): void {
    this.chartImages.set(images);
  }

  overallLabel(value: NetNeutralityReport['overall']): string {
    switch (value) {
      case 'no-obvious-differential-behavior':
        return 'No obvious differential behavior observed';
      case 'potential-differential-behavior':
        return 'Potential differential behavior observed';
      default:
        return 'Inconclusive';
    }
  }

  classificationLabel(value: NetNeutralityReport['targets'][number]['classification']): string {
    switch (value) {
      case 'slower-path-observed':
        return 'Slower path observed';
      case 'reachability-problem':
        return 'Reachability problem';
      case 'inconclusive':
        return 'Inconclusive';
      default:
        return 'Normal';
    }
  }

  totalRequests(report: NetNeutralityReport): number {
    return report.rounds.reduce((total, round) => total + round.attempts.length, 0);
  }

  targetName(report: NetNeutralityReport, targetId: string): string {
    return report.targets.find((target) => target.id === targetId)?.name ?? targetId;
  }
}
