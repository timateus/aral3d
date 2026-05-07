# Mapbox-Native Elevation for Satellite Mode

## Goal

In Satellite mode, derive elevation **entirely from Mapbox terrain-RGB tiles** (no GeoTIFF needed) so the app scales to any region on Earth. Classic mode keeps the GeoTIFF DEM unchanged. Add a region preset dropdown (Aral default, Khorezm, Custom bounds).

## Current state

- ~38 files read `terrain.elevations` (Float32 grid), `terrain.bounds`, `terrain.minElevation`, `terrain.maxElevation`, `terrain.width`, `terrain.height` from a single `useTerrain()` hook backed by `geotiff-loader.ts`.
- `MapboxTerrainMesh` currently *reuses* the GeoTIFF grid for vertex heights — Mapbox provides only the satellite drape.
- `mapbox-tiles.ts` already fetches and decodes terrain-RGB tiles.

## Design

Introduce a second elevation provider that produces the **exact same `TerrainData` shape** as the GeoTIFF loader. The active provider is selected by terrain mode. All downstream consumers (water sim, basins, pins, STL, game, etc.) keep working with zero changes because the shape is identical.

```text
                ┌── classic  ──► geotiff-loader.ts ──┐
terrainMode ────┤                                    ├──► useTerrain() ─► all 38 consumers
                └── satellite ──► mapbox-dem.ts  ────┘
                                  (terrain-RGB → Float32 grid)
```

## Steps

1. **New `src/lib/mapbox-dem.ts`**
   - `loadMapboxDEM(bounds, token, opts)` → `TerrainData` matching `geotiff-loader.ts` output.
   - Stitches terrain-RGB tiles at an appropriate zoom for the bbox (target ~512×512 grid).
   - Decodes `elev = -10000 + (R*65536 + G*256 + B)*0.1` per pixel into a Float32Array.
   - Computes `minElevation` / `maxElevation` from the decoded grid.
   - Returns `{ elevations, width, height, bounds, minElevation, maxElevation }`.

2. **New `src/hooks/useTerrainSource.ts`** (thin wrapper)
   - Reads `useTerrainMode()`. If `classic`, delegates to existing `useTerrain()`. If `satellite`, runs `loadMapboxDEM(activeBounds, token)` via React Query and returns the same shape.
   - Caches per `(bounds, token)` key. Loading + error states surface to existing UI spinners.

3. **Region presets**
   - Add `src/lib/terrain-regions.ts`: `{ id, label, bounds }` for Aral (default), Khorezm, plus a `Custom` entry.
   - Extend `useTerrainMode` with `region: 'aral' | 'khorezm' | 'custom'` + `customBounds` (persisted in localStorage and URL params alongside existing state).

4. **`TerrainModeSwitch.tsx`**
   - When Satellite is active, show a region dropdown. "Custom" reveals 4 inputs (minLng, minLat, maxLng, maxLat) with validation (max ~2° span to keep tile count sane).
   - Token UI stays as-is.

5. **`TerrainViewer.tsx` and other consumers**
   - Replace `useTerrain()` call with `useTerrainSource()`. No other API changes.
   - `MapboxTerrainMesh` no longer needs to pull elevations from the global GeoTIFF — it just consumes the unified `TerrainData` like `TerrainMesh` does.

6. **Layer behavior in Satellite mode**
   - Layers tied to Aral-specific GeoJSON (basins, water-extent timeline, schools, vocab) only make geographic sense over the Aral region. When `region !== 'aral'`, auto-hide them and show a small note: "This layer is Aral-region only." Game mode and water-sim work over any DEM.

7. **Cleanup**
   - Keep GeoTIFF code intact for Classic mode (per "Satellite mode only" scope). Just route through the unified hook.

## Technical Details

- **Tile stitching:** For a bbox, pick zoom `z` so that tile count ≤ 16 (4×4). Mapbox terrain-RGB max zoom ~14. Use `@2x` 512px tiles → 2048×2048 max raster, downsample to 512×512 grid via canvas.
- **`TerrainData` contract** stays identical, so `geoToWorld`, water-flow neighbor lookup, STL export grid, pin snap raycasting, etc. all keep working.
- **URL state:** add `region=aral|khorezm|custom` and (if custom) `bbox=minLng,minLat,maxLng,maxLat` to existing state-link params.
- **Performance:** decoded grid is ~1 MB Float32; same order as current GeoTIFF.
- **Failure modes:** missing token → keep existing token-input UI; network error → show toast and fall back to Classic.

## Out of scope

- Touching Classic mode's GeoTIFF pipeline.
- Region-specific overlay redesign (just hide them outside Aral for now).
- Worldwide bounds picker UI on a minimap (text inputs only this round).
