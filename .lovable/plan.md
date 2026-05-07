
## Goal

Add an alternative terrain renderer using **Mapbox Satellite imagery + Terrain-RGB elevation**, with GPU vertex displacement. Toggle via a switch in the legend. All existing layers, pins, game mode, and sandbox tools continue working on top of it.

## Architecture

### 1. Coexistence strategy

The new terrain replaces the visual mesh **only**. The existing GeoTIFF elevation data stays loaded in memory and remains the source of truth for:
- Surface height for dwelling/school/vocab pin snapping
- Water flow simulation, dams, canals, sandbox painting
- Walk/Game mode raycasting and avatar height
- Water level extent calculation

This guarantees zero regressions. The Mapbox mesh only changes what the user *sees*.

The new mesh occupies the same world coordinate box (10×10 plate-carrée plane, same Aral bounds), so `geoToWorld(lon, lat)` keeps returning the same values.

### 2. Token handling

Mapbox public token (`pk....`) is safe in client code. Stored as a plain constant in a config file, with a small input UI in the legend so the user can paste their own token without us hardcoding one. Persisted in `localStorage`.

### 3. New files

```text
src/components/MapboxTerrainMesh.tsx   # GPU-displaced mesh with satellite drape
src/lib/mapbox-tiles.ts                # Tile fetch + stitch for satellite + terrain-RGB
src/hooks/useTerrainMode.ts            # 'classic' | 'satellite' state + persistence
src/components/TerrainModeSwitch.tsx   # Legend switch + token input
```

### 4. Changes to existing files

```text
src/components/TerrainViewer.tsx    # Conditionally render TerrainMesh OR MapboxTerrainMesh
src/components/Legend.tsx           # Mount TerrainModeSwitch
src/components/DwellingsLayer.tsx   # No change — already reads GeoTIFF for snapping
src/components/MirageToggle (etc.)  # No change
```

### 5. How the Mapbox mesh works

- `THREE.PlaneGeometry(10, 10, 256, 256)` — 256 segments for high displacement detail
- Custom `ShaderMaterial`:
  - **Vertex shader**: samples the terrain-RGB texture, decodes elevation: `elev = -10000 + (R*256² + G*256 + B) * 0.1`, displaces along Y by `(elev - minElev) * exaggeration`
  - **Fragment shader**: samples satellite texture, applies mirage tint when `uMirage = 1.0`
- Uniforms: `uSatellite`, `uTerrain`, `uExaggeration`, `uMinElev`, `uElevRange`, `uMirage`
- Recompile-free exaggeration changes (just uniform updates) → matches the spec's "real-time slider"

### 6. Tile fetching

Compute a single static composite at load time covering the Aral bounding box:
- Satellite: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[lng_min,lat_min,lng_max,lat_max]/1280x1280@2x?access_token=...`
- Terrain-RGB: same endpoint with `mapbox/terrain-rgb-v1` style, or stitched from raster tiles `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw`

For the fixed Aral region the static API is enough. For zoom-in fidelity later we can swap to tiled stitching, same uniform interface.

### 7. Mirage compatibility

Mirage mode applies a desaturation + warm-tint shader pass on the satellite texture in the fragment shader, so the new mode respects the existing visual modes.

### 8. Compatibility checklist for existing systems

| System | How it keeps working |
|---|---|
| Dwellings/Schools/Vocab pins | Already snap via GeoTIFF `geoToWorld` — unchanged |
| Game mode avatar | Raycasts the visible mesh; PlaneGeometry raycasts fine. Height fallback uses GeoTIFF. |
| Sandbox painting | Uses GeoTIFF UV mapping — unchanged |
| Water flow / canals / dams | Reads GeoTIFF elevation array — unchanged |
| Water level slider | Visual water plane is independent of terrain mesh — unchanged |
| Mirage / Dark toggle | New shader respects `uMirage` uniform |
| Screenshot / video record | Captures the WebGL canvas — unchanged |
| Walk mode | Same raycast path |

### 9. UX

- Legend gets a new section "Terrain Source" with two pills: **Classic** (current colored elevation) / **Satellite** (Mapbox)
- First time switching to Satellite, prompt for Mapbox public token (with link to mapbox.com/account)
- Token cached in `localStorage`. Switch persists in URL (`?terrain=satellite`)
- Exaggeration slider continues to work and now drives the GPU uniform directly

### 10. Risks & mitigations

- **Token rate limits**: We fetch one static image per session, not tiles — minimal usage
- **Static image resolution at high zoom**: acceptable for Aral overview; can upgrade to tiled stitching later without API changes
- **Memory**: One 1280×1280 satellite texture (~6MB GPU) + one 512×512 terrain-RGB (~1MB) — negligible
- **Pin alignment drift**: Mitigated by reusing the exact same world bounds and exaggeration formula in the shader as in the existing `geoToWorld`

## Out of scope (for this iteration)

- Free-roam / pan-the-globe mode (we stay within the Aral bounds)
- Time-series satellite (would need Earth Engine or Sentinel API)
- Tiled multi-resolution stitching (use static API first; refactor later if needed)
