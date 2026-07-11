import { useEffect, useState } from 'react';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';
import { loadMapterhornDEM } from '@/lib/mapterhorn-dem';

interface State { terrain: TerrainData | null; loading: boolean; error: string | null }

const cache = new Map<string, TerrainData>();
const inflight = new Map<string, Promise<TerrainData>>();
const key = (b: GeoBounds) =>
  `${b.minLon.toFixed(5)},${b.minLat.toFixed(5)},${b.maxLon.toFixed(5)},${b.maxLat.toFixed(5)}`;

export function useMapterhornTerrain(bounds: GeoBounds | null, enabled: boolean): State {
  const [state, setState] = useState<State>({ terrain: null, loading: false, error: null });
  useEffect(() => {
    if (!enabled || !bounds) { setState({ terrain: null, loading: false, error: null }); return; }
    const k = key(bounds);
    const hit = cache.get(k);
    if (hit) { setState({ terrain: hit, loading: false, error: null }); return; }
    let cancelled = false;
    setState((p) => ({ terrain: p.terrain, loading: true, error: null }));
    let promise = inflight.get(k);
    if (!promise) {
      promise = loadMapterhornDEM(bounds).then((t) => { cache.set(k, t); return t; });
      inflight.set(k, promise);
      promise.finally(() => inflight.delete(k));
    }
    promise
      .then((t) => { if (!cancelled) setState({ terrain: t, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState((p) => ({ terrain: p.terrain, loading: false, error: e.message })); });
    return () => { cancelled = true; };
  }, [enabled, bounds?.minLon, bounds?.minLat, bounds?.maxLon, bounds?.maxLat]);
  return state;
}
