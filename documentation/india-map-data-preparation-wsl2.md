# Preparing the India State/UT Map for PingMetric in WSL2

## Purpose

The production asset is already prepared (2026-10-08): **1,681,403 bytes**, 36
features, `state_name`/`stcode`, WGS84 extent `(68.177510, 6.755950)` to
`(97.412900, 37.088140)`. The commands below are a record for future regeneration,
not instructions to rewrite the current asset during application development.
The app only adapts ring traversal in memory for the spherical renderer; the
RFC 7946 production file remains unchanged.

PingMetric uses an India-specific geographic highlight map when IP intelligence reports that the current public IP is in India.

The production application does **not** ship the original high-resolution source file. The workflow is:

```text
Official NWDP GeoJSON ZIP
        ↓
Extract official GeoJSON
        ↓
Inspect source CRS and feature count
        ↓
Reproject EPSG:7755 → EPSG:4326
        ↓
Validate all 36 state/UT features
        ↓
Topology-aware simplification with mapshaper
        ↓
Keep only required properties
        ↓
public/maps/india-states.geojson
```

The final GeoJSON is a static browser asset used only for drawing the India state/UT highlight map.

---

## Official source

Dataset:

```text
State Boundary
```

Portal:

```text
National Water Data Portal (NWDP)
National Water Informatics Centre (NWIC)
```

Dataset page:

```text
https://nwdp.nwic.gov.in/dataset/state-boundary
```

Resource page:

```text
https://nwdp.nwic.gov.in/en/dataset/state-boundary/resource/f039e721-132c-4a24-9e5e-07af03064b4d
```

Direct GeoJSON ZIP used for this workflow:

```text
https://nwdp.nwic.gov.in/dataset/dd960900-34cc-4486-a95c-83200d2f2c7b/resource/f039e721-132c-4a24-9e5e-07af03064b4d/download/state_nwic_geojson.zip
```

The dataset page describes the State Boundary dataset as containing the administrative boundaries of all Indian states and Union Territories.

The resource is published as GeoJSON with an open license classification on the NWDP resource page.

Metadata should be checked again whenever the production asset is regenerated because official boundary data can change over time.

---

## Production asset

Only this prepared file should be committed to the application:

```text
public/maps/india-states.geojson
```

Do **not** commit:

```text
the original ZIP
the original projected GeoJSON
the intermediate WGS84 full-resolution GeoJSON
temporary extraction directories
mapshaper's npx cache
```

In the October 2026 preparation run:

```text
Original projected GeoJSON: ~48 MB
Full-resolution WGS84 GeoJSON: ~23 MB
Simplified production GeoJSON: ~1.7 MB
Feature count: 36
```

---

# 1. Prerequisites in WSL2

Open the PingMetric project in WSL2.

Example:

```bash
cd /mnt/c/AR_Files/code/ping-metric
```

Confirm the branch:

```bash
git branch --show-current
```

For the IP location map work, use:

```text
feature/4-ip-location-map
```

If creating the branch from the current baseline:

```bash
git switch master
git pull --ff-only origin master
git switch -c feature/4-ip-location-map
```

If the branch already exists:

```bash
git switch feature/4-ip-location-map
```

Create the production map directory and a WSL temporary workspace:

```bash
mkdir -p public/maps
mkdir -p /tmp/pingmetric-india/source
```

---

# 2. Install local preparation tools

These tools are used only to prepare the static geographic asset.

Install unzip:

```bash
sudo apt update
sudo apt install -y unzip
```

Install GDAL:

```bash
sudo apt install -y gdal-bin
```

Verify:

```bash
unzip -v | head
ogr2ogr --version
ogrinfo --version
```

`gdal-bin` supplies `ogr2ogr` and `ogrinfo`.

They are Linux/WSL system utilities. They are **not** npm dependencies and are not included in the browser application.

---

# 3. Download the official GeoJSON ZIP

## Option A — Download using a browser

Open the NWDP State Boundary dataset page and download the GeoJSON resource.

If Windows downloads it to a location such as:

```text
C:\Users\<username>\AppData\Local\Temp\pingmetric-india-boundaries.zip
```

the equivalent WSL path is:

```text
/mnt/c/Users/<username>/AppData/Local/Temp/pingmetric-india-boundaries.zip
```

For the preparation run documented here, the file was:

```text
/mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip
```

Check it:

```bash
ls -lh /mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip
```

Copy it into the WSL temporary workspace:

```bash
cp /mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip \
  /tmp/pingmetric-india/india.zip
```

## Option B — Download directly in WSL2

If the direct NWDP download URL is still valid:

```bash
curl -L \
  'https://nwdp.nwic.gov.in/dataset/dd960900-34cc-4486-a95c-83200d2f2c7b/resource/f039e721-132c-4a24-9e5e-07af03064b4d/download/state_nwic_geojson.zip' \
  -o /tmp/pingmetric-india/india.zip
```

Check the downloaded file:

```bash
ls -lh /tmp/pingmetric-india/india.zip
```

If NWDP changes the resource URL, return to the dataset page and use its current GeoJSON download link instead of relying on an old URL.

---

# 4. Extract the official file

Run:

```bash
unzip -o /tmp/pingmetric-india/india.zip \
  -d /tmp/pingmetric-india/source
```

List extracted files:

```bash
find /tmp/pingmetric-india/source -maxdepth 2 -type f
```

For the documented source, this produced:

```text
/tmp/pingmetric-india/source/state_NWIC.GeoJSON
```

Set the input path automatically:

```bash
INPUT="$(find /tmp/pingmetric-india/source \
  -type f \( -iname '*.geojson' -o -iname '*.json' \) | head -n 1)"

echo "$INPUT"
```

Expected:

```text
/tmp/pingmetric-india/source/state_NWIC.GeoJSON
```

---

# 5. Inspect the source before converting it

Never assume the source CRS.

Inspect it:

```bash
ogrinfo -so -al "$INPUT" | head -n 100
```

The October 2026 source inspection showed:

```text
Geometry: Multi Polygon
Feature Count: 36
CRS: WGS 84 / India NSF LCC
EPSG:7755
state_name: String
```

The original extent was expressed in projected metre coordinates, for example:

```text
(2818369..., 2177948...) - (5679118..., 5444563...)
```

Those projected coordinates are not the longitude/latitude coordinates expected by normal RFC 7946 browser GeoJSON.

The relevant feature-name property is:

```text
state_name
```

The source also includes:

```text
stcode
```

---

# 6. Reproject EPSG:7755 to EPSG:4326

Convert the official file to browser-friendly WGS84:

```bash
ogr2ogr \
  -f GeoJSON \
  /tmp/pingmetric-india/india-states-wgs84.geojson \
  "$INPUT" \
  -s_srs EPSG:7755 \
  -t_srs EPSG:4326 \
  -lco RFC7946=YES \
  -lco COORDINATE_PRECISION=6
```

Why:

```text
EPSG:7755
= Survey of India Lambert projected coordinates

EPSG:4326
= WGS84 longitude/latitude

RFC7946
= standard GeoJSON coordinate convention for web use
```

Check the intermediate file:

```bash
ls -lh /tmp/pingmetric-india/india-states-wgs84.geojson
```

Inspect it:

```bash
ogrinfo -so -al /tmp/pingmetric-india/india-states-wgs84.geojson | head -n 80
```

The validated output should show:

```text
Feature Count: 36
EPSG:4326
```

The October 2026 converted extent was approximately:

```text
(68.177512, 6.755953) - (97.412897, 37.088342)
```

These values are geographic longitude/latitude values covering India and its islands.

---

# 7. Validate all states and Union Territories

Run:

```bash
python3 - <<'PY'
import json

path = "/tmp/pingmetric-india/india-states-wgs84.geojson"

with open(path, encoding="utf-8") as f:
    data = json.load(f)

features = data.get("features", [])

names = sorted(
    f.get("properties", {}).get("state_name", "")
    for f in features
)

print("Feature count:", len(features))
print()

for i, name in enumerate(names, 1):
    print(f"{i:02}. {name}")

assert len(features) == 36, f"Expected 36 features, found {len(features)}"
assert all(names), "One or more features are missing state_name"

print("\nOK: 36 state/UT features with state_name.")
PY
```

For the documented source the official `state_name` values were:

```text
Andaman & Nicobar Island
Andhra Pradesh
Arunanchal Pradesh
Assam
Bihar
Chandigarh
Chhattisgarh
Dadra & Nagar Havelli and Daman & Diu
Delhi
Goa
Gujarat
Haryana
Himachal Pradesh
Jammu & Kashmir
Jharkhand
Karnataka
Kerala
Ladakh
Lakshadweep
Madhya Pradesh
Maharashtra
Manipur
Meghalaya
Mizoram
Nagaland
Odisha
Puducherry
Punjab
Rajasthan
Sikkim
Tamil Nadu
Telangana
Tripura
Uttar Pradesh
Uttarakhand
West Bengal
```

Some spellings/formatting in the official data differ from names that an IP provider may return.

Do not modify the boundary geometry to solve name differences.

Handle those differences in application normalization/alias logic.

Examples include:

```text
Arunachal Pradesh
    -> Arunanchal Pradesh

Andaman and Nicobar Islands
    -> Andaman & Nicobar Island

Jammu and Kashmir
    -> Jammu & Kashmir

Dadra and Nagar Haveli and Daman and Diu
    -> Dadra & Nagar Havelli and Daman & Diu
```

The right side above is the actual `state_name` value in this source and should be treated as the matching target unless a newer official dataset changes it.

---

# 8. Validate geographic coordinates

Run:

```bash
python3 - <<'PY'
import json

path = "/tmp/pingmetric-india/india-states-wgs84.geojson"

with open(path, encoding="utf-8") as f:
    data = json.load(f)

geometry = data["features"][0]["geometry"]

def first_point(value):
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        return value

    for item in value:
        point = first_point(item)
        if point:
            return point

point = first_point(geometry["coordinates"])

lon, lat = point

print("Geometry:", geometry["type"])
print("Sample coordinate:", point)
print("Longitude valid:", -180 <= lon <= 180)
print("Latitude valid:", -90 <= lat <= 90)

assert -180 <= lon <= 180
assert -90 <= lat <= 90

print("OK: coordinates look like WGS84 longitude/latitude.")
PY
```

For the documented run, one sample coordinate was:

```text
[93.719759, 7.207068]
```

---

# 9. Simplify the production asset

The original geometry is much more detailed than necessary for a dashboard highlight map.

Use `mapshaper` as a one-time tool through `npx`.

This does **not** add mapshaper to PingMetric's `package.json`.

Run:

```bash
npx --yes mapshaper \
  /tmp/pingmetric-india/india-states-wgs84.geojson \
  -simplify weighted 10% keep-shapes \
  -filter-fields state_name,stcode \
  -clean \
  -o format=geojson precision=0.00001 \
  public/maps/india-states.geojson
```

Meaning:

```text
weighted 10%
    Retain a reduced set of vertices using weighted simplification.

keep-shapes
    Prevent small polygon features from disappearing where possible.

-filter-fields state_name,stcode
    Remove properties PingMetric does not require.

-clean
    Clean geometric/topological issues after simplification.

precision=0.00001
    Reduce unnecessary coordinate precision in the production file.
```

During the documented run, mapshaper reported:

```text
Repaired 10 intersections
Retained 36 of 36 features
```

That is acceptable as long as subsequent validation still confirms 36 features and the expected geographic extent.

Warnings printed by an npx dependency do not mean those packages were installed into PingMetric. Verify `package.json` and `package-lock.json` remain unchanged.

---

# 10. Validate the final production GeoJSON

Check size:

```bash
ls -lh \
  /tmp/pingmetric-india/india-states-wgs84.geojson \
  public/maps/india-states.geojson
```

For the documented run:

```text
Full WGS84 intermediate: ~23 MB
Final production asset: ~1.7 MB
```

Validate feature count and names:

```bash
python3 - <<'PY'
import json

path = "public/maps/india-states.geojson"

with open(path, encoding="utf-8") as f:
    data = json.load(f)

features = data.get("features", [])

names = sorted(
    f.get("properties", {}).get("state_name", "")
    for f in features
)

assert len(features) == 36, f"Expected 36 features, found {len(features)}"
assert all(names), "Missing state_name"

print("Feature count:", len(features))

for name in names:
    print(name)

print("\nOK: simplified India file still contains all 36 states/UTs.")
PY
```

Check the geographic extent:

```bash
ogrinfo -so -al public/maps/india-states.geojson \
  | grep -E "Feature Count|Extent"
```

The documented final output was approximately:

```text
Feature Count: 36
Extent: (68.177510, 6.755950) - (97.412900, 37.088140)
```

This is effectively the same coverage as the full WGS84 file, with small rounding differences caused by simplification/precision reduction.

---

# 11. Verify npm project files were not changed by mapshaper

Run:

```bash
git status --short package.json package-lock.json
```

Expected:

```text
(no output)
```

Also:

```bash
git diff -- package.json package-lock.json
```

Expected:

```text
(no output)
```

`npx --yes mapshaper` should not become a PingMetric runtime/build dependency.

---

# 12. Keep only the production map asset

Inspect the map directory:

```bash
find public/maps -maxdepth 1 -type f -printf '%f %k KB\n' | sort
```

The essential production geometry is:

```text
india-states.geojson
```

A small attribution/readme file may also be stored there:

```text
README.md
```

Do not copy the original or intermediate geometry into `public/maps`.

---

# 13. Clean temporary files

Only do this after `public/maps/india-states.geojson` has passed all validation checks.

Remove the WSL temporary working directory:

```bash
rm -rf /tmp/pingmetric-india
```

Confirm:

```bash
test ! -e /tmp/pingmetric-india \
  && echo "WSL temporary India workspace removed."
```

If the original ZIP was downloaded into Windows Temp and is no longer required:

```bash
rm -f /mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip
```

Confirm:

```bash
test ! -e /mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip \
  && echo "Windows temporary ZIP removed."
```

The original NWDP data can always be downloaded again from the official portal when the production asset needs to be regenerated.

---

# 14. Optional: clear npx temporary execution cache

`npx --yes mapshaper` may leave a downloaded execution copy under npm's npx cache.

Inspect it first:

```bash
du -sh ~/.npm/_npx 2>/dev/null || true
```

If you want to remove temporary npx execution packages:

```bash
rm -rf ~/.npm/_npx
```

This does not remove PingMetric dependencies from `node_modules`.

It only means future `npx` commands may need to download their temporary packages again.

Do **not** run `npm cache clean --force` just for this workflow; that clears much more than is necessary.

---

# 15. Should GDAL and unzip be removed?

Normally, keep them installed.

They are useful WSL command-line tools and are not part of the PingMetric production bundle.

Their installation does not increase the deployed website size.

If this WSL environment is extremely space-constrained and these tools are no longer wanted, they can be removed separately with APT, but removing them is not required as part of normal project cleanup.

---

# 16. Repository check after cleanup

Run:

```bash
git status --short
```

Check the map directory:

```bash
find public/maps -maxdepth 1 -type f -ls
```

Check for accidentally copied large geographic files:

```bash
find . \
  -type f \
  \( -iname '*.geojson' -o -iname '*.json' -o -iname '*.zip' \) \
  -size +5M \
  -not -path './node_modules/*' \
  -not -path './dist/*' \
  -print
```

For this map workflow there should not be a 23 MB or 48 MB India source/intermediate file inside the repository.

The expected production asset is approximately:

```text
public/maps/india-states.geojson  ~1.7 MB
```

---

# 17. Add attribution

Keep a source note either in:

```text
public/maps/README.md
```

or the project documentation.

Suggested content:

```markdown
# Geographic map data

## India state and Union Territory boundaries

Source: National Water Data Portal (NWDP), National Water Informatics Centre.

Dataset: State Boundary

Data producer: Survey of India

Dataset:
https://nwdp.nwic.gov.in/dataset/state-boundary

Resource:
https://nwdp.nwic.gov.in/en/dataset/state-boundary/resource/f039e721-132c-4a24-9e5e-07af03064b4d

The production GeoJSON was reprojected from EPSG:7755 to EPSG:4326 and
simplified for browser rendering. Geographic boundaries were not manually
redrawn.
```

Update the download/preparation date whenever the asset is regenerated.

---

# 18. Final implementation contract

The final PingMetric behavior should be:

```text
IP intelligence OFF
    -> do not load/render the location map

IP intelligence ON
    + country is not India
    -> use world map
    -> highlight detected country

IP intelligence ON
    + country is India
    + state/UT matches
    -> load india-states.geojson
    -> show all state/UT boundaries
    -> highlight matched state/UT

IP intelligence ON
    + country is India
    + state/UT cannot be safely matched
    -> show India map
    -> no incorrect state highlight
    -> show textual "State/UT unavailable"
```

No GPS, `navigator.geolocation`, location permission, or second IP-geolocation provider is required.

---

# 19. Rebuilding the asset in the future

When the official boundary dataset changes:

```text
download fresh official GeoJSON
→ inspect CRS and properties again
→ do not assume it is still EPSG:7755
→ verify feature count
→ reproject only if necessary
→ inspect state_name values
→ simplify
→ validate
→ replace only public/maps/india-states.geojson
→ update attribution/preparation date
→ run application tests/build
```

Never blindly rerun an old CRS conversion against a new dataset without checking the new file's SRS first.

---

# Quick command reference

```bash
# Workspace
mkdir -p public/maps
mkdir -p /tmp/pingmetric-india/source

# Extract
unzip -o /tmp/pingmetric-india/india.zip \
  -d /tmp/pingmetric-india/source

# Find GeoJSON
INPUT="$(find /tmp/pingmetric-india/source \
  -type f \( -iname '*.geojson' -o -iname '*.json' \) | head -n 1)"

# Inspect source
ogrinfo -so -al "$INPUT" | head -n 100

# Convert EPSG:7755 -> EPSG:4326
ogr2ogr \
  -f GeoJSON \
  /tmp/pingmetric-india/india-states-wgs84.geojson \
  "$INPUT" \
  -s_srs EPSG:7755 \
  -t_srs EPSG:4326 \
  -lco RFC7946=YES \
  -lco COORDINATE_PRECISION=6

# Simplify
npx --yes mapshaper \
  /tmp/pingmetric-india/india-states-wgs84.geojson \
  -simplify weighted 10% keep-shapes \
  -filter-fields state_name,stcode \
  -clean \
  -o format=geojson precision=0.00001 \
  public/maps/india-states.geojson

# Validate
ogrinfo -so -al public/maps/india-states.geojson \
  | grep -E "Feature Count|Extent"

ls -lh public/maps/india-states.geojson

# Cleanup
rm -rf /tmp/pingmetric-india
rm -f /mnt/c/Users/meeta/AppData/Local/Temp/pingmetric-india-boundaries.zip

# Repository verification
git status --short
git diff --check
```
