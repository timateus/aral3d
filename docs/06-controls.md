# 6 · Controls Reference

## Global

| Action | Keyboard / Mouse | Gamepad | Touch |
|---|---|---|---|
| Rotate camera | Right-click drag | Right stick | One-finger drag |
| Pan camera | Left-click drag | Left stick | Two-finger drag |
| Zoom | Scroll wheel | LT / RT | Pinch |
| Move (WASD) | W A S D | Left stick | (per-mode joystick) |
| Up / Down (orbit target) | Q / E | LB / RB combos in Survive | — |
| Begin level / dismiss splash | Enter, Space, X | X (button 2), A, RB, RT | Tap anywhere |
| Previous level | (chevron) | LB (button 4) | Tap left chevron |
| Next level | (chevron) | RB (button 5) | Tap right chevron |

## Explore (Level 1)

- Timeline drag → snaps to milestone years (1974, 1989, 1999, 2004, 2009, 2015).
- Right panel sliders: vertical exaggeration (1–30×), water level (−12 to 300 m).
- Layer toggles: Surface / Contours / Vectors / Life / Borders / Rivers / Schools / Population.
- `R` → start manual screen recording.
- `Copy Link` → shareable URL.

## Ministry (Level 2)

- Single big slider drains/refills the sea. Threshold to win: water level < −4 m.

## Water Sim (Level 3)

- Click on terrain → pour water at point.
- Dam Tool: click two points to place a wall, optionally simulate reservoir fill.
- Canal Tool: click start + end to auto-dig a Bresenham channel.

## GeoGuessr (Level 4)

- Tap satellite reference panel → see hint.
- Click on terrain → set pending guess.
- `Confirm` button or `X` (gamepad, pressed twice) → submit.

## Minecraft (Level 5)

- Material palette buttons → choose block.
- Click on terrain → place. Right-click → remove.
- `Clear All` (mouse only) → wipe placed blocks.

## School 12 (Level 6)

- WASD → walk, or `Auto-walk` toggle.
- `X` on gamepad / `X` key on keyboard → open student dialog when arrived.

## Face mode (Level 7)

- Front camera drives the camera. Index-finger gesture toggles a layer.
- LB → previous level (L6). RB → next level (wraps to L1).

## Voxel / Survive (`/voxel`)

| Action | Key |
|---|---|
| Move | W A S D |
| Jump | Space |
| Sprint | Shift |
| Mine block / shear sheep / milk camel | Left-click |
| Place block | Right-click |
| Drink water / eat food | F |
| Hotbar select | 1 – 9 |
| Inventory | E |
| Quest log | Q |
| Build menu | B |
| Milk camel (when adjacent) | M |
| Unlock pointer | Esc |
| Exit level | `Exit Survive` button or `L1` button |
| Previous / next level | LB / RB |

## Mobile

- Gamepad chrome and `PadHint` chips are hidden when no fine pointer is detected (`isTouchOnly()`).
- All levels are reachable and exitable via on-screen buttons. See `mem://features/mobile-ui`.
