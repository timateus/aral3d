## Voxel "Survive" Mode — Minecraft on the Aral Basin

A new top-level mode that re-renders the real DEM as a stacked-block world at ~200×200 columns. Player walks around in first person, breaks and places blocks, collects region-specific resources, and performs themed activities (plant saxaul, milk camel, make soap, dig canal).

### Player experience

1. From the home/mode switch, choose **Survive** (new top-level button next to Explore, Walk, Game).
2. Spawn drops you on the terrain at a sensible start (Nukus area by default). Pointer-lock activates → mouse looks, WASD walks, Space jumps, Shift sprints, E opens inventory, 1-9 selects hotbar.
3. The terrain looks like a chunky pixel-art version of the real Aral basin: the dry seabed, river deltas, Khorezm oases, and elevation profile are all recognizable.
4. Left-click breaks the block under crosshair → it goes into inventory. Right-click places the currently selected block.
5. Resource blocks (salt flats, sand, clay, water, reed, saxaul) are scattered using a "strict terrain, freeform resources" rule — terrain shape is real, but block *contents* are tuned for fun.
6. Activities unlock when you have the right inputs:
   - **Plant saxaul** → place a saxaul sapling on sand; it grows over time and stabilizes nearby sand (cosmetic).
   - **Milk camel** → walk up to a camel mob, right-click → milk added to inventory.
   - **Make soap** → at a crafting bench, combine fat + ash + water → soap bar.
   - **Dig canal** → break a connected line of blocks below water level; water flows in using a simplified version of the existing flow sim.
7. Press Esc → unlock pointer, exit back to standard mode. State (inventory, placed blocks) persists in localStorage and URL params for the session.

### Voxel terrain generation

- **Source**: existing merged DEM (`geotiff-loader.ts`, Khorezm region by default).
- **Downsample** to a 200×200 column grid (block side ≈ DEM bounds / 200).
- **Column height** = `round((elev - minElev) / blockHeightMeters)` with `blockHeightMeters ≈ 5` and a vertical exaggeration around 2-3× so cliffs read well without becoming spikes. Each column is a stack of N solid blocks.
- **NaN / no-data pixels** are skipped (no column), matching the existing terrain-merger rule.
- **Block type per voxel** assigned in a single pass:
  - Below current water level → `water` blocks for the top, `mud` below.
  - Salinity raster > threshold → top block becomes `salt`.
  - Landcover class → grass / sand / bare / reed / forest (saxaul) mapping (reuse `LandcoverLayer` class table).
  - Otherwise → dirt / stone by depth.
- **Resource sprinkling** (freeform): scatter clay near rivers, extra salt patches on the dry seabed, occasional reed clusters near water edges.

### Rendering approach

- One `InstancedMesh` per block type (water, sand, salt, dirt, stone, grass, reed, saxaul, clay, mud, snow). Capacity sized to total surface-exposed voxels only — interior blocks are culled at generation time (greedy face culling per column).
- For v1, only render the **top exposed block** of each column plus side blocks where a neighbor is shorter — that keeps the instance count to ~40-80k cubes, well within R3F performance budget at 200×200.
- Single shared `BoxGeometry(1,1,1)`. Materials per type use solid colors first (matches "minimalist sharp-edged" aesthetic from project memory); a low-res pixel-art atlas can come later.
- Player avatar is a simple capsule with a first-person camera; no third-person model needed in v1.

### Controls

- Pointer Lock API on canvas click.
- WASD walking with gravity (~20 m/s²) and simple AABB collision against the voxel column heights — no need for full per-block collision since the world is heightfield-derived.
- Space → jump if grounded. Shift → 1.6× speed. Left-click → break, Right-click → place, Mouse-wheel / 1-9 → hotbar slot, E → inventory toggle, Esc → release pointer.
- Gamepad: reuse `useGamepad`. Left stick = move, right stick = look, A = jump, RT = break, LT = place, dpad = hotbar.

### Inventory & crafting

- Inventory state lives in a Zustand-style hook `useVoxelInventory` (mirrors `useTerrainMode` pattern). 9-slot hotbar + 27-slot main; serialized to localStorage.
- Crafting table block opens a small grid UI (glass-panel HUD, monospace accents, sharp edges per project aesthetic).
- v1 recipes:
  - **Soap** = fat + ash + water → soap bar
  - **Saxaul sapling** = saxaul wood → 4 saplings
  - **Bucket** = 3 clay (smelted) → bucket; bucket + water block = water bucket
  - **Canal marker** = stone + reed → placeable beacon
- "Milk camel" is an interaction, not a recipe: requires a bucket in hand and proximity to a camel mob.

### Mobs (v1, minimal)

- ~10 camels wandering the Khorezm region using simple random-walk on the voxel surface.
- No hostile mobs in v1. Friendly only, to keep scope contained.

### File plan

- `src/lib/voxel/voxel-world.ts` — downsample DEM → column heights + per-voxel block types
- `src/lib/voxel/block-types.ts` — block enum, colors, mineable/placeable flags, drops
- `src/lib/voxel/voxel-mesher.ts` — exposed-face detection → instanced positions per block type
- `src/lib/voxel/recipes.ts` — crafting recipe table
- `src/hooks/useVoxelInventory.ts` — inventory + hotbar state, localStorage persisted
- `src/components/VoxelWorld.tsx` — root R3F scene for this mode: instanced meshes + lighting + player + mobs
- `src/components/VoxelPlayer.tsx` — pointer-lock controls, gravity, collision, raycast for break/place
- `src/components/VoxelHUD.tsx` — crosshair, hotbar, health (later), gamepad hints
- `src/components/VoxelInventoryPanel.tsx` — inventory + crafting grid UI
- `src/components/CamelMob.tsx` — instanced camels + random walk
- Edit `src/components/TerrainModeSwitch.tsx` — add **Survive** mode button
- Edit `src/hooks/useTerrainMode.ts` — add `'voxel'` to mode union, persist
- Edit `src/pages/Index.tsx` — route to `<VoxelWorld />` when mode === 'voxel'; hide unrelated UI per existing UI-visibility constraint
- Add memory file `mem://features/voxel-survive-mode`

### Technical notes

- Keep the existing terrain mesh pipeline untouched. Voxel mode swaps the scene root entirely while preserving DEM loading, region selection, and basemap state.
- Use a single `useFrame` tick for player physics + camel AI; cap mob count and use instancing.
- Break/place mutates a `Uint8Array(width * height * maxStackHeight)`; only re-build the instanced meshes for the affected column(s), not the whole world.
- Water blocks are static visual cubes in v1 — the existing flow sim can be opted-in later for canal-dig payoff. Canal dig in v1 just shows water blocks settling at the lowest dug level after a short delay.
- Respect UI-visibility constraint: hide timeline, metrics, data panels in Survive mode. Only show the voxel HUD.
- Performance target: 60 fps on a 200×200 world at ≤80k visible cubes on a mid-range Mac.

### Out of scope for v1 (good follow-ups)

- Day/night cycle, hostile mobs, hunger, multiplayer
- Texture atlas / pixel-art block faces
- Saving worlds server-side
- Multi-chunk streaming for full Aral basin at finer resolution
- Real flowing water simulation tied to canal dig (reuse `water-flow-simulation.ts` later)
