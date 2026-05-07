import { useEffect, useState } from 'react';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';
import { loadMapboxDEM } from '@/lib/mapbox-dem';

interface State {
  terrain: TerrainData | null;
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, TerrainData>();
const inflight = new Map<string, Promise<TerrainData>>();

function key(b: GeoBounds, token: string) {
  return `${token.slice(-8)}|${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
}

/** Loads (and caches) a Mapbox-derived TerrainData for given bounds. */
export function useMapboxTerrain(bounds: GeoBounds | null, token: string, enabled: boolean): State {
  const [state, setState] = useState<State>({ terrain: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled || !bounds || !token) {
      setState({ terrain: null, loading: false, error: null });
      return;
    }
    const k = key(bounds, token);
    const cached = cache.get(k);
    if (cached) {
      setState((prev) => ({ terrain: cached, loading: false, error: null }));
      return;
    }
    let cancelled = false;
    // Keep previous terrain visible while loading new tile (prevents game flicker on recenter)
    setState((prev) => ({ terrain: prev.terrain, loading: true, error: null }));
    let promise = inflight.get(k);
    if (!promise) {
      promise = loadMapboxDEM(bounds, token).then((t) => { cache.set(k, t); return t; });
      inflight.set(k, promise);
      promise.finally(() => inflight.delete(k));
    }
    promise
      .then((t) => { if (!cancelled) setState({ terrain: t, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState((prev) => ({ terrain: prev.terrain, loading: false, error: e.message })); });
    return () => { cancelled = true; };
  }, [enabled, token, bounds?.minLon, bounds?.minLat, bounds?.maxLon, bounds?.maxLat]);

  return state;
}
