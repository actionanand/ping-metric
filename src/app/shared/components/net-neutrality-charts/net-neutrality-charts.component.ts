import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import type { NetNeutralityReport } from '../../../core/models/app.models';
import { ChartLoadingPlaceholderComponent } from '../chart-loading-placeholder/chart-loading-placeholder.component';

Chart.register(...registerables);

export interface NetNeutralityChartImages {
  medians?: string;
  attempts?: string;
}

@Component({
  selector: 'app-net-neutrality-charts',
  imports: [ChartLoadingPlaceholderComponent],
  templateUrl: './net-neutrality-charts.component.html',
  styleUrl: './net-neutrality-charts.component.scss',
})
export class NetNeutralityChartsComponent implements OnDestroy {
  readonly report = input.required<NetNeutralityReport>();
  readonly chartsReady = output<NetNeutralityChartImages>();
  protected readonly loading = signal(true);
  private readonly injector = inject(Injector);
  private readonly host = inject(ElementRef<HTMLElement>);
  private medianChart: Chart<'bar', number[], string> | undefined;
  private attemptsChart: Chart<'line', (number | null)[], string> | undefined;
  private renderedReportId: string | undefined;
  private readonly chartEffect = afterRenderEffect(
    { mixedReadWrite: () => this.renderCharts() },
    { injector: this.injector },
  );

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private renderCharts(): void {
    const report = this.report();
    if (this.renderedReportId === report.id) return;
    this.loading.set(true);
    this.destroyCharts();
    const medianCanvas = this.canvas('.median-chart');
    const attemptsCanvas = this.canvas('.attempts-chart');
    if (!medianCanvas || !attemptsCanvas) return;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text').trim() || '#15372a';
    const accent = styles.getPropertyValue('--accent').trim() || '#16824d';
    const palette = ['--metric-download', '--metric-upload', '--metric-latency', '--metric-jitter']
      .map((token) => styles.getPropertyValue(token).trim())
      .map((color, index) => color || ['#1682b2', '#d16b32', '#7b61a8', '#208a68'][index]);
    const measured = report.targets.filter((target) => target.medianMs !== undefined);

    this.medianChart = new Chart(medianCanvas, {
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
        animation: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: textColor } },
          x: { ticks: { color: textColor } },
        },
        plugins: { legend: { labels: { color: textColor } } },
      },
    });

    const rounds = report.rounds.map((round) => round.round);
    this.attemptsChart = new Chart(attemptsCanvas, {
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
        animation: false,
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

    this.medianChart.resize();
    this.attemptsChart.resize();
    this.medianChart.update('none');
    this.attemptsChart.update('none');
    this.renderedReportId = report.id;
    this.loading.set(false);
    this.chartsReady.emit({
      medians: this.medianChart.toBase64Image(),
      attempts: this.attemptsChart.toBase64Image(),
    });
  }

  private canvas(selector: string): HTMLCanvasElement | undefined {
    const host = this.host.nativeElement as HTMLElement;
    return host.querySelector<HTMLCanvasElement>(selector) ?? undefined;
  }

  private destroyCharts(): void {
    this.medianChart?.destroy();
    this.attemptsChart?.destroy();
    this.medianChart = undefined;
    this.attemptsChart = undefined;
    this.renderedReportId = undefined;
  }
}
