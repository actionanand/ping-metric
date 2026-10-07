import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { topojson } from 'chartjs-chart-geo';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

export type MapFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
export interface LocationMapData {
  mode: 'world' | 'india';
  features: MapFeature[];
  selected?: MapFeature;
  country: string;
  fallback: boolean;
}

export function normalizeGeography(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,'’()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Canonical values are the inspected NWDP state_name values, including source spellings.
const indiaAliases: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  'delhi nct': 'Delhi',
  pondicherry: 'Puducherry',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  tamilnadu: 'Tamil Nadu',
  'arunachal pradesh': 'Arunanchal Pradesh',
  'andaman and nicobar islands': 'Andaman & Nicobar Island',
  'dadra and nagar haveli and daman and diu': 'Dadra & Nagar Havelli and Daman & Diu',
};
const worldAliases: Record<string, string> = {
  'united states': 'United States of America',
  usa: 'United States of America',
  uk: 'United Kingdom',
  'russian federation': 'Russia',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  'czech republic': 'Czechia',
  'ivory coast': "Côte d'Ivoire",
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'republic of the congo': 'Congo',
  'dominican republic': 'Dominican Rep.',
  'south sudan': 'S. Sudan',
  'central african republic': 'Central African Rep.',
  'equatorial guinea': 'Eq. Guinea',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  eswatini: 'eSwatini',
  'solomon islands': 'Solomon Is.',
};

export function isIndia(countryCode?: string, country?: string): boolean {
  return countryCode?.trim()
    ? countryCode.trim().toUpperCase() === 'IN'
    : ['india', 'republic of india'].includes(normalizeGeography(country ?? ''));
}

// RFC 7946 uses counterclockwise exteriors; the spherical D3 renderer uses clockwise.
// Adapt only ring traversal in a new in-memory feature. Never alter the static asset.
export function indiaRendererFeature(feature: MapFeature): MapFeature {
  const polygon = (rings: Position[][]): Position[][] =>
    rings.map((ring, index) => {
      let twiceArea = 0;
      for (let point = 1; point < ring.length; point++) {
        twiceArea += ring[point - 1][0] * ring[point][1] - ring[point][0] * ring[point - 1][1];
      }
      const reverse = index === 0 ? twiceArea > 0 : twiceArea < 0;
      const copy = ring.map((position) => [...position]);
      return reverse ? copy.reverse() : copy;
    });
  const geometry =
    feature.geometry.type === 'Polygon'
      ? { ...feature.geometry, coordinates: polygon(feature.geometry.coordinates) }
      : { ...feature.geometry, coordinates: feature.geometry.coordinates.map(polygon) };
  return { ...feature, properties: { ...feature.properties }, geometry };
}
export function featureName(feature: MapFeature, mode: 'world' | 'india'): string {
  const name = feature.properties[mode === 'india' ? 'state_name' : 'name'];
  return typeof name === 'string' ? name : '';
}
export function matchIndiaRegion(features: MapFeature[], region?: string): MapFeature | undefined {
  const normalized = normalizeGeography(region ?? '');
  if (!normalized) return undefined;
  const canonical = normalizeGeography(indiaAliases[normalized] ?? normalized);
  return features.find(
    (feature) => normalizeGeography(featureName(feature, 'india')) === canonical,
  );
}
export function matchWorldCountry(
  features: MapFeature[],
  countryCode?: string,
  country?: string,
): MapFeature | undefined {
  const candidates = [country];
  const code = countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    try {
      candidates.push(new Intl.DisplayNames('en', { type: 'region' }).of(code));
    } catch {
      /* Unknown region codes never select an unrelated polygon. */
    }
  }
  for (const name of candidates) {
    if (!name) continue;
    const normalized = normalizeGeography(name);
    const canonical = normalizeGeography(worldAliases[normalized] ?? normalized);
    const match = features.find(
      (feature) => normalizeGeography(featureName(feature, 'world')) === canonical,
    );
    if (match) return match;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isMapFeature(value: unknown): value is MapFeature {
  if (!isRecord(value) || value['type'] !== 'Feature' || !isRecord(value['properties']))
    return false;
  const geometry = value['geometry'];
  return (
    isRecord(geometry) &&
    (geometry['type'] === 'Polygon' || geometry['type'] === 'MultiPolygon') &&
    Array.isArray(geometry['coordinates'])
  );
}

@Service()
export class GeoMapDataService {
  private readonly document = inject(DOCUMENT);
  // Promises cache successful parsing and failures, preventing repeated downloads on input changes.
  private worldPromise?: Promise<MapFeature[]>;
  private indiaPromise?: Promise<MapFeature[]>;
  private readonly indiaRendererCache = new WeakMap<MapFeature[], MapFeature[]>();

  world(): Promise<MapFeature[]> {
    return (this.worldPromise ??= this.json('countries-50m.json').then((data) => {
      if (
        !isRecord(data) ||
        data['type'] !== 'Topology' ||
        !isRecord(data['objects']) ||
        !isRecord(data['objects']['countries']) ||
        !Array.isArray(data['arcs'])
      ) {
        throw new Error('Invalid world topology');
      }
      const topology = data as unknown as Parameters<typeof topojson.feature>[0];
      const countries = data['objects']['countries'] as unknown as Parameters<
        typeof topojson.feature
      >[1];
      const collection: unknown = topojson.feature(topology, countries);
      return this.features(collection, 'name');
    }));
  }

  india(): Promise<MapFeature[]> {
    return (this.indiaPromise ??= this.json('india-states.geojson').then((data) => {
      // The official download is EPSG:7755. Do not mistake metres for geographic degrees.
      if (isRecord(data) && data['crs'])
        throw new Error('India asset must be converted to WGS84 GeoJSON');
      const features = this.features(data, 'state_name');
      const checkCoordinates = (value: unknown): boolean => {
        if (!Array.isArray(value) || !value.length) return false;
        if (typeof value[0] === 'number')
          return (
            typeof value[1] === 'number' &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1]) &&
            Math.abs(value[0]) <= 180 &&
            Math.abs(value[1]) <= 90
          );
        return value.every(checkCoordinates);
      };
      if (
        features.length !== 36 ||
        !features.every((feature) => checkCoordinates(feature.geometry.coordinates))
      ) {
        throw new Error('India asset must contain all 36 state/UT geometries in WGS84');
      }
      if (new Set(features.map((feature) => featureName(feature, 'india'))).size !== 36) {
        throw new Error('India state/UT names must be unique');
      }
      return features;
    }));
  }

  async location(
    countryCode?: string,
    country?: string,
    region?: string,
  ): Promise<LocationMapData> {
    const india = isIndia(countryCode, country);
    if (india) {
      try {
        const canonical = await this.india();
        let features = this.indiaRendererCache.get(canonical);
        if (!features) {
          features = canonical.map(indiaRendererFeature);
          this.indiaRendererCache.set(canonical, features);
        }
        return {
          mode: 'india',
          features,
          selected: matchIndiaRegion(features, region),
          country: 'India',
          fallback: false,
        };
      } catch {
        /* A missing/invalid India asset falls back to the world, never another source. */
      }
    }
    const features = await this.world();
    const selected = matchWorldCountry(
      features,
      india ? 'IN' : countryCode,
      india ? 'India' : country,
    );
    return {
      mode: 'world',
      features,
      selected,
      country: india
        ? 'India'
        : country?.trim() ||
          (selected && featureName(selected, 'world')) ||
          countryCode?.trim() ||
          'Unknown country',
      fallback: india,
    };
  }

  private async json(filename: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(`maps/${filename}`, this.document.baseURI), {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Map asset unavailable (${response.status})`);
      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timeout);
    }
  }
  private features(data: unknown, nameProperty: string): MapFeature[] {
    if (
      !isRecord(data) ||
      data['type'] !== 'FeatureCollection' ||
      !Array.isArray(data['features']) ||
      !data['features'].length ||
      !data['features'].every(isMapFeature) ||
      !data['features'].every(
        (feature: MapFeature) => typeof feature.properties[nameProperty] === 'string',
      )
    ) {
      throw new Error('Invalid map features');
    }
    return data['features'];
  }
}
