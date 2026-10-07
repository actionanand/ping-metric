import type { Plugin } from 'chart.js';
import type { ProjectionScale } from 'chartjs-chart-geo';
import type { MapFeature } from '../../../core/services/geo-map-data.service';

export const COUNTRY_LOCATOR_MIN_SIZE_PX = 10;
export const COUNTRY_LOCATOR_RADIUS_PX = 7;

export interface ProjectedBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export type CountryProjection = (position: [number, number]) => [number, number] | null;

/** Inspect public geometry without changing any coordinates or ring ordering. */
export function projectFeatureBounds(
  feature: MapFeature | undefined,
  project: CountryProjection,
): ProjectedBounds | undefined {
  const geometry = feature?.geometry;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon'))
    return undefined;
  let bounds: ProjectedBounds | undefined;
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number') {
      const [longitude, latitude]: unknown[] = coordinates;
      if (
        typeof longitude !== 'number' ||
        !Number.isFinite(longitude) ||
        typeof latitude !== 'number' ||
        !Number.isFinite(latitude) ||
        Math.abs(longitude) > 180 ||
        Math.abs(latitude) > 90
      ) {
        return;
      }
      let point: [number, number] | null;
      try {
        point = project([longitude, latitude]);
      } catch {
        return;
      }
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
      const [x, y] = point;
      bounds = bounds
        ? {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y),
          }
        : { minX: x, minY: y, maxX: x, maxY: y };
      return;
    }
    coordinates.forEach(visit);
  };
  visit(geometry.coordinates);
  return bounds;
}

export function shouldShowCountryLocator(bounds: ProjectedBounds | undefined): boolean {
  if (!bounds || !Object.values(bounds).every(Number.isFinite)) return false;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return width >= 0 && height >= 0 && Math.max(width, height) < COUNTRY_LOCATOR_MIN_SIZE_PX;
}

interface CountryLocatorOptions {
  mode: 'world' | 'india';
  feature?: MapFeature;
  accent: string;
  contrast: string;
}

/** Local overlay: no extra dataset, tooltip target, listener or global registration. */
export function createCountryLocatorPlugin(options: CountryLocatorOptions): Plugin<'choropleth'> {
  return {
    id: 'small-country-locator',
    afterDatasetsDraw(chart) {
      if (options.mode !== 'world' || !options.feature) return;
      const scale = chart.scales['projection'] as ProjectionScale | undefined;
      if (typeof scale?.projection !== 'function') return;
      // Recompute after drawing, so the fitted projection and resize dimensions are current.
      const bounds = projectFeatureBounds(options.feature, (position) =>
        scale.projection(position),
      );
      if (!bounds || !shouldShowCountryLocator(bounds)) return;
      const x = (bounds.minX + bounds.maxX) / 2;
      const y = (bounds.minY + bounds.maxY) / 2;
      const area = chart.chartArea;
      if (x < area.left || x > area.right || y < area.top || y > area.bottom) return;
      const ctx = chart.ctx;
      ctx.save();
      try {
        ctx.beginPath();
        ctx.arc(x, y, COUNTRY_LOCATOR_RADIUS_PX, 0, Math.PI * 2);
        ctx.strokeStyle = options.contrast;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = options.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    },
  };
}
