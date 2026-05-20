
# Survive Mode v2 — Plan

Four pillars, scoped to land together at moderate difficulty (3/5: stakes that pressure you but never punish hard).

## 1. Canal digging + saxaul growth

**Canal dig**
- Any block mined below the regional water level + 1 becomes a candidate canal cell.
- After ~1.5s of inactivity on the dug area, run a flood-fill from any neighbor that already has a `water` block at the same y. Filled cells become `water`, sourcing animation plays.
- If the trench connects to an existing water body, water spreads up to N=400 cells per dig event (perf cap). Otherwise it stays dry until connected.
- New tool: **Shovel** (craft: 2 stone + 1 saxaul) — 3× faster mining on sand/clay/mud/salt.

**Saxaul growth**
- Place `saxaul_sapling` (from inventory) on `sand` or `salt`. It stores `plantedAt`.
- Every ~45s of game time, sapling advances: stage 1 → 2 → 3 (full saxaul block + 1 leaf block above).
- Mature saxaul "stabilizes" 3×3 sand around it: those columns become immune to the dust-storm erosion added in pillar 4. Visual tint shifts slightly greener.
- Drops on harvest: 2 saxaul + 1 sapling (renewable).

## 2. Missions / story quests

Quest log panel (Q key), 7 hand-authored missions tuned to the world:

1. **Thirsty** — drink from a water block (right-click with empty hand at water).
2. **Salt of the Earth** — mine 10 salt.
3. **Camel Friend** — milk 3 camels.
4. **First Soap** — craft 1 soap bar.
5. **Green Thumb** — plant 5 saxaul saplings on the dry seabed.
6. **Lifeline** — dig a canal that delivers water to a marked dry village marker (auto-placed near Nukus / Muynak depending on region).
7. **Restoration** — have 10 mature saxaul + a working canal at the same time.

Each mission shows a single objective line top-left, completion triggers a toast + small reward (extra hotbar items or unlock cosmetics). State persists in localStorage.

## 3. Visual polish + structures

**Polish**
- Tiny pixel-art texture atlas (single 128×128 PNG, 16×16 per block) for the 8 most visible block types. Fallback to flat color if atlas fails to load.
- Animated water shader: vertex sine ripple on top face only, slow UV scroll, blue→teal gradient by depth.
- Sun directional shadow on top exposed blocks only (cheap shadow map, 1024px). Toggle in HUD.
- Slight ambient occlusion baked into the top-block instance color (darker where neighbors are taller).

**Structures** (multi-block placeables, snap to ground)
- **Yurt** — 5×5×3, costs 8 reed + 4 saxaul. Acts as spawn/respawn point.
- **Well** — 1×1×2, costs 6 clay + 2 stone. Right-click → fills any bucket with water, even far from a lake.
- **Brick kiln** — 2×2×2, costs 8 clay + 4 saxaul. Smelts clay → brick (new block, used for permanent buildings).
- **Canal gate** — 1×1×1, costs 4 brick. Toggles water flow on/off in pillar 1.

Structures open via a new **Build menu** (B key) showing recipe cards and a ghost preview before placement.

## 4. Survival depth + more mobs

**Stats** (difficulty 3 = forgiving timings)
- **Thirst**: starts at 100, drains 1 per 20s (faster on salt/sand: 1 per 12s). Drink from water block, well, or milk → +30.
- **Hunger**: drains 1 per 30s. Eat milk (+10), soap-adjacent food TBD, or new **flatbread** recipe (2 reed + 1 water bucket at brick kiln) → +40.
- **Stamina**: sprint depletes, regen when standing.
- Below 0 thirst or hunger: vignette darkens, walk speed -30%. No instant death.

**Day/night cycle**
- 8-minute full cycle. Sun rotates, sky color lerps between day/dusk/night palettes per region.
- Night: lower ambient, brighter directional moonlight. Yurt provides "rest" — sleep skips to dawn if no hostiles nearby.

**New mobs** (all use the existing instanced-mesh pattern)
- **Sheep** — small grass/oasis areas, drops 1 fat on milking-style interaction (shear, F key).
- **Fox** — neutral, scatters from player.
- **Fish** — instanced in water cells, harvested with right-click while looking at water (+1 fish, +20 hunger when eaten).
- **Dust devil** — only spawns on salt flats during daytime in Aral region. Slow-moving particle column; if it touches a sand/salt column without nearby mature saxaul, the column erodes by 1 block. Player taking damage: -10 thirst on contact. Killed by 3 hits.

## Technical notes

- **Water flow**: lightweight BFS in `voxel-world.ts` (`floodFillWater(world, seed, capN)`), not the full pipe-model sim. Runs on dig completion and on gate toggle. Mutates `cells` + `heights`, fires `onWorldMutated` so the terrain mesh rebuilds the affected columns only (already supported via `version` bump — optimize later with per-column dirty set).
- **Saxaul growth**: store `{i,j,stage,plantedAt}` array on the world; ticked from `useFrame` in `Voxel.tsx` every 1s. Updates cells, bumps version.
- **Structures**: `src/lib/voxel/structures.ts` table of `{id, name, cost, footprint, blocks: [{dx,dy,dz,block}]}`. `placeStructure(world, anchor, struct)` stamps blocks if all cells valid + cost paid.
- **Stats**: `useVoxelStats` hook, persisted in localStorage, ticked from `Voxel.tsx`. HUD bars added to `VoxelHUD.tsx`.
- **Day/night**: a single `useRef<number>` for time-of-day in `Voxel.tsx`, drives `Sky`, `directionalLight`, fog color, `ambientLight` intensity each frame.
- **Texture atlas**: optional `MeshLambertMaterial` with `map` + per-instance face UV via shader chunk. Behind a feature flag; falls back to current solid-color instancing if disabled.
- **Audio**: extend `voxel-audio.ts` with `drink`, `eat`, `wind` (dust devil), `shovel`, `night` ambient swap.
- **Files**
  - new: `src/lib/voxel/water-fill.ts`, `src/lib/voxel/saxaul.ts`, `src/lib/voxel/structures.ts`, `src/lib/voxel/missions.ts`, `src/hooks/useVoxelStats.ts`, `src/hooks/useVoxelMissions.ts`, `src/components/voxel/Sheep.tsx`, `src/components/voxel/Fish.tsx`, `src/components/voxel/Fox.tsx`, `src/components/voxel/DustDevil.tsx`, `src/components/voxel/VoxelBuildMenu.tsx`, `src/components/voxel/VoxelQuestLog.tsx`, `src/components/voxel/VoxelStatsHUD.tsx`, `public/textures/voxel_atlas.png`
  - edited: `src/lib/voxel/voxel-world.ts` (flood-fill + sapling/structure helpers), `src/lib/voxel/block-types.ts` (brick, sapling, fish, flatbread), `src/lib/voxel/recipes.ts` (shovel, flatbread), `src/components/voxel/VoxelTerrain.tsx` (atlas + water shader + AO), `src/components/voxel/VoxelPlayer.tsx` (interact key, build/quest hotkeys, day/night light), `src/components/voxel/VoxelHUD.tsx`, `src/pages/Voxel.tsx`
- **Perf budget**: keep instance count under ~120k. Sheep/fox/fish cap at 20/10/200 respectively. Dust devils max 2 concurrent.

## Out of scope (v3+)

- Multiplayer, deeper crafting trees, larger worlds, real DEM streaming, persistent server saves, mobile touch controls for FPS, full pipe-model water in canals.
