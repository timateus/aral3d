# Data Sources (public catalog)

Human-readable catalog of every dataset used across the Aral experience
(`/`) and the smaller location viewers: `/suaq`, `/almaty`, `/balqash`,
`/balqash-lake`, `/alakol`. Live sources are pulled from public APIs on
demand and cached client-side (IndexedDB / localStorage) so repeat visits
are instant.

The same catalog is rendered in-app at [`/data-sources`](../src/pages/DataSources.tsx).

Legend for the **Locations** column:
- **Aral** — the main experience at `/`
- **Suaq, Almaty, Balqash, Lake Balqash, Alakol** — the small location viewers

---

## Elevation

| Source | Provider | License | Locations | Notes |
| --- | --- | --- | --- | --- |
| Mapterhorn DEM | Mapterhorn | Open (attribution) | Suaq, Almaty, Balqash, Lake Balqash, Alakol | Global terrain tiles streamed on demand; cached in IndexedDB. |
| Merged Copernicus GLO-30 GeoTIFFs | ESA Copernicus / project | CC BY 4.0 | Aral | `aral_region.tif`, `khorezm.tif`, `lower_amudarya.tif` merged in browser. |

## Imagery

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Satlas Super-Resolution 2023 | Allen Institute for AI | CC BY 4.0 | all |

## Population

| Source | Provider | License | Locations | Notes |
| --- | --- | --- | --- | --- |
| GHS-POP R2023A | European Commission — JRC | CC BY 4.0 | Aral | 100 m Mollweide raster, epoch 2020 (`public/data/population_density.tif`). |
| OSM populated places (Overpass API) | OpenStreetMap contributors | ODbL | Suaq, Almaty, Balqash, Lake Balqash, Alakol | Live query for `place=city\|town\|village\|hamlet\|suburb\|…` and `population=*`. Cached per-bbox. |

## Buildings

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| OpenStreetMap buildings | OpenStreetMap contributors | ODbL | Suaq, Almaty, Balqash, Lake Balqash, Alakol |
| Overture Maps Foundation | Overture Maps Foundation | ODbL / CDLA-Permissive 2.0 | Suaq, Almaty, Balqash, Lake Balqash, Alakol (optional toggle) |

## Waterways & water bodies

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| OSM water & waterways (Overpass API) | OpenStreetMap contributors | ODbL | Suaq, Almaty, Balqash, Lake Balqash, Alakol |

## Biodiversity observations

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| iNaturalist observations | iNaturalist community | CC BY-NC (per observer) | Suaq, Almaty, Balqash, Lake Balqash, Alakol |

## Historical shorelines & basins

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| 13th/19th/21st-century basins & Area_1974–2015 shorelines | Project research | Project-internal | Aral |

## Time series

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Aral Sea annual level / volume / salinity | Project research | Project-internal | Aral |
| Karakalpakstan monthly climate | Project research | Project-internal | Aral |

## Demographics

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Karakalpakstan demographic CSVs (mortality, housing, sewage, gas, drinking water, migration, life expectancy, …) | Project research | Project-internal | Aral |

## Groundwater

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Groundwater level shapefile | Project research | Project-internal | Aral |

## Land cover

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| GlobCover-derived `landcover.tif` | ESA GlobCover | CC BY | Aral |

## Schools, dwellings, cultural vocabulary

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Field research | Project field research | Project-internal | Aral |

## Audio

| Source | Provider | License | Locations |
| --- | --- | --- | --- |
| Kobyz music, Aralkum field recordings | Project field recordings | Project-internal | Aral |

---

Map data © OpenStreetMap contributors. Population raster: GHS-POP R2023A ©
European Union, 1995–present. Imagery: Satlas / Allen Institute for AI.
Observations © respective iNaturalist observers.
