import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Chart, Tooltip } from 'chart.js';
import { ChoroplethController, ColorScale, GeoFeature, ProjectionScale } from 'chartjs-chart-geo';
import type { IChoroplethDataPoint } from 'chartjs-chart-geo';
import { GeoMapDataService, featureName } from '../../../core/services/geo-map-data.service';
import type { LocationMapData } from '../../../core/services/geo-map-data.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ChartLoadingPlaceholderComponent } from '../chart-loading-placeholder/chart-loading-placeholder.component';
import { tooltipFeatureName } from './ip-location-map-tooltip';
import { createCountryLocatorPlugin } from './country-locator';

Chart.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale, Tooltip);

@Component({
  selector: 'app-ip-location-map',
  imports: [ChartLoadingPlaceholderComponent],
  templateUrl: './ip-location-map.component.html',
  styleUrl: './ip-location-map.component.scss',
})
export class IpLocationMapComponent implements OnDestroy {
  readonly countryCode = input<string>();
  readonly country = input<string>();
  readonly region = input<string>();
  readonly regionHidden = input(false);
  private readonly geometry = inject(GeoMapDataService);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('mapCanvas');
  protected readonly map = signal<LocationMapData | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  private readonly systemDark = signal(false);
  private chart?: Chart<'choropleth', IChoroplethDataPoint[], string>;
  protected readonly locationText = computed(() => {
    const country =
      this.map()?.country ||
      this.country()?.trim() ||
      this.countryCode()?.trim() ||
      'Unknown country';
    const region = this.regionHidden() ? undefined : this.region()?.trim();
    return region ? `${region}, ${country}` : country;
  });
  protected readonly selectionText = computed(() => {
    const map = this.map();
    if (!map) return 'Map unavailable · Text location retained';
    if (map.mode === 'india') {
      if (this.regionHidden()) return 'India detected · State/UT hidden';
      return map.selected
        ? `Highlighted state/UT: ${featureName(map.selected, 'india')}`
        : 'India detected · State/UT unavailable';
    }
    return map.selected
      ? `Highlighted country: ${featureName(map.selected, 'world')}`
      : 'Country boundary unavailable · No region highlighted';
  });
  protected readonly canvasDescription = computed(() =>
    this.map()?.mode === 'india' && this.regionHidden()
      ? 'India administrative map. State or Union Territory details are hidden.'
      : `${this.map()?.mode === 'india' ? 'India administrative' : 'World'} map. ${this.selectionText()}. Approximate location reported for the current public IP, not device location.`,
  );
  protected readonly interactionAllowed = computed(
    () => this.map()?.mode !== 'india' || !this.regionHidden(),
  );

  constructor() {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      this.systemDark.set(media.matches);
      const update = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
      media.addEventListener('change', update);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', update));
    }
    effect((onCleanup) => {
      const code = this.countryCode();
      const country = this.country();
      const hidden = this.regionHidden();
      const region = hidden ? undefined : this.region();
      let current = true;
      this.destroyChart();
      this.map.set(undefined);
      this.unavailable.set(false);
      this.loading.set(Boolean(code?.trim() || country?.trim()));
      onCleanup(() => {
        current = false;
      });
      if (!code?.trim() && !country?.trim()) return;
      void this.geometry
        .location(code, country, region)
        .then((map) => {
          if (current) {
            // Each completed request is a fresh render snapshot, even if a data source
            // returns the same cached object after the previous chart was destroyed.
            this.map.set({
              ...map,
              selected: hidden && map.mode === 'india' ? undefined : map.selected,
            });
          }
        })
        .catch(() => {
          if (current) {
            this.unavailable.set(true);
            this.loading.set(false);
          }
        });
    });
    // Render only after the canvas and signal-driven view exist, not on an unrelated click.
    afterRenderEffect(() => {
      const map = this.map();
      const canvas = this.canvas()?.nativeElement;
      const interactionAllowed = this.interactionAllowed();
      this.theme.preference();
      this.systemDark();
      this.destroyChart();
      if (!map || !canvas) return;
      try {
        const selected = map.mode === 'india' && this.regionHidden() ? undefined : map.selected;
        const css = getComputedStyle(canvas);
        const accent = css.getPropertyValue('--accent').trim();
        const neutral = css.getPropertyValue('--metric-neutral-soft').trim();
        const border = css.getPropertyValue('--muted').trim();
        const text = css.getPropertyValue('--text').trim();
        const surface = css.getPropertyValue('--surface').trim();
        this.chart = new Chart(canvas, {
          type: 'choropleth',
          plugins: [
            createCountryLocatorPlugin({
              mode: map.mode,
              feature: selected,
              accent,
              contrast: surface,
            }),
          ],
          data: {
            labels: map.features.map((feature) =>
              interactionAllowed ? featureName(feature, map.mode) : 'State/UT details hidden',
            ),
            datasets: [
              {
                label: 'Approximate IP location',
                outline: map.mode === 'india' ? map.features : undefined,
                data: map.features.map((feature) => ({
                  feature,
                  value: feature === selected ? 1 : 0,
                })),
                backgroundColor: map.features.map((feature) =>
                  feature === selected ? accent : neutral,
                ),
                borderColor: map.features.map((feature) =>
                  feature === selected ? accent : border,
                ),
                borderWidth: map.features.map((feature) => (feature === selected ? 2 : 0.6)),
                hoverBackgroundColor: accent,
                hoverBorderColor: text,
                hoverBorderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            showOutline: false,
            events: interactionAllowed
              ? ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove']
              : [],
            scales: {
              projection: {
                axis: 'x',
                projection: map.mode === 'india' ? 'mercator' : 'naturalEarth1',
                padding: 8,
              },
              color: {
                axis: 'x',
                display: false,
                min: 0,
                max: 1,
                interpolate: (value) => (value === 1 ? accent : neutral),
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: interactionAllowed,
                backgroundColor: surface,
                titleColor: text,
                bodyColor: text,
                borderColor: border,
                borderWidth: 1,
                displayColors: false,
                callbacks: {
                  title: (items) => {
                    const item = items[0];
                    const allowed =
                      interactionAllowed && !(map.mode === 'india' && this.regionHidden());
                    return tooltipFeatureName(
                      item?.raw ?? (item && item.dataset.data[item.dataIndex]),
                      map.mode,
                      allowed,
                    );
                  },
                  label: (item) =>
                    !interactionAllowed || (map.mode === 'india' && this.regionHidden())
                      ? ''
                      : map.features[item.dataIndex] === selected
                        ? 'Reported IP location'
                        : 'Not selected',
                },
              },
            },
          },
        });
        this.chart.resize();
        this.chart.update('none');
        this.unavailable.set(false);
        this.loading.set(false);
      } catch {
        this.destroyChart();
        this.unavailable.set(true);
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }
  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }
}
