// Survival stats: thirst, hunger, stamina. Persisted to localStorage.
import { useEffect, useRef, useState } from 'react';

const KEY = 'voxel_stats_v1';

export interface VoxelStats {
  thirst: number;
  hunger: number;
  stamina: number;
}

function load(): VoxelStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.thirst === 'number') return p;
    }
  } catch {}
  return { thirst: 100, hunger: 100, stamina: 100 };
}

let _state: VoxelStats = load();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch {} };

function update(patch: Partial<VoxelStats>) {
  _state = {
    thirst: Math.max(0, Math.min(100, patch.thirst ?? _state.thirst)),
    hunger: Math.max(0, Math.min(100, patch.hunger ?? _state.hunger)),
    stamina: Math.max(0, Math.min(100, patch.stamina ?? _state.stamina)),
  };
  persist(); notify();
}

export function useVoxelStats() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force(x => x + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  return {
    stats: _state,
    drink: (amt = 30) => update({ thirst: _state.thirst + amt }),
    eat: (amt = 30) => update({ hunger: _state.hunger + amt }),
    drain: (k: keyof VoxelStats, amt: number) => update({ [k]: _state[k] - amt } as any),
    reset: () => update({ thirst: 100, hunger: 100, stamina: 100 }),
    set: (patch: Partial<VoxelStats>) => update(patch),
  };
}

export function getStatsSnapshot(): VoxelStats { return { ..._state }; }
export function setStatsRaw(patch: Partial<VoxelStats>) { update(patch); }
