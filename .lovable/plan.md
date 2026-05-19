## Add Gamepad Controller Support

Wire the browser Gamepad API into the existing camera + Game Mode controls so an Xbox, PlayStation, or generic USB/Bluetooth controller works on Mac.

### Scope
- **Explore mode / Walk mode** (orbit camera): left stick pans, right stick rotates, triggers zoom in/out, Q/E equivalents on shoulder buttons.
- **Game Mode** (avatar): left stick moves avatar, right stick orbits camera, A/Cross button pours water (same as Space), B/Circle skips reward.
- Small "🎮 Controller connected" toast/indicator when a pad is detected.

### Technical Plan

1. **New hook `src/hooks/useGamepad.ts`**
   - Polls `navigator.getGamepads()` each animation frame via `requestAnimationFrame`.
   - Normalizes Xbox + PlayStation + standard mapping (both follow W3C "standard" layout on Mac).
   - Applies deadzone (~0.15) on sticks.
   - Exposes `{ connected, leftStick:{x,y}, rightStick:{x,y}, buttons:{a,b,x,y,lb,rb,lt,rt,...} }` via refs (no React re-render per frame).
   - Fires `gamepadconnected` / `gamepaddisconnected` toast.

2. **`src/components/MapControls.tsx` (WASDHandler)**
   - Read gamepad each `useFrame`:
     - Left stick X/Y → same XZ-plane translation as WASD (scaled by stick magnitude).
     - Right stick X/Y → rotate orbit camera around target (azimuth/polar via `orbitRef.current` spherical math, similar to right-mouse drag).
     - LT/RT → dolly in/out (zoom).
     - LB/RB → Q/E vertical movement.
   - Reuse the existing `wasd-move` custom event so orbit target stays in sync.

3. **`src/components/GameMode.tsx`**
   - Inside the existing `useFrame` loop, read gamepad refs:
     - Left stick → `moveDir` (replaces/augments WASD vector, camera-relative like keyboard path).
     - Right stick → orbit camera around avatar (modify `orbitRef.target` is already on avatar; rotate camera position around it).
     - `A` button held → same as `spaceHeld` (water pour + mission completion check).

4. **Connection indicator**
   - Tiny pill in the top toolbar (right cluster) showing `🎮` icon when connected. Tooltip lists detected pad id.
   - Use `sonner` toast on connect/disconnect.

### Supported controllers on Mac
- Xbox Wireless (Series / One) — Bluetooth on macOS 13+, or USB-C
- PlayStation DualSense (PS5) and DualShock 4 (PS4) — Bluetooth or USB
- Nintendo Switch Pro — Bluetooth (button mapping may differ slightly)
- Generic USB HID gamepads (8BitDo, etc.)

### Out of scope
- Haptic rumble feedback
- Remapping UI
- Menu/UI navigation with the pad (only camera + game movement)

### Files touched
- new: `src/hooks/useGamepad.ts`
- edit: `src/components/MapControls.tsx`
- edit: `src/components/GameMode.tsx`
- edit: `src/pages/Index.tsx` (small connection indicator)
