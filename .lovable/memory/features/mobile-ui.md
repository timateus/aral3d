---
name: Mobile UI
description: Touch-first behavior — gamepad chrome hidden, every level playable with touch, DPR reduced
type: feature
---

# Mobile / touch-only UI

Detection lives in `src/lib/touch-device.ts` — `isTouchOnly()` returns true when the device reports touch input AND no fine pointer (so hybrid laptops stay desktop). React components use `useIsTouchOnly()`.

## What changes on touch-only devices
- All `PadHint` chips (gamepad button labels) render nothing — `SpectralEarthHUD`, `GeoGuessrHUD`, `MinistryHUD`, `WaterSimHUD`.
- `GamepadStickFix` floating HUD is hidden.
- Controller connect/disconnect toasts in `useGamepad` are suppressed.
- TerrainViewer Canvas drops `dpr` from `[2, 3]` to `[1, 1.75]` for perf and applies `touch-action: none` so swipes don't scroll the page.
- `index.html` viewport uses `viewport-fit=cover, user-scalable=no`.
- `src/index.css` adds safe-area body padding, disables rubber-band scroll, disables tap-highlight, sets `touch-action: manipulation` (canvas keeps `none`).

## Per-level touch playability
- Most levels work out-of-box because OrbitControls supports touch (one-finger rotate, two-finger pinch/pan), the MinistryHUD slider already binds `onPointerDown/Move/Up`, and GeoGuessr has tap-to-pending + Confirm button.
- GeoGuessr joystick X also requires confirmation now (tap or press X twice).
- Face mode (Level 7) still requires the front camera; works on phones that grant permission.

## Out of scope (for now)
- Virtual on-screen joystick for camera pan — added only if user reports they can't navigate.
- Capacitor / native packaging.

## Supersedes
Earlier memory that said "Mobile UI restricted to timeline and header only" is obsolete.
