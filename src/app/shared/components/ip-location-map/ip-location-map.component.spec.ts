import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeoMapDataService } from '../../../core/services/geo-map-data.service';
import type { LocationMapData, MapFeature } from '../../../core/services/geo-map-data.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IpLocationMapComponent } from './ip-location-map.component';
import type { ChartConfiguration } from 'chart.js';
import { tooltipFeatureName } from './ip-location-map-tooltip';

const charts = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
  resize: vi.fn(),
  update: vi.fn(),
}));
vi.mock('chart.js', () => ({
  Chart: class {
    static register = vi.fn();
    destroy = charts.destroy;
    resize = charts.resize;
    update = charts.update;
    constructor(...args: unknown[]) {
      charts.create(...args);
    }
  },
  Tooltip: class {},
}));
vi.mock('chartjs-chart-geo', () => ({
  ChoroplethController: class {},
  ColorScale: class {},
  GeoFeature: class {},
  ProjectionScale: class {},
  topojson: {},
}));
const japan: MapFeature = {
  type: 'Feature',
  properties: { name: 'Japan' },
  geometry: { type: 'Polygon', coordinates: [] },
};
const karnataka: MapFeature = { ...japan, properties: { state_name: 'Karnataka' } };
const worldMap: LocationMapData = {
  mode: 'world',
  features: [japan],
  selected: japan,
  country: 'Japan',
  fallback: false,
};

async function renderSettledMap(fixture: ComponentFixture<IpLocationMapComponent>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  // Promise completion updates the map signal; explicitly run the next render
  // so afterRenderEffect has completed before inspecting Chart mock calls.
  fixture.detectChanges();
  await fixture.whenStable();
}

async function createFixture(
  load: () => Promise<LocationMapData>,
  code = 'JP',
  region?: string,
  hidden = false,
) {
  await TestBed.configureTestingModule({
    imports: [IpLocationMapComponent],
    providers: [
      { provide: GeoMapDataService, useValue: { location: vi.fn(load) } },
      { provide: ThemeService, useValue: { preference: () => 'light' } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(IpLocationMapComponent);
  fixture.componentRef.setInput('countryCode', code);
  fixture.componentRef.setInput(
    'country',
    code === 'SG' ? 'Singapore' : code ? (code === 'IN' ? 'India' : 'Japan') : undefined,
  );
  fixture.componentRef.setInput('region', region);
  fixture.componentRef.setInput('regionHidden', hidden);
  await renderSettledMap(fixture);
  return fixture;
}

describe('tooltipFeatureName', () => {
  it.each(['Karnataka', 'Tamil Nadu'])('reads the rendered India feature name %s', (name) => {
    expect(tooltipFeatureName({ feature: { properties: { state_name: name } } }, 'india')).toBe(
      name,
    );
  });
  it.each(['United States of America', 'Japan', 'Singapore'])(
    'reads the rendered world feature name %s',
    (name) => {
      expect(tooltipFeatureName({ feature: { properties: { name } } }, 'world')).toBe(name);
    },
  );
  it.each([undefined, null, {}, '', ' ', 'undefined', 'null', '[object Object]'])(
    'suppresses an invalid feature name (%s)',
    (name) => {
      expect(tooltipFeatureName({ feature: { properties: { name } } }, 'world')).toBe('');
    },
  );
  it('suppresses missing data points, features and properties', () => {
    for (const point of [undefined, null, {}, { feature: {} }]) {
      expect(tooltipFeatureName(point, 'india')).toBe('');
    }
  });
  it('does not expose a state name when interactions are disabled', () => {
    expect(tooltipFeatureName({ feature: karnataka }, 'india', false)).toBe('');
  });
});
describe('IpLocationMapComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });
  it('renders a map after async geometry arrives without needing a checkbox click', async () => {
    const fixture = await createFixture(async () => worldMap);
    expect(charts.create).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Highlighted country: Japan');
    expect(fixture.nativeElement.querySelector('.placeholder')).toBeNull();
  });
  it('highlights Singapore and titles its tooltip from the rendered polygon', async () => {
    const singapore: MapFeature = { ...japan, properties: { name: 'Singapore' } };
    const fixture = await createFixture(
      async () => ({
        mode: 'world',
        features: [japan, singapore],
        selected: singapore,
        country: 'Singapore',
        fallback: false,
      }),
      'SG',
    );
    expect(fixture.nativeElement.textContent).toContain('Highlighted country: Singapore');
    expect(fixture.nativeElement.textContent).not.toContain('Country boundary unavailable');
    expect(fixture.nativeElement.textContent).not.toContain('Country could not be matched');
    const config = charts.create.mock.calls.at(-1)?.[1] as ChartConfiguration<'choropleth'>;
    expect(config.data.datasets[0].data.map((point) => point.value)).toEqual([0, 1]);
    expect(config.plugins?.map((plugin) => plugin.id)).toContain('small-country-locator');
    const title = config.options?.plugins?.tooltip?.callbacks?.title;
    const label = config.options?.plugins?.tooltip?.callbacks?.label;
    if (!title || !label) throw new Error('Explicit tooltip callbacks required');
    expect(Reflect.apply(title, {}, [[{ raw: { feature: singapore }, dataIndex: 1 }]])).toBe(
      'Singapore',
    );
    expect(Reflect.apply(label, {}, [{ dataIndex: 1 }])).toBe('Reported IP location');
  });
  it('titles the hovered polygon rather than the selected region or default formatted label', async () => {
    const tamilNadu: MapFeature = { ...karnataka, properties: { state_name: 'Tamil Nadu' } };
    await createFixture(
      async () => ({
        mode: 'india',
        features: [karnataka, tamilNadu],
        selected: karnataka,
        country: 'India',
        fallback: false,
      }),
      'IN',
      'Karnataka',
    );
    const config = charts.create.mock.calls.at(-1)?.[1] as ChartConfiguration<'choropleth'>;
    const title = config.options?.plugins?.tooltip?.callbacks?.title;
    const label = config.options?.plugins?.tooltip?.callbacks?.label;
    if (!title || !label) throw new Error('Explicit tooltip callbacks required');
    expect(
      Reflect.apply(title, {}, [
        [{ raw: { feature: tamilNadu }, label: 'undefined', dataIndex: 1 }],
      ]),
    ).toBe('Tamil Nadu');
    expect(
      Reflect.apply(title, {}, [
        [{ raw: { feature: karnataka }, label: 'undefined', dataIndex: 0 }],
      ]),
    ).toBe('Karnataka');
    expect(Reflect.apply(label, {}, [{ dataIndex: 0 }])).toBe('Reported IP location');
    expect(Reflect.apply(label, {}, [{ dataIndex: 1 }])).toBe('Not selected');
  });
  it('retains textual location if loading fails', async () => {
    const fixture = await createFixture(async () => {
      throw new Error('Network');
    });
    expect(fixture.nativeElement.textContent).toContain('Japan');
    expect(fixture.nativeElement.textContent).toContain('Map unavailable');
    expect(charts.create).not.toHaveBeenCalled();
  });
  it.each([undefined, 'Delhi NCR', 'NCR', 'National Capital Region'])(
    'shows India with no selection for unavailable administrative region %s',
    async (region) => {
      const fixture = await createFixture(
        async () => ({ mode: 'india', features: [karnataka], country: 'India', fallback: false }),
        'IN',
        region,
      );
      expect(fixture.nativeElement.textContent).toContain('India detected · State/UT unavailable');
      expect(charts.create).toHaveBeenCalledTimes(1);
      const config = charts.create.mock.calls.at(-1)?.[1] as ChartConfiguration<'choropleth'>;
      expect(config.data.datasets[0].data.map((point) => point.value)).toEqual([0]);
    },
  );
  it('does not pass a masked region to geometry resolution', async () => {
    const fixture = await createFixture(
      async () => ({
        mode: 'india',
        features: [karnataka],
        selected: karnataka,
        country: 'India',
        fallback: false,
      }),
      'IN',
      'Karnataka',
      true,
    );
    expect(TestBed.inject(GeoMapDataService).location).toHaveBeenLastCalledWith(
      'IN',
      'India',
      undefined,
    );
    expect(fixture.nativeElement.textContent).toContain('State/UT hidden');
    expect(fixture.nativeElement.textContent).not.toContain('Karnataka');
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-label')).toBe(
      'India administrative map. State or Union Territory details are hidden.',
    );
    const config = charts.create.mock.calls.at(-1)?.[1] as ChartConfiguration<'choropleth'>;
    expect(config.data.labels).not.toContain('Karnataka');
    expect(config.data.datasets[0].data[0].value).toBe(0);
    expect(config.options?.events).toEqual([]);
    expect(config.options?.plugins?.tooltip?.enabled).toBe(false);
    const title = config.options?.plugins?.tooltip?.callbacks?.title;
    if (!title) throw new Error('Explicit tooltip title required');
    expect(Reflect.apply(title, {}, [[{ raw: { feature: karnataka }, dataIndex: 0 }]])).toBe('');
  });
  it('clears a visible state selection and interactions when privacy is enabled', async () => {
    const fixture = await createFixture(
      async () => ({
        mode: 'india',
        features: [karnataka],
        selected: karnataka,
        country: 'India',
        fallback: false,
      }),
      'IN',
      'Karnataka',
    );
    expect(fixture.nativeElement.textContent).toContain('Highlighted state/UT: Karnataka');
    fixture.componentRef.setInput('regionHidden', true);
    fixture.componentRef.setInput('region', undefined);
    await renderSettledMap(fixture);
    expect(fixture.nativeElement.textContent).not.toContain('Karnataka');
    expect(charts.destroy).toHaveBeenCalled();
    const config = charts.create.mock.calls.at(-1)?.[1] as ChartConfiguration<'choropleth'>;
    expect(config.data.datasets[0].data[0].value).toBe(0);
    expect(config.options?.events).toEqual([]);
  });
  it('discards a stale response after country inputs change', async () => {
    let resolveFirst!: (value: LocationMapData) => void;
    const first = new Promise<LocationMapData>((resolve) => {
      resolveFirst = resolve;
    });
    const fixture = await createFixture(() => first);
    vi.mocked(TestBed.inject(GeoMapDataService).location).mockResolvedValue({
      mode: 'india',
      features: [karnataka],
      country: 'India',
      fallback: false,
    });
    fixture.componentRef.setInput('countryCode', 'IN');
    fixture.componentRef.setInput('country', 'India');
    await renderSettledMap(fixture);
    resolveFirst(worldMap);
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Japan');
    expect(fixture.nativeElement.textContent).toContain('India detected');
  });
  it('destroys the previous chart on input changes and destroys the current chart on removal', async () => {
    const fixture = await createFixture(async () => worldMap);
    fixture.componentRef.setInput('country', 'Different provider name');
    await renderSettledMap(fixture);
    expect(charts.destroy).toHaveBeenCalledTimes(1);
    expect(charts.create).toHaveBeenCalledTimes(2);
    expect(charts.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      charts.create.mock.invocationCallOrder[1],
    );
    fixture.destroy();
    expect(charts.destroy).toHaveBeenCalledTimes(2);
  });
  it('does not load geometry without country data', async () => {
    const fixture = await createFixture(async () => worldMap, '');
    fixture.componentRef.setInput('country', undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    charts.create.mockClear();
    const location = vi.mocked(TestBed.inject(GeoMapDataService).location);
    location.mockClear();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(location).not.toHaveBeenCalled();
    expect(charts.create).not.toHaveBeenCalled();
  });
});
