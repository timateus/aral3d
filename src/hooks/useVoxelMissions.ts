// Tracks mission progress, listens to global 'voxel:mission' CustomEvents.
import { useEffect, useState, useCallback } from 'react';
import { MISSIONS, type MissionEvent } from '@/lib/voxel/missions';
import { toast } from 'sonner';

const KEY = 'voxel_missions_v1';

type Progress = Record<string, number>;
function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
let _progress: Progress = load();
const _completed = new Set<string>();
for (const m of MISSIONS) if ((_progress[m.id] ?? 0) >= m.target) _completed.add(m.id);

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(_progress)); } catch {} };

export function dispatchMissionEvent(e: MissionEvent) {
  window.dispatchEvent(new CustomEvent('voxel:mission', { detail: e }));
}

export function useVoxelMissions() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force(x => x + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = (ev as CustomEvent<MissionEvent>).detail;
      let any = false;
      for (const m of MISSIONS) {
        if (_completed.has(m.id)) continue;
        const inc = m.match(e);
        if (inc > 0) {
          const cur = (_progress[m.id] ?? 0) + inc;
          _progress[m.id] = Math.min(m.target, cur);
          any = true;
          if (cur >= m.target) {
            _completed.add(m.id);
            toast.success(`Mission complete: ${m.title}`);
          }
        }
      }
      if (any) { persist(); notify(); }
    };
    window.addEventListener('voxel:mission', handler);
    return () => window.removeEventListener('voxel:mission', handler);
  }, []);

  const reset = useCallback(() => {
    _progress = {};
    _completed.clear();
    persist(); notify();
  }, []);

  return {
    missions: MISSIONS.map(m => ({
      ...m,
      progress: _progress[m.id] ?? 0,
      completed: _completed.has(m.id),
    })),
    reset,
  };
}
