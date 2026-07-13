## Goal

1. Fetch population data live via API for every location (not just the pre-baked JSONs for suaq / almaty / balqash).
2. Document the data source for the Aral population layer (GHS‑POP R2023A) and every other dataset.
3. Add a `/data-sources` webpage and a matching Markdown doc, and link to it from each location page.

## Changes

### 1. Live population via Overpass API for all locations

`src/components/location/OsmPopulationLayer.tsx` already supports live Overpass fetching when no `dataUrl` is passed — it just isn't used because `LocationPage` always passes `population.json`.

- In `src/pages/LocationPage.tsx`, stop hardcoding `dataUrl={`${dataBase}/population.json`}`. Instead:
  - Prefer live Overpass over `location.waterBounds ?? location.bounds` so small city bboxes (Suaq, Almaty, Balqash city) still get surrounding populated places, and large bboxes (Balqash lake, Alakol) get full coverage.
  - Keep the static JSON only as a fallback if Overpass fails (network / rate limit).
- Add IndexedDB caching in `OsmPopulationLayer` via existing `browser-cache.ts` (key = bbox), so repeat visits don't re-hit Overpass. Keep the in-memory `_cache` as a first tier.
- Raise Overpass `out` limit and expand `place` filter slightly for lake-scale bboxes.

### 2. Aral population source

The Aral basin population layer (`PopulationDensityLayer`, file `public/data/population_density.tif`) is GHS‑POP R2023A (100 m, Mollweide, epoch 2020, JRC / European Commission). Document this in the sources page.

### 3. Data sources documentation

Create `docs/09-data-sources-public.md` — a curated, human-readable list of every dataset the app uses, grouped by category, with:
- Source name + provider
- Link to origin
- License
- Which locations use it (Aral basin, Suaq, Almaty, Balqash city, Lake Balqash, Alakol)

Categories to cover:
- **Elevation** — Mapterhorn DEM (worldwide, all `/xxx` location pages); Copernicus GLO‑30 / merged local GeoTIFFs (`aral_region.tif`, `khorezm.tif`, `lower_amudarya.tif`) for the Aral experience.
- **Imagery** — Satlas Super-Res 2023 (Allen Institute for AI).
- **Population** — GHS‑POP R2023A raster (Aral); OpenStreetMap `place=*` + `population=*` via Overpass API (all `/xxx` location pages).
- **Buildings** — OpenStreetMap; Overture Maps Foundation (optional toggle).
- **Waterways & water bodies** — OpenStreetMap `natural=water` / `waterway=*` via Overpass, cached per-bbox.
- **Biodiversity observations** — iNaturalist API (`/v1/observations`), photos CC-BY-NC per observer.
- **Historical shorelines & basins** — `13cent_basin.geojson`, `19cent_basin.geojson`, `21cent_basin.geojson`, `Area_1974..2015_AG.geojson` (Aral only; source: Robert / project research).
- **Time series** — `aral_sea_annual.json`, `karakalpakstan_monthly.json` (Aral only).
- **Demographics** — Karakalpakstan CSVs (Aral only; source: project research).
- **Groundwater** — `groundwater_level` shapefile (Aral only).
- **Land cover** — GlobCover (`landcover.tif`, Aral only).
- **Schools / dwellings / vocabulary** — project field research (Aral only).
- **Audio** — Kobyz music + Aralkum field recordings (Aral only).

### 4. Webpage at `/data-sources`

Create `src/pages/DataSources.tsx`:
- Same dark aesthetic as location pages: black background, dual-font system (Sora display, JetBrains Mono technical).
- Grouped by category, each entry with title, provider, license chip, list of locations that use it, and outbound link.
- Header row with a back link.
- Register the route in `src/App.tsx` (`/data-sources`).

### 5. Footer link on location pages

In `src/pages/LocationPage.tsx`, in the existing footer credit line (~line 762), add a small monospaced link "Data sources →" that routes to `/data-sources`. Applies to all location routes (Suaq, Almaty, Balqash, Balqash Lake, Alakol) and — per the request — also to the Aral experience: add the same small link at the bottom of the main Aral page (`src/pages/Index.tsx`), in a discreet corner.

## Technical details

- No new dependencies. Overpass endpoint already used; cache via existing `browser-cache.ts`.
- The Aral `population_density.tif` file itself isn't renamed or moved — only the docs page attributes it to GHS‑POP R2023A.
- If Overpass is rate-limited (429), fall back to the static `population.json` when present; otherwise show an empty layer silently (same behavior as today's error path).
- The `/data-sources` route is a plain React page — no backend, no new tables.
