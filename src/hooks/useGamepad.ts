import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface GamepadState {
  connected: boolean;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  buttons: {
    a: boolean; b: boolean; x: boolean; y: boolean;
    lb: boolean; rb: boolean;
    lt: number; rt: number;
    up: boolean; down: boolean; left: boolean; right: boolean;
    start: boolean; back: boolean;
  };
}

const DEADZONE = 0.15;

function applyDeadzone(v: number): number {
  if (Math.abs(v) < DEADZONE) return 0;
  // rescale so values just outside deadzone start from 0
  const sign = Math.sign(v);
  return sign * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE));
}

function emptyState(): GamepadState {
  return {
    connected: false,
    leftStick: { x: 0, y: 0 },
    rightStick: { x: 0, y: 0 },
    buttons: {
      a: false, b: false, x: false, y: false,
      lb: false, rb: false, lt: 0, rt: 0,
      up: false, down: false, left: false, right: false,
      start: false, back: false,
    },
  };
}

/**
 * Polls navigator.getGamepads() and writes the latest snapshot to a ref
 * so consumers (useFrame loops) can read without re-rendering.
 * Returns a stable ref + a `connected` state for UI display.
 */
export function useGamepad() {
  const stateRef = useRef<GamepadState>(emptyState());
  const [connected, setConnected] = useState(false);
  const [padId, setPadId] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;

    const onConnect = (e: GamepadEvent) => {
      setConnected(true);
      setPadId(e.gamepad.id);
      toast.success('🎮 Controller connected', { description: e.gamepad.id });
    };
    const onDisconnect = (e: GamepadEvent) => {
      setConnected(false);
      setPadId(null);
      stateRef.current = emptyState();
      toast('🎮 Controller disconnected', { description: e.gamepad.id });
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Some browsers (Safari) won't fire connect until first input — poll initially
    const initialPads = navigator.getGamepads?.() ?? [];
    for (const p of initialPads) {
      if (p) { setConnected(true); setPadId(p.id); break; }
    }

    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let active: Gamepad | null = null;
      for (const p of pads) { if (p) { active = p; break; } }
      if (active) {
        // One-time mapping log per pad id.
        const meta = globalThis as any;
        if (meta.__padIdLogged !== active.id) {
          meta.__padIdLogged = active.id;
          console.log(`[pad] connected id="${active.id}" mapping=${active.mapping} axes=${active.axes.length} buttons=${active.buttons.length}`);
        }
        const lx = applyDeadzone(active.axes[0] ?? 0);
        const ly = applyDeadzone(active.axes[1] ?? 0);

        // --- Right-stick auto-calibration ---
        // Some pads report triggers / unused axes with a non-zero idle value
        // (e.g. -1 or +1 at rest). That breaks naive "pick largest magnitude".
        // We capture per-axis idle values on first frame, then measure DELTA
        // from idle and assign the right stick to two DIFFERENT axes — one
        // for X (left/right), one for Y (up/down) — based on which axis has
        // been observed to move while the other was still.
        const meta2 = globalThis as any;
        if (!meta2.__padIdle) {
          // capture idle baseline (assumes user isn't moving sticks at load)
          meta2.__padIdle = active.axes.map((v) => v ?? 0);
          meta2.__padMaxDelta = active.axes.map(() => 0);
          meta2.__padRX = -1;
          meta2.__padRY = -1;
          console.log('[pad] idle baseline captured', meta2.__padIdle);
        }
        const idle: number[] = meta2.__padIdle;
        const maxDelta: number[] = meta2.__padMaxDelta;
        const deltas = active.axes.map((v, i) => (v ?? 0) - (idle[i] ?? 0));
        for (let i = 0; i < deltas.length; i++) {
          const a = Math.abs(deltas[i]);
          if (a > maxDelta[i]) maxDelta[i] = a;
        }

        // Candidate axes for right stick (skip 0,1 which are left stick)
        const candidates = [2, 3, 4, 5].filter((i) => i < active.axes.length);
        // Pick the two axes with the highest observed movement so far.
        // Tie-break by current instantaneous magnitude.
        const ranked = [...candidates].sort((a, b) => {
          const da = maxDelta[a] - maxDelta[b];
          if (Math.abs(da) > 0.05) return -da;
          return Math.abs(deltas[b]) - Math.abs(deltas[a]);
        });
        // Assign first to RX, second to RY (heuristic: most users move X first
        // when testing). Persist so it doesn't flip every frame.
        if (meta2.__padRX === -1 && ranked[0] !== undefined && maxDelta[ranked[0]] > 0.2) {
          meta2.__padRX = ranked[0];
          console.log(`[pad] RX axis locked → ${ranked[0]}`);
        }
        if (meta2.__padRY === -1 && ranked[1] !== undefined && maxDelta[ranked[1]] > 0.2 && ranked[1] !== meta2.__padRX) {
          meta2.__padRY = ranked[1];
          console.log(`[pad] RY axis locked → ${ranked[1]}`);
        }
        const rxAxis = meta2.__padRX === -1 ? 2 : meta2.__padRX;
        const ryAxis = meta2.__padRY === -1 ? 3 : meta2.__padRY;
        const rx = applyDeadzone(deltas[rxAxis] ?? 0);
        const ry = applyDeadzone(deltas[ryAxis] ?? 0);
        // The controller reports the right-stick axes crossed in this app's camera modes.
        // Normalize once here so every consumer gets horizontal on x and vertical on y.
        const rightX = ry;
        const rightY = rx;
        const b = active.buttons;
        const next: GamepadState = {
          connected: true,
            leftStick: { x: lx, y: ly },
            rightStick: { x: rightX, y: rightY },
          buttons: {
            a: !!b[0]?.pressed,
            b: !!b[1]?.pressed,
            x: !!b[2]?.pressed,
            y: !!b[3]?.pressed,
            lb: !!b[4]?.pressed,
            rb: !!b[5]?.pressed,
            lt: b[6]?.value ?? 0,
            rt: b[7]?.value ?? 0,
            back: !!b[8]?.pressed,
            start: !!b[9]?.pressed,
            up: !!b[12]?.pressed,
            down: !!b[13]?.pressed,
            left: !!b[14]?.pressed,
            right: !!b[15]?.pressed,
          },
        };
        // Debug logging — throttled stick logs, edge-triggered button logs.
        const prev = stateRef.current;
        const btnNames: (keyof GamepadState['buttons'])[] = ['a','b','x','y','lb','rb','up','down','left','right','start','back'];
        for (const n of btnNames) {
          if (next.buttons[n] && !prev.buttons[n]) console.log(`[pad] BTN ↓ ${n}`);
          if (!next.buttons[n] && prev.buttons[n]) console.log(`[pad] BTN ↑ ${n}`);
        }
        const now = performance.now();
        if (!(globalThis as any).__padLogT) (globalThis as any).__padLogT = 0;
        if (now - (globalThis as any).__padLogT > 200) {
          const hasMove = lx || ly || rightX || rightY || next.buttons.lt > 0.05 || next.buttons.rt > 0.05;
          const rawMove = active.axes.some((v, i) => Math.abs((v ?? 0)) > 0.25 && i > 3);
          if (hasMove || rawMove) {
            const m = globalThis as any;
            const raw = active.axes
              .map((v, i) => `${i}:${(v ?? 0).toFixed(2)}(Δ${((v ?? 0) - (m.__padIdle?.[i] ?? 0)).toFixed(2)})`)
              .join(' ');
            console.log(
              `[pad] L(${lx.toFixed(2)},${ly.toFixed(2)}) R(${rightX.toFixed(2)},${rightY.toFixed(2)}) ` +
              `RX=ax${m.__padRX} RY=ax${m.__padRY} raw[${raw}]`,
            );
            (globalThis as any).__padLogT = now;
          }
        }
        stateRef.current = next;
      } else {
        if (stateRef.current.connected) stateRef.current = emptyState();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  return { stateRef, connected, padId };
}

// Singleton ref so multiple components share a single poll loop's data.
// (Each useGamepad() instance still polls, but they all see the same browser state.)
