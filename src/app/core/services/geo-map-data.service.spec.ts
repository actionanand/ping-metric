import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GeoMapDataService,
  featureName,
  indiaRendererFeature,
  isIndia,
  matchIndiaRegion,
  matchWorldCountry,
  normalizeGeography,
} from './geo-map-data.service';
import type { MapFeature } from './geo-map-data.service';

function feature(name: string, india = false): MapFeature {
  return {
    type: 'Feature',
    properties: { [india ? 'state_name' : 'name']: name },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [70, 10],
          [71, 10],
          [71, 11],
          [70, 10],
        ],
      ],
    },
  };
}
const world = [
  'United States of America',
  'United Kingdom',
  'Japan',
  'Germany',
  'Australia',
  'India',
  'Singapore',
].map((name) => feature(name));
const india = [
  'Karnataka',
  'Tamil Nadu',
  'Delhi',
  'Puducherry',
  'Odisha',
  'Uttarakhand',
  'Jammu & Kashmir',
  'Andaman & Nicobar Island',
  'Dadra & Nagar Havelli and Daman & Diu',
  'Arunanchal Pradesh',
  'Lakshadweep',
].map((name) => feature(name, true));

describe('geographic matching', () => {
  it.each(['US', 'GB', 'JP', 'DE', 'AU', 'SG'])(
    'matches alpha-2 %s via an English country name, not a numeric ID',
    (code) => {
      expect(matchWorldCountry(world, code)).toBeDefined();
    },
  );
  it('matches Singapore exactly, with or without the provider country name', () => {
    expect(matchWorldCountry(world, 'SG', 'Singapore')?.properties['name']).toBe('Singapore');
    expect(matchWorldCountry(world, 'SG')?.properties['name']).toBe('Singapore');
  });
  it('does not substitute a neighbour if a boundary is unavailable', () => {
    expect(
      matchWorldCountry(
        world.filter((item) => item.properties['name'] !== 'Singapore'),
        'SG',
        'Singapore',
      ),
    ).toBeUndefined();
  });
  it('prefers exact provider names and rejects substrings', () => {
    expect(featureName(matchWorldCountry(world, 'DE', 'Japan')!, 'world')).toBe('Japan');
    expect(matchWorldCountry(world, undefined, 'United')).toBeUndefined();
  });
  it('detects India by code first, falling back to its name only without a code', () => {
    expect(isIndia(' in ', 'Other')).toBe(true);
    expect(isIndia(undefined, ' India ')).toBe(true);
    expect(isIndia(undefined, ' Republic  of India ')).toBe(true);
    expect(isIndia('US', 'India')).toBe(false);
    expect(isIndia(undefined, 'Indian Ocean')).toBe(false);
  });
  it.each([
    ['Karnataka', 'Karnataka'],
    ['Tamilnadu', 'Tamil Nadu'],
    ['NCT of Delhi', 'Delhi'],
    ['National Capital Territory of Delhi', 'Delhi'],
    ['Delhi NCT', 'Delhi'],
    ['Pondicherry', 'Puducherry'],
    ['Orissa', 'Odisha'],
    ['Uttaranchal', 'Uttarakhand'],
    ['Jammu and Kashmir', 'Jammu & Kashmir'],
    ['Andaman & Nicobar Islands', 'Andaman & Nicobar Island'],
    ['Dadra & Nagar Haveli & Daman & Diu', 'Dadra & Nagar Havelli and Daman & Diu'],
    ['Arunachal Pradesh', 'Arunanchal Pradesh'],
    ['Lakshadweep', 'Lakshadweep'],
    ['Andaman & Nicobar Island', 'Andaman & Nicobar Island'],
  ])('resolves %s to the inspected official name %s', (value, name) => {
    expect(featureName(matchIndiaRegion(india, value)!, 'india')).toBe(name);
  });
  it('does not guess an unknown state/UT', () => {
    expect(matchIndiaRegion(india, 'Karnatak')).toBeUndefined();
    expect(matchIndiaRegion(india)).toBeUndefined();
    expect(normalizeGeography(' Jammu  & Kashmir ')).toBe('jammu and kashmir');
  });
  it('adapts exterior/hole winding for rendering without mutating the input feature', () => {
    const exterior = [
      [70, 10],
      [71, 10],
      [71, 11],
      [70, 10],
    ];
    const hole = [...exterior].reverse();
    const polygon: MapFeature = {
      ...feature('Karnataka', true),
      geometry: {
        type: 'Polygon',
        coordinates: [exterior, hole],
      },
    };
    const before = JSON.stringify(polygon);
    const adapted = indiaRendererFeature(polygon);
    expect(adapted.geometry.coordinates[0]).toEqual([...polygon.geometry.coordinates[0]].reverse());
    expect(adapted.geometry.coordinates[1]).toEqual([...polygon.geometry.coordinates[1]].reverse());
    expect(JSON.stringify(polygon)).toBe(before);
    expect(indiaRendererFeature(adapted)).toEqual(adapted);
  });
  it('preserves MultiPolygon hierarchy, islands, holes, names and codes in an independent copy', () => {
    const exterior = [
      [70, 10],
      [71, 10],
      [71, 11],
      [70, 10],
    ];
    const hole = [...exterior].reverse();
    const source: MapFeature = {
      type: 'Feature',
      properties: { state_name: 'Lakshadweep', stcode: '31' },
      geometry: { type: 'MultiPolygon', coordinates: [[exterior, hole], [exterior]] },
    };
    const before = JSON.stringify(source);
    const rendered = indiaRendererFeature(source);
    expect(rendered.geometry.type).toBe('MultiPolygon');
    if (rendered.geometry.type !== 'MultiPolygon') throw new Error('Hierarchy changed');
    expect(rendered.geometry.coordinates.map((polygon) => polygon.length)).toEqual([2, 1]);
    expect(rendered.properties).toEqual(source.properties);
    rendered.geometry.coordinates[0][0][0][0] = 99;
    rendered.properties['state_name'] = 'Renderer-only mutation';
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('GeoMapDataService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });
  it('caches world loading/parsing and uses the deployment base URI', async () => {
    const base = document.createElement('base');
    base.href = 'https://example.test/ping-metric/';
    document.head.append(base);
    try {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'Topology',
          objects: {
            countries: {
              type: 'GeometryCollection',
              geometries: [{ type: 'Polygon', arcs: [[0]], properties: { name: 'Japan' } }],
            },
          },
          arcs: [
            [
              [0, 0],
              [1, 0],
              [0, 1],
              [-1, -1],
            ],
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const service = TestBed.inject(GeoMapDataService);
      const first = await service.world();
      expect(await service.world()).toBe(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        'https://example.test/ping-metric/maps/countries-50m.json',
      );
    } finally {
      base.remove();
    }
  });
  it('caches India loading and retains India mode without a matched state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: Array.from({ length: 36 }, (_, index) =>
            feature(index ? `State ${index}` : 'Karnataka', true),
          ),
        }),
      }),
    );
    const service = TestBed.inject(GeoMapDataService);
    expect(
      (await service.location('IN', 'India', 'Karnataka')).selected?.properties['state_name'],
    ).toBe('Karnataka');
    expect(await service.location('IN', 'India', 'Unknown')).toMatchObject({
      mode: 'india',
      selected: undefined,
      fallback: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      new URL('maps/india-states.geojson', document.baseURI).href,
    );
  });
  it.each([
    ['US', 'United States', 'United States of America'],
    ['JP', 'Japan', 'Japan'],
    ['SG', 'Singapore', 'Singapore'],
    ['SG', undefined, 'Singapore'],
  ])('resolves %s in world mode without loading India', async (code, country, selected) => {
    const service = TestBed.inject(GeoMapDataService);
    vi.spyOn(service, 'world').mockResolvedValue(world);
    const indiaLoad = vi.spyOn(service, 'india');
    const result = await service.location(code, country);
    expect(result.mode).toBe('world');
    expect(result.selected?.properties['name']).toBe(selected);
    expect(indiaLoad).not.toHaveBeenCalled();
  });
  it.each([
    ['Karnataka', 'Karnataka'],
    ['Tamil Nadu', 'Tamil Nadu'],
    ['Lakshadweep', 'Lakshadweep'],
    ['Arunachal Pradesh', 'Arunanchal Pradesh'],
    ['NCT of Delhi', 'Delhi'],
    ['Jammu and Kashmir', 'Jammu & Kashmir'],
    ['Andaman and Nicobar Islands', 'Andaman & Nicobar Island'],
    ['Dadra and Nagar Haveli and Daman and Diu', 'Dadra & Nagar Havelli and Daman & Diu'],
  ])('selects %s in India mode without loading world geometry', async (region, selected) => {
    const service = TestBed.inject(GeoMapDataService);
    vi.spyOn(service, 'india').mockResolvedValue(india);
    const worldLoad = vi.spyOn(service, 'world');
    const result = await service.location('IN', 'India', region);
    expect(result).toMatchObject({ mode: 'india', fallback: false });
    expect(result.selected?.properties['state_name']).toBe(selected);
    expect(worldLoad).not.toHaveBeenCalled();
  });
  it('falls back to a world India selection after an India asset failure', async () => {
    const service = TestBed.inject(GeoMapDataService);
    vi.spyOn(service, 'india').mockRejectedValue(new Error('Unavailable'));
    vi.spyOn(service, 'world').mockResolvedValue(world);
    expect(await service.location('IN', 'India', 'Karnataka')).toMatchObject({
      mode: 'world',
      country: 'India',
      selected: world[5],
      fallback: true,
    });
  });
  it('caches renderer copies separately from canonical India geometry', async () => {
    const service = TestBed.inject(GeoMapDataService);
    vi.spyOn(service, 'india').mockResolvedValue(india);
    const before = JSON.stringify(india);
    const first = await service.location('IN', 'India', 'Karnataka');
    const second = await service.location('IN', 'India', 'Tamil Nadu');
    expect(first.features).toBe(second.features);
    expect(first.features).not.toBe(india);
    expect(JSON.stringify(india)).toBe(before);
  });
  it('rejects projected India geometry instead of rendering metres as degrees', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          crs: { type: 'name', properties: { name: 'EPSG:7755' } },
          features: india,
        }),
      }),
    );
    await expect(TestBed.inject(GeoMapDataService).india()).rejects.toThrow('WGS84');
  });
  it('reports a world failure without retrying on each render', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
    const service = TestBed.inject(GeoMapDataService);
    await expect(service.world()).rejects.toThrow();
    await expect(service.world()).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
