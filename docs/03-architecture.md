# 3 · Architecture

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5 + `@vitejs/plugin-react-swc` |
| Language | TypeScript 5 |
| UI | React 18, Tailwind 3, shadcn/ui (Radix primitives) |
| 3D | `three` 0.160 + `@react-three/fiber` 8 + `@react-three/drei` 9 |
| Data | `geotiff` for DEM, `shapefile` for vector, native `fetch` for GeoJSON/CSV/JSON |
| State | Local `useState` + small refs; `@tanstack/react-query` where async caching helps |
| Routing | `react-router-dom` 6 |
| Charts | `recharts` |
| Backend | Lovable Cloud (Supabase) — `@supabase/supabase-js` |
| AI | Lovable AI Gateway (Gemini) via edge function |
| Audio | Native `Audio()` for ambient + SFX, `getUserMedia` for face-mode |
| Export | `jszip`, custom STL exporter, `gl.domElement.captureStream` for video |

## Top-level layout

```
src/
├── pages/
│   ├── Index.tsx         ← the big one: levels, mode switching, HUD orchestration
│   ├── Voxel.tsx         ← /voxel — Minecraft-like Survive mode
│   ├── Share.tsx         ← /share/:id — shareable state links
│   ├── Library.tsx       ← /library — cultural object grid
│   └── NotFound.tsx
├── components/
│   ├── TerrainViewer.tsx       ← the R3F Canvas wrapper
│   ├── TerrainMesh.tsx         ← plane geometry built from elevation grid
│   ├── MapboxTerrainMesh.tsx   ← alternate Mapbox-DEM-tiled terrain
│   ├── *HUD.tsx                ← per-mode overlays (Ministry, GeoGuessr, Sandbox…)
│   ├── *Layer.tsx              ← optional terrain overlays (Schools, Population…)
│   ├── *Overlay.tsx            ← full-screen narrative/tour overlays
│   └── voxel/                  ← Survive-mode specific entities & UI
├── lib/
│   ├── geotiff-loader.ts       ← parses .tif → Float32Array elevation
│   ├── terrain-merger.ts       ← merges/expands DEMs
│   ├── water-flow-simulation.ts
│   ├── dam-simulation.ts
│   ├── canal-auto-dig.ts
│   ├── sandbox-simulation.ts   ← cellular-automata for sand/water/fire/plant/lava
│   ├── dust-simulation.ts
│   ├── life-simulation.ts
│   ├── voxel/                  ← voxel world builders, recipes, missions, water-fill
│   └── …
├── hooks/                       ← useGamepad, useUserLocation, useVoxelStats, …
├── integrations/supabase/       ← AUTO-GENERATED client + types — do not edit
└── types/scenario.ts            ← AI scenario-action shape
```

## Render pipeline (Explore)

```text
GeoTIFF .tif  ─►  geotiff-loader.ts  ─►  Float32Array elevations + bounds
                                       │
                                       ▼
                             terrain-merger.ts (optional)
                                       │
                                       ▼
                             <TerrainMesh elevations exaggeration waterLevel />
                                       │
                                       ▼     ◄── optional layers (Schools, Pop, Salinity, Waterways…)
                                <TerrainViewer />  ◄── HUDs, timeline, overlays
                                       │
                                       ▼
                                <Canvas dpr={touch?[1,1.75]:[2,3]} />
```

Each per-level mode flips boolean state in `Index.tsx` (`spectralMode`, `ministryMode`, `simMode`, `geoMode`, `placeMode`, `schoolMode`, `faceMode`). The TerrainViewer renders the same scene; the overlaid HUDs change.

## Backend

- **Supabase project** holds two edge functions; tables are only used for shareable state.
- **Edge functions** live in `supabase/functions/`:
  - `scenario-chat/` — proxies user prompts to Lovable AI Gateway (Gemini) and returns structured `ScenarioAction[]`.
  - `share-to-instagram/` — generates a static page + OG image for a shared scene.

## State sharing

`src/pages/Index.tsx` writes camera, year, layer toggles, etc. into the URL as search params (debounced via `history.replaceState`). `Share.tsx` reads `/share/:id` and rehydrates.

## Performance levers

- Touch devices drop DPR cap from `[2, 3]` to `[1, 1.75]`.
- Layer caches (`isWaterwaysCached`, `isLandcoverCached`, `isChoroplethCached`, `isPopDensityCached`) deduplicate expensive fetch/parse work.
- Heavy GeoJSONs (>10 700 waterway features) render through `LineSegments2` "fat lines" rather than per-feature meshes.
- Voxel world stores blocks as a flat `Uint8Array` of size `width × depth × maxStackHeight`.
