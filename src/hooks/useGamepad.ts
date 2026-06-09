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

const RIGHT_STICK_PAIRS: Array<[number, number]> = [[2, 3], [3, 4], [4, 5], [2, 5]];

function axisValue(active: Gamepad, idx: number): number {
  const v = active.axes[idx] ?? 0;
  return Number.isFinite(v) && Math.abs(v) <= 1.05 ? v : 0;
}

function pairScore(active: Gamepad, pair: [number, number]): number {
  return Math.hypot(axisValue(active, pair[0]), axisValue(active, pair[1]));
}

function selectRightStickAxes(active: Gamepad, current?: [number, number]): [number, number] {
  // Standard mapping is fully specified by the W3C Gamepad spec:
  // axis 2 = right-stick X, axis 3 = right-stick Y. Always trust it.
  if (active.mapping === 'standard') return [2, 3];

  // Non-standard: we can only guess pair-of-axes, NOT which member is X vs Y.
  // Stick with the first pair that has energy; user can flip via the
  // window.__padSwapRightXY override (toggled from a HUD button) when wrong.
  const validCurrent = current && RIGHT_STICK_PAIRS.some(([x, y]) => x === current[0] && y === current[1]) ? current : undefined;
  if (validCurrent && pairScore(active, validCurrent) > 0.08) return validCurrent;
  for (const pair of RIGHT_STICK_PAIRS) {
    if (pairScore(active, pair) > 0.12) return pair;
  }
  return validCurrent ?? [2, 3];
}

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
      const meta = globalThis as any;
      meta.__padRightAxes = undefined;
      meta.__padRightAxesId = undefined;
    };
    const onDisconnect = (e: GamepadEvent) => {
      setConnected(false);
      setPadId(null);
      stateRef.current = emptyState();
      toast('🎮 Controller disconnected', { description: e.gamepad.id });
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    const initialPads = navigator.getGamepads?.() ?? [];
    for (const p of initialPads) {
      if (p) {
        setConnected(true);
        setPadId(p.id);
        const meta = globalThis as any;
        meta.__padRightAxes = undefined;
        meta.__padRightAxesId = undefined;
        break;
      }
    }

    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      // Merge all connected pads so user can grab any controller and play.
      // Pick whichever pad has the most input "energy" this frame as the active
      // one, but OR all button presses so any pad can press a button.
      const allPads: Gamepad[] = [];
      for (const p of pads) { if (p) allPads.push(p); }
      let active: Gamepad | null = null;
      let bestEnergy = -1;
      for (const p of allPads) {
        let e = 0;
        for (const a of p.axes) e += Math.abs(a ?? 0);
        for (const b of p.buttons) e += (b?.value ?? 0) + (b?.pressed ? 0.5 : 0);
        if (e > bestEnergy) { bestEnergy = e; active = p; }
      }
      if (active) {
        const meta = globalThis as any;
        if (meta.__padIdLogged !== active.id) {
          meta.__padIdLogged = active.id;
          console.log(`[pad] connected id="${active.id}" mapping=${active.mapping} axes=${active.axes.length} buttons=${active.buttons.length}`);
        }

        const lx = applyDeadzone(axisValue(active, 0));
        const ly = applyDeadzone(axisValue(active, 1));

        if (!meta.__padRightAxes || meta.__padRightAxesId !== active.id) {
          meta.__padRightAxes = selectRightStickAxes(active);
          meta.__padRightAxesId = active.id;
        } else {
          meta.__padRightAxes = selectRightStickAxes(active, meta.__padRightAxes as [number, number]);
        }

        const [rxIdx, ryIdx] = (meta.__padRightAxes as [number, number]) ?? [2, 3];
        const swap = !!(globalThis as any).__padSwapRightXY;
        const rawRX = applyDeadzone(axisValue(active, swap ? ryIdx : rxIdx));
        const rawRY = applyDeadzone(axisValue(active, swap ? rxIdx : ryIdx));
        const invX = (globalThis as any).__padInvertRX ? -1 : 1;
        const invY = (globalThis as any).__padInvertRY ? -1 : 1;
        const rightX = rawRX * invX;
        const rightY = rawRY * invY;

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
          const rawMove = active.axes.some((v) => Math.abs(v ?? 0) > 0.25);
          if (hasMove || rawMove) {
            const raw = active.axes.map((v, i) => `${i}:${(v ?? 0).toFixed(2)}`).join(' ');
            console.log(`[pad] L(${lx.toFixed(2)},${ly.toFixed(2)}) R(${rightX.toFixed(2)},${rightY.toFixed(2)}) RX=ax${rxIdx} RY=ax${ryIdx} raw[${raw}]`);
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
