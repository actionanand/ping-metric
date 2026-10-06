import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import type { NetNeutralityReport } from '../../core/models/app.models';
import { HistoryService } from '../../core/services/history.service';
import { NetNeutralityPdfService } from '../../core/services/net-neutrality-pdf.service';
import { NetNeutralityService } from '../../core/services/net-neutrality.service';
import { NetworkInfoService } from '../../core/services/network-info.service';

Chart.register(...registerables);

@Component({
  selector: 'app-net-neutrality',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './net-neutrality.component.html',
  styleUrl: './net-neutrality.component.scss',
})
export class NetNeutralityComponent implements AfterViewChecked, OnDestroy {
  protected readonly neutrality = inject(NetNeutralityService);
  protected readonly report = this.neutrality.report;
  protected readonly progress = this.neutrality.progress;
  protected readonly history = inject(HistoryService);
  private readonly network = inject(NetworkInfoService);
  private readonly pdf = inject(NetNeutralityPdfService);
  protected readonly includeNetworkIdentity = signal(false);
  protected readonly includePublicIp = signal(false);
  private readonly medianCanvas = viewChild<ElementRef<HTMLCanvasElement>>('medianCanvas');
  private readonly attemptsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('attemptsCanvas');
  private medianChart: Chart<'bar', number[], string> | undefined;
  private attemptsChart: Chart<'line', (number | null)[], string> | undefined;
  private renderedReportId: string | undefined;

  ngAfterViewChecked(): void {
    const report = this.report();
    if (report && this.renderedReportId !== report.id) this.createCharts(report);
    if (!report && this.renderedReportId) this.destroyCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  async start(): Promise<void> {
    this.destroyCharts();
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
    const latest = this.history.entries()[0];
    const info = this.network.info();
    const intelligence = latest?.intelligence;
    this.pdf.download(
      report,
      {
        includeNetworkIdentity: this.includeNetworkIdentity(),
        includePublicIp: this.includePublicIp(),
      },
      {
        protocol: latest?.ip?.protocol,
        effectiveType: info.effectiveType,
        secureContext: info.secureContext,
        isp: intelligence?.companyDetails?.name || intelligence?.organization,
        asn: intelligence?.asnDetails?.asn || intelligence?.asn,
        country: intelligence?.locationDetails?.country || intelligence?.country,
        region: intelligence?.locationDetails?.region || intelligence?.region,
        city: intelligence?.locationDetails?.city || intelligence?.city,
        ipv4: latest?.ip?.ipv4.value?.address,
        ipv6: latest?.ip?.ipv6.value?.address,
      },
      {
        medians: this.medianChart?.toBase64Image(),
        attempts: this.attemptsChart?.toBase64Image(),
      },
    );
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

  private createCharts(report: NetNeutralityReport): void {
    this.destroyCharts();
    const textColor =
      getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#15372a';
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#16824d';
    const palette = ['--metric-download', '--metric-upload', '--metric-latency', '--metric-jitter']
      .map((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim())
      .map((color, index) => color || ['#1682b2', '#d16b32', '#7b61a8', '#208a68'][index]);
    const measured = report.targets.filter((target) => target.medianMs !== undefined);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const medianElement = this.medianCanvas()?.nativeElement;
    if (medianElement) {
      this.medianChart = new Chart(medianElement, {
        type: 'bar',
        data: {
          labels: measured.map((target) => target.name),
          datasets: [
            {
              label: 'Median response (ms)',
              data: measured.map((target) => target.medianMs as number),
              backgroundColor: accent,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reducedMotion ? false : { duration: 250 },
          scales: {
            y: { beginAtZero: true, ticks: { color: textColor } },
            x: { ticks: { color: textColor } },
          },
          plugins: { legend: { labels: { color: textColor } } },
        },
      });
    }
    const attemptsElement = this.attemptsCanvas()?.nativeElement;
    if (attemptsElement) {
      const rounds = report.rounds.map((round) => round.round);
      this.attemptsChart = new Chart(attemptsElement, {
        type: 'line',
        data: {
          labels: rounds.map(String),
          datasets: report.targets.map((target, index) => ({
            label: target.name,
            data: rounds.map((round) => {
              const attempt = target.attempts.find((item) => item.round === round);
              return attempt?.outcome === 'success' ? (attempt.durationMs ?? null) : null;
            }),
            borderColor: palette[index % palette.length],
            tension: 0.15,
            spanGaps: false,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reducedMotion ? false : { duration: 250 },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Response time (ms)', color: textColor },
              ticks: { color: textColor },
            },
            x: {
              title: { display: true, text: 'Round', color: textColor },
              ticks: { color: textColor },
            },
          },
          plugins: { legend: { labels: { color: textColor } } },
        },
      });
    }
    this.renderedReportId = report.id;
  }

  private destroyCharts(): void {
    this.medianChart?.destroy();
    this.attemptsChart?.destroy();
    this.medianChart = undefined;
    this.attemptsChart = undefined;
    this.renderedReportId = undefined;
  }
}
