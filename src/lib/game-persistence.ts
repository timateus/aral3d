// Tiny versioned localStorage wrapper for per-level game state.
// All keys are namespaced under "aral3d:".

const PREFIX = 'aral3d:v1:';

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota / private mode — ignore.
  }
}

export function clearGameState(): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// Stable per-browser player handle for the GeoGuessr leaderboard.
const PLAYER_KEY = PREFIX + 'player-name';
export function getPlayerName(): string {
  try {
    const existing = localStorage.getItem(PLAYER_KEY);
    if (existing) return existing;
    const suffix = Math.random().toString(36).slice(2, 6);
    const name = `player-${suffix}`;
    localStorage.setItem(PLAYER_KEY, name);
    return name;
  } catch {
    return 'anon';
  }
}
