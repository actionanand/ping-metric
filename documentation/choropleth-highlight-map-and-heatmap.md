# Choropleth, Highlight Maps, and Heatmaps in PingMetric

## Purpose

PingMetric can use map visualizations to make provider-reported IP location easier to understand. The current requirement is not to calculate a geographic density surface; it is to visually highlight the country, and for India, the state or Union Territory reported by IP intelligence.

For this reason, PingMetric should implement a **geographic highlight map** using choropleth-capable map rendering. A true heatmap is a different visualization and is not appropriate for a single current IP location.

## Terminology

### Choropleth map

A choropleth map colors geographic regions according to a numeric value.

Examples:

- average download speed by country,
- median latency by state,
- number of completed tests by region,
- packet-loss percentage by district.

A choropleth normally has a quantitative scale:

```text
low value  -> lighter/less intense fill
high value -> darker/more intense fill
```

The color represents a measured value associated with each geographic polygon.

### Highlight map

A highlight map emphasizes one or more selected geographic regions without implying a numeric scale.

Examples:

- highlight the country detected from the current public IP,
- highlight Karnataka when the IP provider reports Karnataka,
- show all Indian state/UT boundaries while emphasizing the detected state.

PingMetric's current location feature is a **highlight map**, not a quantitative choropleth, even though `chartjs-chart-geo` can use its choropleth controller to draw it.

The implementation should avoid displaying a numeric color legend when there is no numeric metric.

### Heatmap

A heatmap represents intensity or density across space. Geographic heatmaps normally require many observations, often represented by coordinates or grid cells.

Examples:

- concentration of speed tests across a city,
- density of high-latency observations,
- repeated measurements clustered around geographic coordinates.

A heatmap is not suitable for the current PingMetric use case because a single provider-reported IP location does not provide enough observations to form an intensity surface.

## Choropleth vs Highlight Map vs Heatmap

| Visualization | Geographic boundaries                          | Requires many values                 | Current PingMetric use                 |
| ------------- | ---------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Choropleth    | Yes                                            | Usually one numeric value per region | Possible future analytics              |
| Highlight map | Yes                                            | No                                   | **Recommended now**                    |
| Heatmap       | Not necessarily; usually coordinate/grid based | Yes                                  | Not recommended for current location   |
| Marker map    | Optional                                       | No                                   | Not needed for approximate IP location |

## Recommended PingMetric Behavior

The map must depend only on already-available IP intelligence. It must not request GPS, browser geolocation, or a new location permission.

```text
IP intelligence OFF
    -> do not show a location map

IP intelligence ON, but no usable country
    -> hide the map

Country is not India
    -> show a world map
    -> highlight the detected country

Country is India and state/UT is recognized
    -> show an India-only administrative map
    -> display all state/UT boundaries
    -> highlight the detected state/UT

Country is India but state/UT is missing or cannot be matched
    -> still show the India state/UT map
    -> do not guess a state
    -> show "India detected; state/UT unavailable"

India map data fails to load
    -> gracefully fall back to the world map with India highlighted when possible

World map data fails to load
    -> show the textual IP-location summary only
```

Using the India-specific map whenever the country is India is preferable to switching back to a generic world map when the state is unknown. It keeps the visual consistent and avoids implying a state that was not reported.

## Data Sources

### World boundaries

PingMetric already depends on:

```text
world-atlas 2.0.2
```

`world-atlas` provides Natural Earth Admin-0 country boundaries as TopoJSON. PingMetric uses `countries-50m.json` for improved small-country coverage; the coarser 110m dataset omits Singapore. See the runtime documentation for loading and rendering details.

The `chartjs-chart-geo` package exposes TopoJSON conversion support, so PingMetric does not need to add a direct `topojson-client` import merely to convert the world atlas for the map.

Recommended asset setup:

```text
node_modules/world-atlas/countries-50m.json
        ↓ copied by Angular assets configuration
public build output maps/countries-50m.json (resolved relative to the app base href)
```

Loading geometry as a static asset keeps the map data out of the initial application JavaScript bundle.

### India state and Union Territory boundaries

For India, prefer an official Government of India source rather than an outdated npm SVG package.

Recommended source:

**National Water Data Portal (NWDP), National Water Informatics Centre — State Boundary dataset**

Data producer shown by NWDP:

```text
Survey of India
```

The dataset provides the boundaries of India's states and Union Territories and includes a downloadable GeoJSON resource.

Source page:

```text
https://nwdp.nwic.gov.in/dataset/state-boundary
```

GeoJSON download resource:

```text
https://nwdp.nwic.gov.in/dataset/dd960900-34cc-4486-a95c-83200d2f2c7b/resource/f039e721-132c-4a24-9e5e-07af03064b4d/download/state_nwic_geojson.zip
```

At the time this design was prepared, NWDP showed the dataset as updated on 1 October 2026.

The NWDP copyright policy permits material on the site to be reproduced free of charge provided it is reproduced accurately, is not used misleadingly, and the source is prominently acknowledged; separately identified third-party copyright material requires the copyright holder's authorization.

Before committing the boundary asset:

1. Download the official GeoJSON resource.
2. Inspect the actual feature properties and state/UT names.
3. Confirm it contains the expected current state/UT set.
4. Simplify geometry only if necessary for web performance.
5. Do not alter political boundaries by hand.
6. Preserve a source/attribution note in the repository.

Recommended local asset:

```text
public/maps/india-states.geojson
```

Recommended attribution file:

```text
public/maps/README.md
```

The README should record:

- source organization,
- dataset name,
- source URL,
- download date,
- source update date,
- any simplification performed,
- attribution/copyright-policy reference.

## Why `@svg-maps/india` Is Not Needed

The map is not drawn from text labels. GeoJSON contains polygon and multipolygon coordinates describing actual geographic boundaries.

Conceptually:

```text
GeoJSON coordinates
        ↓
chartjs-chart-geo projection
        ↓
Canvas map
        ↓
all state/UT polygons drawn
        ↓
matched region receives selected styling
```

The user sees a graphical map. The GeoJSON is only the geometry data behind it.

## Proposed Angular Architecture

Create a small reusable standalone component:

```text
src/app/shared/components/ip-location-map/
  ip-location-map.component.ts
  ip-location-map.component.html
  ip-location-map.component.scss
  ip-location-map.component.spec.ts
```

Suggested inputs:

```ts
countryCode?: string;
country?: string;
region?: string;
```

Optionally create a geometry/data helper service:

```text
src/app/core/services/geo-map-data.service.ts
```

Responsibilities:

- load and cache world TopoJSON,
- load and cache India GeoJSON,
- convert world TopoJSON to GeoJSON features,
- normalize/match country names,
- normalize/match India region names,
- expose loading/failure state without repeated network requests.

The data service should cache the static asset promises so navigation or signal updates do not repeatedly download the same geometry.

## Lazy Loading

Map code and geometry should not increase the initial dashboard work unnecessarily.

Only render/load the map when:

```text
IP intelligence enabled
AND
usable country information exists
```

A deferred standalone Angular component is appropriate.

Example concept:

```html
@if (shouldShowLocationMap()) { @defer {
<app-ip-location-map
  [countryCode]="countryCodeValue()"
  [country]="countryValue()"
  [region]="regionValue()"
/>
} @placeholder {
<div>Preparing location map…</div>
} }
```

Do not create a tight reactive loop while loading or updating the map.

Destroy old Chart.js instances before replacing them.

## World Map Matching

`world-atlas` country features use numeric ISO identifiers plus country names, while IP providers often return ISO alpha-2 codes such as:

```text
IN
US
GB
JP
```

Do not assume the alpha-2 code is directly equal to the `world-atlas` feature ID.

A robust implementation should:

1. use the IP provider's country code and country name,
2. derive an English display name from the alpha-2 code where supported,
3. normalize case, safe punctuation and whitespace for comparison,
4. maintain a small explicit alias table for known Natural Earth/world-atlas naming differences,
5. never highlight a different country merely because of a partial/fuzzy match.

If matching fails, retain the textual country result and show the map without a selected polygon or hide the map according to the final UI decision.

## India Region Normalization

Provider names may differ from boundary-data names. Normalize before matching, but never use loose fuzzy matching that could select the wrong region.

Useful aliases may include:

```text
NCT of Delhi
National Capital Territory of Delhi
Delhi NCT
    -> Delhi

Pondicherry
    -> Puducherry

Orissa
    -> Odisha

Uttaranchal
    -> Uttarakhand

Jammu & Kashmir
Jammu and Kashmir
    -> Jammu & Kashmir

Andaman & Nicobar Islands
Andaman and Nicobar Islands
    -> Andaman & Nicobar Island

Dadra & Nagar Haveli & Daman & Diu
    -> Dadra & Nagar Havelli and Daman & Diu

Arunachal Pradesh
    -> Arunanchal Pradesh

Tamilnadu
    -> Tamil Nadu
```

The final aliases must be based on the actual property values found in the chosen official GeoJSON.

The application must not invent a state when the provider returns an unknown or ambiguous region.

## Styling

For a highlight map:

- use a neutral fill for unselected regions,
- use the application accent only for the detected region,
- retain visible geographic borders,
- avoid a choropleth numeric color scale,
- keep the map readable in light and dark themes,
- clearly distinguish selected and unselected polygons,
- do not use red/green alone to convey selection.

Suggested textual summary:

```text
Approximate IP-based location
Karnataka, India

Highlighted region: Karnataka
```

For a non-India location:

```text
Approximate IP-based location
Japan

Highlighted country: Japan
```

## Tooltips and Interaction

Desktop:

- hovering a polygon may show its geographic name.

Touch/mobile:

- tapping a polygon should show/persist its name.

The detected country/state should always be available in visible text outside the map. Hover must never be the only way to learn the selected region.

No navigation or external map link is required for the first implementation.

## Accessibility

The canvas is supplemental. The location must also be expressed as normal text.

Provide:

- a concise map heading,
- visible detected country/state text,
- an accessible canvas label,
- a non-canvas textual fallback,
- sufficient border/fill contrast,
- no meaning communicated only by color.

Example accessible description:

```text
India administrative map. Karnataka is highlighted as the approximate region reported for the current public IP.
```

If the region is unavailable:

```text
India administrative map. The IP provider reported India but no state or Union Territory could be matched.
```

## Privacy

The map must not create a new location lookup.

It should consume only the existing opt-in IP intelligence result:

```text
public IP
    -> ipapi.is only when user enabled IP intelligence
    -> country / region result
    -> local static boundary geometry
    -> map rendering
```

Do not request:

- GPS,
- `navigator.geolocation`,
- precise device coordinates,
- browser location permission,
- a second IP-location provider.

The geographic boundary files themselves are static assets and contain no user data.

## Performance

Prefer:

- `countries-50m.json` for the world view,
- a simplified but accurate India GeoJSON if the official file is unnecessarily detailed,
- lazy/deferred map component loading,
- cached asset loading,
- a single Chart.js instance per visible map,
- `chart.destroy()` during re-render/destruction.

Do not repeatedly parse geographic assets on every Angular change-detection cycle.

## Tests

At minimum, cover:

### Visibility

```text
IP intelligence OFF
-> map absent

IP intelligence ON + no country
-> map absent

IP intelligence ON + non-India country
-> world mode

IP intelligence ON + India
-> India mode
```

### Selection

```text
US / United States
-> correct world feature selected

JP / Japan
-> correct world feature selected

IN + Karnataka
-> Karnataka selected

IN + Tamil Nadu
-> Tamil Nadu selected

IN + NCT of Delhi
-> Delhi selected

IN + unknown region
-> India map rendered, no incorrect state selected
```

### Failure handling

```text
India asset fails
-> world fallback or textual fallback, no crash

World asset fails
-> textual location remains, no crash
```

### Lifecycle

```text
input changes
-> old Chart.js instance destroyed

component destroyed
-> chart destroyed

repeat render
-> no duplicate canvases/listeners
```

## When a Real Choropleth Would Make Sense

A future PingMetric analytics view could use a true choropleth if the application has a meaningful numeric value per region.

For example:

```text
State              Median latency
Karnataka          31 ms
Tamil Nadu         38 ms
Kerala             44 ms
```

Then each state could be colored according to latency.

That is different from the current location map because the current map has one selected region rather than a region-by-region numeric dataset.

## When a Heatmap Would Make Sense

A future heatmap would require multiple observations with geographic coordinates or cells, for example:

```text
test 1 -> coordinate/cell A -> 20 ms
test 2 -> coordinate/cell A -> 24 ms
test 3 -> coordinate/cell B -> 80 ms
...
```

The application could then display a density/intensity surface.

However, collecting and retaining many geographic observations changes the privacy model significantly. PingMetric should not implement a location heatmap merely for visual effect.

For the current app, a state/country highlight map is simpler, clearer, more accurate to the available data, and more privacy-preserving.

## Recommended Attribution

A small documentation attribution is sufficient for the first implementation:

```text
India administrative boundary data: Survey of India,
distributed through the National Water Data Portal (NWIC),
Government of India.
```

Add the source page and download/update information to `public/maps/README.md`.

For the world map, document:

```text
World boundary geometry: world-atlas 2.0.2,
derived from Natural Earth Admin-0 data.
```

## Maintenance

Boundary datasets can change.

Recommended maintenance:

- record the India dataset download/update date,
- review the official source periodically,
- replace the local asset when administrative boundaries change,
- keep normalization aliases in tests,
- never silently switch to an unrelated map package because a source URL is temporarily unavailable.

The map should remain a visual representation of provider-reported approximate IP location, not a claim of precise physical device location.
