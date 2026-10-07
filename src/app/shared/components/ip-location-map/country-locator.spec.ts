import { describe, expect, it, vi } from 'vitest';
import type { Chart } from 'chart.js';
import type { MapFeature } from '../../../core/services/geo-map-data.service';
import {
  COUNTRY_LOCATOR_MIN_SIZE_PX,
  COUNTRY_LOCATOR_RADIUS_PX,
  createCountryLocatorPlugin,
  projectFeatureBounds,
  shouldShowCountryLocator,
} from './country-locator';
import type { CountryProjection } from './country-locator';

function polygon(name: string, width: number, height: number): MapFeature {
  return {
    type: 'Feature',
    properties: { name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [width, 0],
          [width, height],
          [0, 0],
        ],
      ],
    },
  };
}
const project: CountryProjection = ([x, y]) => [100 + x * 2, 100 + y * 3];

function drawing(
  mode: 'world' | 'india',
  feature?: MapFeature,
  projection: CountryProjection = project,
) {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  };
  const chart = {
    scales: { projection: { projection } },
    chartArea: { left: 0, top: 0, right: 1000, bottom: 500 },
    ctx,
  } as unknown as Chart<'choropleth'>;
  const plugin = createCountryLocatorPlugin({ mode, feature, accent: '#16824d', contrast: '#fff' });
  const draw = () => {
    const hook = plugin.afterDatasetsDraw;
    if (!hook) throw new Error('Drawing hook missing');
    Reflect.apply(hook, plugin, [chart, {}, {}]);
  };
  return { ctx, chart, draw };
}

describe('projected country bounds', () => {
  it('calculates Polygon bounds in projected pixels without mutating geometry', () => {
    const feature = polygon('Example', 4, 2);
    const before = JSON.stringify(feature);
    expect(projectFeatureBounds(feature, project)).toEqual({
      minX: 100,
      minY: 100,
      maxX: 108,
      maxY: 106,
    });
    expect(JSON.stringify(feature)).toBe(before);
  });
  it('includes all MultiPolygon islands and holes in projected bounds', () => {
    const feature: MapFeature = {
      type: 'Feature',
      properties: { name: 'Islands' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 0],
            ],
            [
              [0.5, 0.5],
              [1, 1],
              [0.5, 0.5],
            ],
          ],
          [
            [
              [8, 3],
              [10, 3],
              [10, 4],
              [8, 3],
            ],
          ],
        ],
      },
    };
    expect(projectFeatureBounds(feature, project)).toEqual({
      minX: 100,
      minY: 100,
      maxX: 120,
      maxY: 112,
    });
  });
  it('ignores invalid positions and null, nonfinite or throwing projection results', () => {
    const feature = polygon('Example', 2, 2);
    expect(projectFeatureBounds(feature, () => null)).toBeUndefined();
    expect(projectFeatureBounds(feature, () => [NaN, Infinity])).toBeUndefined();
    expect(
      projectFeatureBounds(feature, () => {
        throw new Error('Unprojectable');
      }),
    ).toBeUndefined();
    const malformed = {
      ...feature,
      geometry: {
        type: 'Polygon',
        coordinates: [[[NaN, 0], [1], [181, 0], null, [1, 2]]],
      },
    } as unknown as MapFeature;
    expect(projectFeatureBounds(malformed, project)).toEqual({
      minX: 102,
      maxX: 102,
      minY: 106,
      maxY: 106,
    });
  });
  it('uses a strict named pixel threshold, not country names or geographic degrees', () => {
    expect(shouldShowCountryLocator({ minX: 0, minY: 0, maxX: 9, maxY: 9 })).toBe(true);
    expect(
      shouldShowCountryLocator({
        minX: 0,
        minY: 0,
        maxX: COUNTRY_LOCATOR_MIN_SIZE_PX,
        maxY: 1,
      }),
    ).toBe(false);
    expect(shouldShowCountryLocator(undefined)).toBe(false);
    expect(shouldShowCountryLocator({ minX: NaN, minY: 0, maxX: 1, maxY: 1 })).toBe(false);
  });
});

describe('chart-local country locator', () => {
  it.each(['Singapore', 'Unnamed small country'])(
    'draws a tiny %s geometry at its projected bounds center',
    (name) => {
      const feature = polygon(name, 0.1, 0.1);
      const before = JSON.stringify(feature);
      const { ctx, draw } = drawing('world', feature);
      draw();
      expect(ctx.arc).toHaveBeenCalledWith(
        expect.closeTo(100.1),
        expect.closeTo(100.15),
        COUNTRY_LOCATOR_RADIUS_PX,
        0,
        Math.PI * 2,
      );
      expect(ctx.stroke).toHaveBeenCalledTimes(2);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(feature)).toBe(before);
    },
  );
  it.each(['United States of America', 'Japan', 'Singapore'])(
    'does not decorate a sufficiently visible %s polygon',
    (name) => {
      const { ctx, draw } = drawing('world', polygon(name, 20, 20));
      draw();
      expect(ctx.arc).not.toHaveBeenCalled();
    },
  );
  it('does not draw without selection or on an India administrative map', () => {
    for (const instance of [drawing('world'), drawing('india', polygon('Karnataka', 0.1, 0.1))]) {
      instance.draw();
      expect(instance.ctx.arc).not.toHaveBeenCalled();
    }
  });
  it('handles a non-projectable feature without drawing or crashing', () => {
    const { ctx, draw } = drawing('world', polygon('Example', 1, 1), () => null);
    expect(draw).not.toThrow();
    expect(ctx.arc).not.toHaveBeenCalled();
  });
  it('reevaluates the current fitted projection on redraw/resize', () => {
    const { ctx, chart, draw } = drawing('world', polygon('Example', 1, 1));
    draw();
    const scale = chart.scales['projection'] as unknown as { projection: CountryProjection };
    scale.projection = ([x, y]) => [x * 100, y * 100];
    draw();
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });
});
