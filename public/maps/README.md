# PingMetric Geographic Map Data

This directory contains static geographic boundary data used by PingMetric's IP-based location highlight map.

PingMetric does not use GPS or browser geolocation for this feature. The map visualizes the approximate country or state already returned by the existing opt-in IP intelligence flow.

## India map

### `india-states.geojson`

Production-ready India state and Union Territory boundary data.

- Format: GeoJSON
- CRS: EPSG:4326 / WGS84
- Features: 36
- State/UT name property: `state_name`
- State/UT code property: `stcode`
- Approximate size: 1.7 MB
- Preparation date: 2026-10-08

The production asset contains all 28 states and 8 Union Territories.

## Source

Dataset: **State Boundary**

Source / distribution:

- Survey of India
- National Water Data Portal (NWDP)
- National Water Informatics Centre
- Government of India

Dataset page:

https://nwdp.nwic.gov.in/dataset/state-boundary

GeoJSON resource used:

https://nwdp.nwic.gov.in/dataset/dd960900-34cc-4486-a95c-83200d2f2c7b/resource/f039e721-132c-4a24-9e5e-07af03064b4d/download/state_nwic_geojson.zip

## Preparation

The official source contained 36 features and used:

`EPSG:7755 — WGS 84 / India NSF LCC`

It was reprojected in WSL2 using GDAL to:

`EPSG:4326 — WGS84 / RFC 7946 GeoJSON`

The full-resolution converted file was approximately 23 MB.

It was then simplified with Mapshaper for browser use:

```bash
npx --yes mapshaper \
  india-states-wgs84.geojson \
  -simplify weighted 10% keep-shapes \
  -filter-fields state_name,stcode \
  -clean \
  -o format=geojson precision=0.00001 \
  india-states.geojson
```

Production size: **1,681,403 bytes**. Feature names and codes were inspected after
preparation. The source portal update recorded during inspection was
2026-10-01 06:37 UTC. Original ZIP member: `state_NWIC.GeoJSON`.

Do not commit the source ZIP, projected source, full-resolution intermediate, or
temporary tool cache. Keep only this production GeoJSON and this attribution
file here. Full preparation/validation/cleanup instructions are in
[the WSL2 preparation guide](../../documentation/india-map-data-preparation-wsl2.md).

Names are preserved from the official source, including `Arunanchal Pradesh` and
`Dadra & Nagar Havelli and Daman & Diu`. The application uses explicit aliases
for provider spelling differences; it never rewrites this file.

The renderer caches a separate in-memory ring-order adaptation for D3's winding
convention. This does not move coordinates, simplify boundaries, or modify the
production GeoJSON. Regional highlighting and tooltips are disabled while
regional details are masked by the existing privacy control.

## World map

Angular copies the installed `world-atlas` 2.0.2 `countries-50m.json` to
`maps/countries-50m.json`. It is derived from Natural Earth 4.1.0 Admin-0
boundaries at 1:50 million scale, unchanged. The 50m dataset includes Singapore,
which the coarser 110m dataset omits. Only the 50m world asset is shipped. See
https://github.com/topojson/world-atlas and https://www.naturalearthdata.com/.
Small countries absent from this dataset are left unselected, not substituted.
