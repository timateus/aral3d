

## Reinvented Sandbox Mode

### Problem
The current sandbox uses a separate 200x200 cellular automata grid with `InstancedMesh` particles that don't interact with the actual terrain and fail to receive click events. It's disconnected from the proven terrain tools.

### New Approach
Build on top of the **existing working patterns** — the water flow simulation (Float32Array overlays at terrain resolution) and the raise/dig tools (direct terrain elevation modification). Instead of a separate simulation grid, the new sandbox operates directly on terrain-resolution arrays, one per element type.

### Architecture

```text
Terrain Elevations (existing)
  |
  +-- waterDepth[]     (existing WaterFlowState — reused as-is)
  +-- sandDepth[]      (new Float32Array — sand accumulates on terrain)
  +-- fireIntensity[]  (new Float32Array — fire burns, spreads to plants)
  +-- plantDensity[]   (new Float32Array — plants grow near water)
  +-- lavaDepth[]      (new Float32Array — lava flows like water but slower)
  |
  All rendered via SandboxOverlay (single mesh, like WaterFlowOverlay)
  All simulated via stepSandboxSim() each frame
```

### Technical Design

**1. New simulation engine: `src/lib/sandbox-simulation.ts` (rewrite)**
- `SandboxSimState`: holds `waterDepth`, `sandDepth`, `fireIntensity`, `plantDensity`, `lavaDepth` — all `Float32Array` at terrain resolution (`terrain.width * terrain.height`)
- `createSandboxSim(terrain)`: initializes all arrays
- `addElementAt(state, row, col, element, amount, radius)`: places elements (same pattern as `addWaterAt`)
- `stepSandboxSim(state)`: one tick of physics:
  - **Water**: flows downhill (reuse existing `stepFlow` logic)
  - **Sand**: falls to lower neighbors, slower than water, accumulates and raises effective elevation
  - **Fire**: spreads to neighbors with plants, dies over time, evaporates water
  - **Plants**: grow slowly near water, consumed by fire
  - **Lava**: flows like water but slower, turns water to steam, solidifies into raised terrain over time
- Performance: operates on typed arrays at terrain resolution (~500x500), no objects/allocations per cell

**2. New overlay: `src/components/SandboxOverlay.tsx`**
- Single component like `WaterFlowOverlay` — builds one `BufferGeometry` mesh
- Iterates all element arrays, for each pixel with any element, creates a vertex slightly above terrain
- Color determined by dominant element: blue (water), tan (sand), red (fire), green (plant), orange (lava)
- Re-renders on `renderKey` change (same pattern as water flow)

**3. New HUD: `src/components/SandboxHUD.tsx`**
- Element palette: Water, Sand, Fire, Plant, Lava, Eraser
- Brush size slider (1-10)
- Play/Pause/Reset controls
- Speed slider
- Back button
- Clean, minimal panel on the right side

**4. Integration in `Index.tsx`**
- Remove old `sandboxElement`, `sandboxPaused`, `sandboxResetKey` state
- Add `sandboxSimState` ref + `sandboxRenderKey` state
- `handleSandboxClick(row, col)` — calls `addElementAt` (same as `handleWaterFlowClick`)
- Animation loop — calls `stepSandboxSim` on interval (same as water flow animation loop)
- Pass `sandboxActive` to `TerrainMesh` — reuse existing `waterFlowActive` click pattern (row/col from UV)

**5. TerrainMesh changes**
- Add `sandboxToolActive` + `onSandboxClick` props (same pattern as `waterFlowActive`/`onWaterFlowClick`)
- In `handleClick`, when sandbox tool is active, compute row/col from UV and call `onSandboxClick`

**6. TerrainViewer changes**
- Render `<SandboxOverlay>` when sandbox is active (same spot as `WaterFlowOverlay`)
- Remove `Sandbox3D` import and rendering
- Remove `paintElement` / `SandboxState` imports

**7. Landing page entry**
- Keep the existing "Sandbox" card in `IntroOverlay`
- Keep the entry in `QuadrantView`

**8. Files to delete/clean**
- Remove current `src/components/SandboxMode.tsx` (replace with new `SandboxHUD.tsx`)
- Rewrite `src/lib/sandbox-simulation.ts` completely

### Performance
- All arrays are `Float32Array` — no object allocation per cell
- Simulation runs at terrain resolution (typically ~500x500 = 250K cells)
- Single mesh overlay — no instanced mesh with 8000 objects
- Step function operates on flat arrays with simple neighbor lookups
- Render only rebuilds geometry when `renderKey` changes (not every frame)

### Element Interactions
| Element | Behavior |
|---------|----------|
| Water | Flows downhill to 4 neighbors proportional to elevation difference |
| Sand | Falls to lower neighbors, raises effective elevation where it settles |
| Fire | Spreads to neighbors with plants, evaporates adjacent water, dies after ~50 ticks |
| Plant | Grows slowly when water is nearby, consumed by fire |
| Lava | Flows like water (slower), turns adjacent water to steam, solidifies into terrain after ~100 ticks |

### Files Changed
- **Rewrite**: `src/lib/sandbox-simulation.ts`
- **Delete content / Replace**: `src/components/SandboxMode.tsx` → new `src/components/SandboxHUD.tsx`
- **New**: `src/components/SandboxOverlay.tsx`
- **Edit**: `src/pages/Index.tsx` — new state, handlers, animation loop
- **Edit**: `src/components/TerrainMesh.tsx` — add sandbox click handler
- **Edit**: `src/components/TerrainViewer.tsx` — swap overlay, remove old imports
- **Edit**: `src/components/IntroOverlay.tsx` — keep sandbox entry (no change needed)

