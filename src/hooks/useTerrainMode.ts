import { useEffect, useState, useCallback } from 'react';

export type TerrainMode = 'classic' | 'satellite';

const STORAGE_TOKEN = 'mapbox_token';
const STORAGE_MODE = 'terrain_mode';

let listeners = new Set<() => void>();
let _mode: TerrainMode = (localStorage.getItem(STORAGE_MODE) as TerrainMode) || 'classic';
const DEFAULT_TOKEN = 'pk.eyJ1IjoidGltYXRldXMiLCJhIjoiY2s2ZmhwMzd2MGNsbjNsbHJjeW9jeTZjeiJ9.nz7s6DdDjUYWUFSpVjFYaw';
let _token: string = localStorage.getItem(STORAGE_TOKEN) || DEFAULT_TOKEN;

function notify() { listeners.forEach((l) => l()); }

export function useTerrainMode() {
  const [mode, setModeState] = useState<TerrainMode>(_mode);
  const [token, setTokenState] = useState<string>(_token);

  useEffect(() => {
    const cb = () => { setModeState(_mode); setTokenState(_token); };
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const setMode = useCallback((m: TerrainMode) => {
    _mode = m;
    localStorage.setItem(STORAGE_MODE, m);
    notify();
  }, []);

  const setToken = useCallback((t: string) => {
    _token = t.trim();
    localStorage.setItem(STORAGE_TOKEN, _token);
    notify();
  }, []);

  return { mode, setMode, token, setToken };
}
