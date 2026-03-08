

# Dam Reservoir Simulation

## Concept

When a user places a dam on the terrain, we simulate water filling behind it using a **flood-fill algorithm** on the DEM data. The dam acts as a barrier at a certain elevation; water accumulates in the basin behind it up to the dam's crest height. The result is a realistic reservoir shape dictated by actual topography.

## Algorithm: Flood Fill from Dam

1. **Dam placement** defines a location, orientation, crest elevation, and width
2. **Seed point**: Pick a point on the upstream side of the dam (user specifies or we auto-detect the lower-elevation side)
3. **Flood fill**: Starting from the seed, BFS/flood-fill across DEM pixels where `elevation < crest_elevation`, stopping at the dam wall and at terrain that exceeds crest height
4. **Output**: A set of flooded pixels → rendered as blue-tinted water on the terrain, plus volume calculation

## Architecture

### New utility: `src/lib/dam-simulation.ts`
- `simulateReservoir(terrain, damLat, damLon, damHeight, damOrientation?)` → returns `{ floodedPixels: Set<number>, volume: number, surfaceArea: number, maxDepth: number }`
- BFS flood-fill on the elevation grid from the upstream side
- Dam modeled as a line segment across the terrain at crest elevation; pixels on the dam line block the fill
- Volume computed same way as `calcVolumeFromWaterLevel` but only for flooded pixels

### New type: extend `DamAction` in `src/types/scenario.ts`
- Add optional `simulate?: boolean` — when true, trigger reservoir simulation
- Add optional `orientation?: number` — dam wall angle in degrees (default: auto-detect perpendicular to slope)

### New component: `src/components/ReservoirOverlay.tsx`
- Takes simulation result + terrain data
- Renders flooded area as a semi-transparent blue mesh on the terrain surface (recolor flooded vertices or render a separate water plane clipped to the flood extent)
- Shows an info panel with reservoir stats: volume (km³), surface area (km²), max depth (m)

### Integration into existing flow
- **ScenarioChat**: The AI chatbot can already place dams via `apply_scenario`. When a dam action has `simulate: true`, Index.tsx runs the flood-fill and passes results to TerrainViewer
- **Manual mode**: Add a "Place Dam" interactive mode — user clicks on terrain to set dam location, drags to set orientation, slider for dam height. Live-update the reservoir as they adjust height
- **TerrainMesh coloring**: Flooded pixels get water coloring (same blue gradient already used for sea level), layered on top of normal terrain colors
- **Edge function update**: Update the system prompt so the AI knows about `simulate: true` and can trigger reservoir visualization

### UI additions in `src/pages/Index.tsx`
- "Dam Tool" button in the control area — toggles interactive dam placement mode
- When active: click sets position, drag sets orientation, height slider appears
- Reservoir stats panel shows volume/area/depth
- Clear button to remove placed dams

### Performance
- BFS on a 450×450 grid (~200k pixels) is fast (<50ms)
- Memoize simulation result on dam position + height changes
- Debounce height slider to avoid re-running on every pixel

## Implementation Order

1. Create `dam-simulation.ts` with flood-fill algorithm
2. Extend `DamAction` type with simulation fields  
3. Create `ReservoirOverlay.tsx` to render flooded area on terrain
4. Add interactive dam placement UI (click-to-place + height slider)
5. Wire into TerrainViewer and Index.tsx state management
6. Update edge function system prompt for AI-driven dam simulation
7. Add reservoir stats display (volume, area, depth)

