# Data prefetch scripts

These scripts pre-fetch every external data source used by the location pages
and write the result to `public/data/locations/{slug}/` so the app never
depends on live APIs at runtime.

## Sources

| Script | Source | Output files per location |
| --- | --- | --- |
| `overpass.mjs` | OpenStreetMap via Overpass API | `water.json`, `water_large.json`, `buildings.json`, `places.json` |
| `inaturalist.mjs` | iNaturalist v1 API | `inaturalist.json` |
| `ghs-pop.mjs` | GHS-POP R2023A (JRC), epoch 2020, 100 m WGS84 | `population_density.json` |

Live-fetching code is retained in the components but not used — they read
from these static files by default.

## Run

```bash
# Install one-off dependencies used only by the scripts
npm i -D geotiff adm-zip

# All locations
node scripts/prefetch/overpass.mjs
node scripts/prefetch/inaturalist.mjs
node scripts/prefetch/ghs-pop.mjs

# Or one slug at a time
node scripts/prefetch/overpass.mjs alakol seliger
```

## Notes

* Overpass is rate-limited — the script retries across three mirrors.
* iNaturalist asks for ≤ 1 request/sec; the script sleeps between pages.
* GHS-POP downloads 10°×10° tiles (~33 MB each) and caches them under
  `$TMPDIR/ghs-pop-cache`. Tiles are reused across locations.
* `population_density.json` stores a Float32 grid as base64
  (`values = new Float32Array(base64ToBytes(valuesB64).buffer)`).
* When adding a new location to `src/lib/locations.ts`, mirror it into
  `scripts/prefetch/locations.mjs` and re-run the scripts for that slug.
