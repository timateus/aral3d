# Mobile Pass — Multi-Step Plan

Goal: on phones/tablets, hide every gamepad-only affordance and make all 8+ levels fully playable with touch. Desktop behavior is unchanged.

## Detection
- Use the existing `useIsMobile()` hook (< 768 px) for React UI gating.
- Add a tiny module helper `isTouchOnly()` (no `matchMedia('(pointer: fine)')`) for non-React files (HUDs, overlays, gamepad util) so the same gate applies everywhere.

## Step 1 — Global gamepad UI cleanup (this turn)
- `GamepadStickFix` returns `null` when touch-only.
- `PadHint` chip components across HUDs (`SpectralEarthHUD`, `GeoGuessrHUD`, `MinistryHUD`, `SandboxHUD`, `DustHUD`, `LifeHUD`, `WaterSimHUD`, `VoxelHUD`, etc.) render nothing on mobile.
- Any "press X / press Y" hint text and gamepad-only floating buttons hidden on mobile.
- Toaster "🎮 Controller connected" suppressed on touch-only devices.

## Step 2 — Universal touch primitives (turn 2)
Reusable components in `src/components/mobile/`:
- `TouchJoystick.tsx` — virtual stick writing into a shared bridge (re-use the `touchInput` pattern already in `src/lib/voxel/touch-input.ts`).
- `TouchActionButton.tsx` — round tappable action buttons with hold/repeat support.
- `MobileLevelChrome.tsx` — Prev / Next / Exit floating buttons replacing arrow keys + LB/RB.
- Helper `useMobileTap()` for single-tap "confirm" flows.

## Step 3 — Per-level controls (turns 3–5)
For each level, wire touch where keyboard/gamepad currently drives behavior:

1. **Level 1 (Explore)** — already touch-friendly via OrbitControls touch; just hide gamepad chrome.
2. **Level 2 (Timeline / Ministry slider)** — add ▲/▼ tap buttons replacing X/B; slider already supports drag.
3. **Level 3 (Spectral)** — add Share, Print, swipe-to-rotate, tap to advance phrase.
4. **Level 4 (GeoGuessr)** — tap map to set pending guess (already works), add a big "Confirm guess" tap button when pending; hide "press X" hint.
5. **Level 5 (Face mode)** — front-camera permission already works on mobile; keep palm tracking; add fallback tap-to-rotate gesture if camera denied.
6. **Level 6/7 (Mini-worlds / Sandbox / Dust / Life / Water)** — joystick for camera/avatar movement, action buttons for primary verbs (paint, pour, place).
7. **Voxel `/voxel`** — already has `VoxelTouchControls`; verify it's mounted and tighten layout for small screens.
8. **Level 8 → Main menu** — already a tap.

## Step 4 — Layout & viewport polish (turn 5)
- Add `viewport-fit=cover` + safe-area insets (`env(safe-area-inset-*)`) to floating HUDs.
- Stack top-bar HUDs vertically under 480 px width; shrink font sizes on chips.
- Prevent rubber-band scroll while a finger is on the canvas (`touch-action: none` on the R3F canvas wrapper).
- Reduce DPR cap on mobile (current `dpr={[2,3]}` is heavy on phones) → `dpr={isMobile ? [1, 1.5] : [2, 3]}`.

## Step 5 — QA & polish (turn 5/6)
- Use `preview_ui--set_preview_device_viewport` mobile + a screenshot per level to verify.
- Ensure every level can be entered, played, and exited without a keyboard.
- Update `mem://features/mobile-ui` memory (currently restricts mobile to "timeline and header only" — this plan supersedes it).

## Files expected to change (high-level)
- New: `src/lib/touch-device.ts`, `src/components/mobile/TouchJoystick.tsx`, `TouchActionButton.tsx`, `MobileLevelChrome.tsx`.
- Edited: `GamepadStickFix.tsx`, all `*HUD.tsx`, `TerrainViewer.tsx`, `Index.tsx`, `MirageToggle.tsx`, `useGamepad.ts` (suppress toast on touch), `index.css` (safe-area helpers).
- Memory update: `mem://features/mobile-ui`.

## Out of scope
- Native packaging (Capacitor). Web only.
- Re-designing the visual aesthetic for mobile — only layout/affordance changes.

I'll execute Step 1 immediately after you approve, then move through steps 2–5 in follow-up turns so each stage is reviewable.
