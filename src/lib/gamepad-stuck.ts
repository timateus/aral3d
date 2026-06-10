// Filters out "ghost" / stuck pad buttons. When two controllers are
// connected, one of them frequently reports a button as continuously
// pressed (dead D-pad, sticky trigger, etc.). Because button state is
// OR-merged across pads for resilience, a single stuck button on pad B
// would mask edge presses from pad A forever. This helper tracks how
// long each (padIndex, buttonIndex) has been continuously pressed and
// treats it as released once it crosses STUCK_MS.

const STUCK_MS = 3500;
const starts = new Map<number, Map<number, number>>();

function table(padIdx: number) {
  let m = starts.get(padIdx);
  if (!m) { m = new Map(); starts.set(padIdx, m); }
  return m;
}

function isStuck(padIdx: number, btnIdx: number, pressed: boolean, now: number): boolean {
  const m = table(padIdx);
  if (!pressed) { m.delete(btnIdx); return false; }
  const start = m.get(btnIdx);
  if (start === undefined) { m.set(btnIdx, now); return false; }
  return (now - start) > STUCK_MS;
}

export function padButtonPressed(pad: Gamepad, btnIdx: number, now = performance.now()): boolean {
  const raw = !!pad.buttons[btnIdx]?.pressed;
  if (!raw) { isStuck(pad.index, btnIdx, false, now); return false; }
  return !isStuck(pad.index, btnIdx, true, now);
}

export function padButtonValue(pad: Gamepad, btnIdx: number, now = performance.now()): number {
  const v = pad.buttons[btnIdx]?.value ?? 0;
  const pressed = v > 0.05 || !!pad.buttons[btnIdx]?.pressed;
  if (!pressed) { isStuck(pad.index, btnIdx, false, now); return 0; }
  return isStuck(pad.index, btnIdx, true, now) ? 0 : v;
}

export function anyPadPressed(pads: Gamepad[], btnIdx: number, now = performance.now()): boolean {
  for (const p of pads) if (padButtonPressed(p, btnIdx, now)) return true;
  return false;
}

export function maxPadValue(pads: Gamepad[], btnIdx: number, now = performance.now()): number {
  let max = 0;
  for (const p of pads) { const v = padButtonValue(p, btnIdx, now); if (v > max) max = v; }
  return max;
}
