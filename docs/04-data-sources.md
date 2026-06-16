# 4 · Data Sources

All datasets live under `public/data/` and are loaded at runtime by `fetch`.

## Terrain (DEM)

| File | Region | Notes |
|---|---|---|
| `aral_region_30m.tif` | Aral basin, ~30 m | Default elevation source for Explore. |
| Merged Khorezm tiles | Khorezm oasis | Built at runtime via `mergeTerrains` / `mergeExpandTerrains`. |
| Mapbox DEM tiles | Worldwide | Optional alternate source, fetched per-tile (`useMapboxTerrain`). |

Loader: `src/lib/geotiff-loader.ts`. NoData values and pixels < −9999 are stripped; transparency is preserved through the mesh so the plate-carrée patch never shows fake elevation.

## Historical basins / shorelines

| File | Description |
|---|---|
| `13cent_basin.geojson` | 13th-century basin |
| `19cent_basin.geojson` | 19th-century basin |
| `21cent_basin.geojson` | 21st-century basin |
| `21c_lakes_robert.geojson` | 21st-century lake fragments (fan-triangulated fills) |
| `Area_1974_AG.geojson` … `Area_2015_AG.geojson` | Shoreline extents at milestone years |

## Time series

| File | Series |
|---|---|
| `aral_sea_annual.json` | Sea level, volume, salinity per year |
| `karakalpakstan_monthly.json` | Climate monthly aggregates |

## Demographics & society

CSV files under `public/data/`:

`adolescent_childbirth`, `arranged_marriages`, `arrivals`, `child_mortality`, `drinking_water`, `emigrants`, `housing_burnt_brick`, `housing_concrete`, `housing_raw_brick`, `infant_mortality`, `life_expectancy`, `maternal_mortality`, `natural_gas`, `sewage_coverage`, `canal_geographies`.

Choropleth uses ADM2 boundaries with ADM1 fallback, min-to-zero square-root scale.

## Built environment & culture

| File | What it powers |
|---|---|
| `schools.json` | Schools layer (Karakalpakstan TDS color coding) |
| `dwellings.json` | Dwelling-material 3D markers |
| `vocabulary.json` | Cultural terms with 56×56 photo thumbnails |

## Groundwater

`groundwater_level.prj` + companion shapefile parts → `GroundwaterLayer.tsx` renders extruded polygon pillars on a blue-to-red scale.

## Audio

Under `src/assets/*.mp3` (referenced by `.asset.json` sidecars):

- `Kobyz_*.mp3` — kobyz instrument pieces, used as ambient music.
- `aralkum-*.mp3` — Aralkum field recordings.

`BackgroundMusic.tsx` cross-fades depending on mode.

## Imagery

- `src/assets/character-*.png` — playable character avatars.
- `src/assets/kegeyli-*.png` — Kegeyli School 12 photos used in the schools narrative.
- GeoGuessr satellite reference images preloaded at startup via `preloadGeoGuessrImages` from `src/lib/geoguessr-locations.ts`.

## Projection

Plate Carrée. The merger compensates for ~27 % east/west horizontal distortion in the Aral latitude band — see `mem://tech/map-projection`.
