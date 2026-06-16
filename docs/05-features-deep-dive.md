# 5 · Features — Deep Dive

## Terrain mesh

`TerrainMesh.tsx` builds a `PlaneGeometry` whose vertices are displaced by the elevation grid × `verticalExaggeration` (clamped to 30×). NaN / NoData vertices are dropped so the mesh never shows fake spikes at the edges. A water plane is rendered at `waterLevelMeters` with semi-transparent blue.

Topography is rendered with the **Plate Carrée** projection (equirectangular). Vertical scale is independent of horizontal scale; values are tuned per aesthetic (`0.4×` Serious, `1.5×` Playful, `10×` Explore default).

## Water level synchronization

The HUD value auto-syncs to the timeline year unless the slider is manually moved (override flag). Defined in `src/components/MinistryHUD.tsx` and the Index state machine.

## Water-flow simulation

`src/lib/water-flow-simulation.ts` runs a gravity-driven pipe model over the DEM. `addWaterAt(state, i, j, amount)` injects volume, `stepFlow(state)` advances one tick. Used by Level 3 and the Water Playground.

## Dam simulation

`src/lib/dam-simulation.ts` flood-fills upstream of a placed wall to compute a reservoir polygon, then raises water-level voxels there. Wall orientation is auto-detected if not provided.

## Canal auto-dig

`src/lib/canal-auto-dig.ts` cuts a Bresenham line between two basin polygons, lowering vertex heights to allow water flow.

## AI Scenario Chat

`supabase/functions/scenario-chat/index.ts` calls the Lovable AI Gateway (Gemini). The model is instructed to emit JSON matching `ScenarioAction` (`src/types/scenario.ts`):

```ts
type ScenarioAction =
  | ForestAction       // plant trees over a radius
  | DamAction          // place a dam, optionally trigger reservoir sim
  | WaterLevelAction   // raise/lower the sea level
  | CanalAction        // dig a canal between two coords
  | SettlementAction   // drop a labeled settlement marker
  | LabelAction;       // floating label
```

`ScenarioChat.tsx` posts the prompt, parses the action list, and applies each action to the live scene.

## Voxel "Survive" mode (`/voxel`)

Located in `src/pages/Voxel.tsx` + `src/lib/voxel/` + `src/components/voxel/`.

- World is built from the **real DEM** (`buildVoxelWorld` in `voxel-world.ts`) — downsampled to ~180×180 columns, then strict elevation → block stacks.
- Palette: water, sand, salt, dirt, stone, grass, reed, saxaul, clay, mud, snow, soap, sapling, brick (see `block-types.ts`).
- Resources are sprinkled deterministically with a seeded PRNG.
- 7 mission types (`missions.ts`): thirsty, salt, camel, soap, plant, canal, restore.
- Recipes (`recipes.ts`): Khorezm soap (fat + ash + water), saplings, shovel, bucket, brick, flatbread, reed bundle.
- Saplings grow into mature saxaul + canopy over time (`saxaul.ts`, 45 s interval).
- Entities: `Camels`, `Sheep`, `Fish`, `Fox`, `DustDevil` (under `components/voxel/`).
- HUD: stats (food/water/energy), inventory, hotbar 1–9, build menu, minimap, quest log.
- Controls: WASD + Space + Shift, left-click mine, right-click place, F drink/eat, M milk, E inventory, Q quests, B build, Esc unlock pointer.

## Sandbox

`src/lib/sandbox-simulation.ts` is a Float32 cellular-automata grid (water, sand, fire, plant, lava). Painted onto terrain with a configurable brush size and amount. Click-and-drag interaction in `SandboxOverlay.tsx`.

## Dust storm

`src/lib/dust-simulation.ts` — particle wind sim over the Aralkum seabed. Configurable wind direction, speed, turbulence, particle life, spawn rate. Click to seed emitters.

## Game of Life

`LifeOverlay.tsx` projects a Conway grid onto terrain via a single `InstancedMesh`. HUD via event bus, runs at a fixed tick.

## Face / palm mode (Level 7)

`FaceCameraBackground.tsx` requests `getUserMedia({ video: { facingMode: 'user' } })`. Optional palm tracking drives camera rotation. Phrases of the Aral fade in via `FacePhraseLayer`. Permission denial gracefully falls back to keyboard.

## GeoGuessr

`src/lib/geoguessr-locations.ts` holds curated locations (Karavan-Saray Beleuli, Jasliq Train Station, Aq Keme summer camp, Moynaq, …). Each has lat/lon, hint, zoom, and a satellite reference image preloaded at startup. Long titles wrap inside the 360 px panel (added `break-words` + `leading-tight`).

## Shareable state

URL search params encode camera, year, layers, water level. `Share.tsx` parses `/share/:id`. State changes are debounced before being pushed via `history.replaceState`.

## Exports

- **STL** — `src/lib/stl-exporter.ts`, 220×220 mm at ~150×150 grid, 300× vertical exaggeration.
- **Screenshot** — PNG capture excluding UI.
- **Video** — manual screen recording via `gl.domElement.captureStream` (`MediaRecorder`).
- **River flyover** — 15 s cinematic preset.
