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
        const lx = applyDeadzone(active.axes[0] ?? 0);
        const ly = applyDeadzone(active.axes[1] ?? 0);
        const rx = applyDeadzone(active.axes[2] ?? 0);
        const ry = applyDeadzone(active.axes[3] ?? 0);
        const b = active.buttons;
        stateRef.current = {
          connected: true,
          leftStick: { x: lx, y: ly },
          rightStick: { x: rx, y: ry },
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
