type GamepadButtonName = 'x' | 'rb' | 'lb' | 'b' | 'a' | string;

interface GamepadDedupeStore {
  prev: Record<string, boolean>;
  last: Record<string, number>;
  blockCount: number;
  blockedUntil: number;
}

const STORE_KEY = '__aralGamepadDedupeStore';
const DEFAULT_COOLDOWN_MS = 520;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function store(): GamepadDedupeStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: GamepadDedupeStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { prev: {}, last: {}, blockCount: 0, blockedUntil: 0 };
  }
  return g[STORE_KEY]!;
}

export function setGamepadInputBlocked(blocked: boolean, releaseCooldownMs = 650) {
  const s = store();
  s.blockCount = Math.max(0, s.blockCount + (blocked ? 1 : -1));
  if (!blocked) s.blockedUntil = nowMs() + releaseCooldownMs;
}

export function isGamepadInputBlocked() {
  const s = store();
  return s.blockCount > 0 || nowMs() < s.blockedUntil;
}

export function markGamepadButtonConsumed(name: GamepadButtonName) {
  store().last[name] = nowMs();
}

export function consumeGamepadButton(
  name: GamepadButtonName,
  pressed: boolean,
  options: { cooldownMs?: number; ignoreBlock?: boolean } = {},
) {
  const s = store();
  const wasPressed = !!s.prev[name];
  s.prev[name] = pressed;
  if (!pressed || wasPressed) return false;
  if (!options.ignoreBlock && isGamepadInputBlocked()) return false;

  const cooldown = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const t = nowMs();
  if (t - (s.last[name] ?? 0) < cooldown) return false;
  s.last[name] = t;
  return true;
}