# IP location maps — runtime implementation

PingMetric shows a geographic highlight, not a heatmap or numeric choropleth.
See [the visualization concepts](choropleth-highlight-map-and-heatmap.md) for
definitions and [India data preparation](india-map-data-preparation-wsl2.md)
for the completed source-conversion workflow.

## Loading and lifecycle

The map is an implicit standalone component, referenced by Dashboard only in its
Angular `imports` metadata and an `@defer (on viewport)` template block. No
dashboard instance query or geometry-service import forces eager map loading.
The block exists only while intelligence is enabled, not loading, and has a
nonblank country/code. Disabling intelligence removes the component. Geometry
is never imported into TypeScript or fetched before the component is created.

`GeoMapDataService` fetches these assets relative to `document.baseURI`, preserving
GitHub Pages `/ping-metric/` deployment paths:

- `maps/countries-50m.json`, copied from installed world-atlas by Angular.
- `maps/india-states.geojson`, copied from public/maps by the existing asset rule.

Only the needed mode is fetched. World geometry is not fetched for India unless
its asset fails. Concurrent/subsequent requests share one promise per dataset,
including parsing, TopoJSON conversion and India rendering adaptation. Failures
are cached for the page session to prevent repeated failed requests on privacy
changes; reload to retry after restoring connectivity. Each fetch/parsing request
has a 15-second timeout.

`afterRenderEffect` creates the chart after the canvas and async geometry exist,
without depending on another user click. Obsolete responses are ignored. Old
charts are destroyed before input/theme rerenders and on component removal.
System-theme event listeners are removed on destruction. Theme changes read
current CSS colors. No render effect reads the loading signal it writes.

## Selection and failures

- Non-India: world map; safely matched country highlighted.
- India with recognized state/UT: all 36 administrative features; one highlighted.
- Unknown/missing Indian state: keep the India map, select nothing, and show
  **India detected · State/UT unavailable**. Never guess or switch modes for this.
- India asset failure: world map with India highlighted if matched, with a clear
  administrative-map-unavailable notice.
- World asset/render failure: keep location text and a compact unavailable message.

There is no numeric legend. Selection uses the accent, thicker borders and
permanent text, not color alone. The responsive map is height-bounded and has
an accessible canvas description. Hover/tap is supplemental, never required.

## Matching

India detection prefers exact normalized `IN`. Without a code, exact `India` or
`Republic of India` is accepted. A conflicting non-India code takes precedence.
World matching tries provider name, English `Intl.DisplayNames` for alpha-2 codes,
normalized exact names and explicit Natural Earth aliases. Numeric world-atlas
IDs are never compared with alpha-2 codes. The 50m dataset includes Singapore
and offers better small-country coverage than 110m while remaining a deferred
static asset (756,420 bytes). Unavailable boundaries remain unselected, never
replaced by neighbours; the message says “Country boundary unavailable” rather
than implying that IP intelligence failed. Very small polygons can still be
hard to see at full-world scale. The real polygon keeps its accent fill and border.
A chart-local minimum-visibility locator draws a static, unfilled 7px-radius halo
only when the selected country's entire projected geometry is smaller than 10px
in both dimensions. Its center comes from projected country bounds using the
renderer's fitted projection, recalculated after drawing/resizing. It is not an
IP-coordinate/device-location pin and uses no provider coordinates. No halo is
drawn for India state/UT maps, absent selections, or sufficiently large countries.
It adds no tooltip target or dataset; existing polygon tooltips remain unchanged.
Browser visibility needs manual verification at the device's actual display size.

Indian normalization trims/collapses whitespace, lowercases, normalizes safe
punctuation and treats ampersands as “and”. Explicit aliases:

| Provider name(s)                                                 | Official `state_name` target          |
| ---------------------------------------------------------------- | ------------------------------------- |
| NCT of Delhi, National Capital Territory of Delhi, Delhi NCT     | Delhi                                 |
| Pondicherry                                                      | Puducherry                            |
| Orissa                                                           | Odisha                                |
| Uttaranchal                                                      | Uttarakhand                           |
| Tamilnadu                                                        | Tamil Nadu                            |
| Arunachal Pradesh                                                | Arunanchal Pradesh                    |
| Andaman and Nicobar Islands / ampersand equivalent               | Andaman & Nicobar Island              |
| Dadra and Nagar Haveli and Daman and Diu / ampersand equivalents | Dadra & Nagar Havelli and Daman & Diu |

Jammu and Kashmir matches Jammu & Kashmir through ampersand normalization.
Other names require exact normalized matches, never fuzzy/substring matching.

## Supplied production India asset

Official Survey of India data, distributed by NWDP/NWIC, Government of India,
was converted from EPSG:7755 to EPSG:4326 and topology-aware simplified by the
user in WSL2. The supplied asset is **1,681,403 bytes**, with **36** features,
`state_name`/`stcode`, and inspected extent `(68.177510, 6.755950)` to
`(97.412900, 37.088140)`. See [asset attribution](../public/maps/README.md).

RFC 7946 exteriors are counterclockwise; the D3 spherical renderer expects the
opposite winding (also opposite for holes). A cached **in-memory copy** adapts
ring traversal order only. No coordinate moves, no additional simplification,
and no production-file rewrite occur. This prevents inverted polygons or an
outline fitted to the whole globe instead of India. Coordinate bounds and
unique feature names/counts are validated at runtime.

## Privacy

Existing opt-in ipapi.is response → country/region → local static geometry.
No GPS, permission request, `navigator.geolocation`, extra IP provider or reverse
geocoding is used. No coordinate marker is drawn. Asset URLs/bodies contain no
intelligence data; normal request metadata is still visible to the site host.
No map interaction is stored or sent as telemetry.

Dashboard passes `undefined` for region while sensitive details are hidden.
The child also defensively discards selected-state results, omits region text,
uses generic chart labels and disables India events/tooltips. The India map
remains visible without a selected state. Accessible text becomes:
**India administrative map. State or Union Territory details are hidden.**
Public geometry names do not identify a user's selected location. Country stays
visible as permitted by the existing dashboard policy.

## Manual WSL2 validation

No installs, lint, tests, servers or builds were run by the agent for this update.
Tests mock geometry/fetch/Chart and do not contact live sources.

```bash
cd /mnt/c/AR_Files/code/ping-metric
npm run lint
npm test
npm run build
npm run build:gh -- --configuration=production
npm run copy-error-page
git diff --check
git status --short
```

Verify assets, size, unchanged package manifests and no large intermediates:

```bash
ls -lh dist/ping-metric/browser/maps/{countries-50m.json,india-states.geojson}
test ! -e dist/ping-metric/browser/maps/countries-110m.json && echo '110m asset not shipped'
wc -c public/maps/india-states.geojson dist/ping-metric/browser/maps/india-states.geojson
sha256sum public/maps/india-states.geojson
# Expected: 53f91959ad11c4ba7595c6d635faa369e46e50e0fac3899c31e57967fd62aca6
find . -type f \( -iname '*.geojson' -o -iname '*.json' -o -iname '*.zip' \) \
  -size +5M -not -path './node_modules/*' -not -path './dist/*' \
  -not -path './.git/*' -not -path './.angular/*' -print
git diff HEAD -- package.json package-lock.json
git status --short package.json package-lock.json
```

Expected: both assets exist, India size 1,681,403 bytes, no source/intermediate
India files, no package-manifest differences.

### Verify actual lazy chunk splitting

The source meets Angular defer eligibility, but bundle splitting has **not**
been build-verified here. Generate metadata manually:

```bash
npm run build:gh -- --configuration=production --stats-json
find dist/ping-metric -name stats.json -print
node <<'NODE'
const fs = require('node:fs');
const stats = JSON.parse(fs.readFileSync('dist/ping-metric/stats.json', 'utf8'));
for (const [file, output] of Object.entries(stats.outputs)) {
  const inputs = Object.keys(output.inputs || {});
  if (inputs.some(name => /ip-location-map\.component\.ts|geo-map-data\.service\.ts|chartjs-chart-geo|dashboard\.component\.ts/.test(name))) {
    console.log(file);
    console.log('Related inputs:', inputs.filter(name => /ip-location-map|geo-map-data|chartjs-chart-geo|dashboard\.component/.test(name)));
    console.log('Imports:', output.imports);
  }
}
NODE
```

Check the build's **Lazy chunk files** table and stats: the dashboard output must
reach the map component output through `kind: dynamic-import`, not a static
import. Map geo modules must not be in the main initial chunk. Shared chart
dependencies may live in a separate shared chunk. The dashboard is itself lazy,
so absence from main alone does not prove viewport deferral.

In the browser Network panel: intelligence off → no map requests; before viewport
entry → no map construction/geometry fetch; India → India asset only; non-India
→ world asset only. Check masked/recognized/unknown states, hover/tap, 320px
layout, all themes and simulated asset failures. This update leaves the existing
user-adjusted 22kB style budget untouched; no unrelated dashboard refactor occurs.
