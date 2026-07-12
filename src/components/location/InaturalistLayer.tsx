import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';

export interface InatObservation {
  id: number;
  lat: number;
  lon: number;
  species: string | null;
  commonName: string | null;
  iconicTaxon: string | null;
  photoUrl: string | null;
  observedOn: string | null;
  user: string | null;
  url: string;
}

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  bounds: GeoBounds;
  /** Wider bounding box for observations. Defaults to terrain bounds. */
  queryBounds?: GeoBounds;
  onSelect?: (o: InatObservation | null) => void;
}

const cache = new Map<string, InatObservation[]>();

async function fetchObservations(b: GeoBounds): Promise<InatObservation[]> {
  const key = `${b.minLat.toFixed(3)},${b.minLon.toFixed(3)},${b.maxLat.toFixed(3)},${b.maxLon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const out: InatObservation[] = [];
  // Fetch up to 3 pages (600 obs).
  for (let page = 1; page <= 3; page++) {
    const url = new URL('https://api.inaturalist.org/v1/observations');
    url.searchParams.set('nelat', String(b.maxLat));
    url.searchParams.set('nelng', String(b.maxLon));
    url.searchParams.set('swlat', String(b.minLat));
    url.searchParams.set('swlng', String(b.minLon));
    url.searchParams.set('per_page', '200');
    url.searchParams.set('page', String(page));
    url.searchParams.set('photos', 'true');
    url.searchParams.set('quality_grade', 'research');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('order_by', 'observed_on');
    const res = await fetch(url.toString());
    if (!res.ok) break;
    const json = await res.json();
    for (const r of json.results ?? []) {
      const geo: string | undefined = r.location; // "lat,lon"
      if (!geo) continue;
      const [latS, lonS] = geo.split(',');
      const lat = parseFloat(latS);
      const lon = parseFloat(lonS);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const t = r.taxon ?? {};
      const photo = r.photos?.[0]?.url ?? r.observation_photos?.[0]?.photo?.url ?? null;
      out.push({
        id: r.id,
        lat, lon,
        species: t.name ?? null,
        commonName: t.preferred_common_name ?? null,
        iconicTaxon: t.iconic_taxon_name ?? null,
        photoUrl: photo ? photo.replace('/square.', '/medium.') : null,
        observedOn: r.observed_on_details?.date ?? r.observed_on ?? null,
        user: r.user?.login ?? null,
        url: `https://www.inaturalist.org/observations/${r.id}`,
      });
    }
    if ((json.results ?? []).length < 200) break;
  }
  cache.set(key, out);
  return out;
}

// Palette by iconic taxon — chrome / iridescent aesthetic
const TAXON_COLOR: Record<string, string> = {
  Plantae: '#a8e068',
  Fungi: '#f2b872',
  Animalia: '#e7c8ff',
  Aves: '#8fd3ff',
  Insecta: '#ffd166',
  Arachnida: '#c8a2ff',
  Mollusca: '#ffb4c6',
  Reptilia: '#a8f0d0',
  Amphibia: '#7fe3c4',
  Mammalia: '#f7a8a8',
  Actinopterygii: '#a8c8ff',
};

const InaturalistLayer = ({ terrain, exaggeration, bounds, queryBounds, onSelect }: Props) => {
  const [obs, setObs] = useState<InatObservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = queryBounds ?? bounds;

  useEffect(() => {
    let cancelled = false;
    setObs(null);
    setError(null);
    fetchObservations(q)
      .then((o) => { if (!cancelled) setObs(o); })
      .catch((e) => { if (!cancelled) { console.warn('iNat fetch failed', e); setError(String(e)); setObs([]); } });
    return () => { cancelled = true; };
  }, [q.minLat, q.minLon, q.maxLat, q.maxLon]);

  const group = useMemo(() => {
    if (!obs || obs.length === 0) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);

    const sphere = new THREE.SphereGeometry(1, 20, 16);
    const g = new THREE.Group();
    const disposables: THREE.Material[] = [];

    for (const o of obs) {
      // Clip to widest bounds (already bounded by fetch); place using terrain bounds.
      const nx = (o.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
      const ny = (o.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
      const x = (nx - 0.5) * meshW;
      const z = -((ny - 0.5) * meshH);
      let y = 0.02;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        const cx = Math.floor(nx * (terrain.width - 1));
        const cy = Math.floor((1 - ny) * (terrain.height - 1));
        let e = terrain.elevations[cy * terrain.width + cx];
        if (!isFinite(e)) e = terrain.minElevation;
        y = ((e - terrain.minElevation) / elevRange) * maxH;
      }
      const color = TAXON_COLOR[o.iconicTaxon ?? ''] ?? '#e7c8ff';
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.75,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        emissive: new THREE.Color(color).multiplyScalar(0.15),
        transparent: true,
        opacity: 0.95,
      });
      disposables.push(mat);
      const bubble = new THREE.Mesh(sphere, mat);
      bubble.scale.setScalar(0.055);
      bubble.position.set(x, y + 0.08, z);
      bubble.userData = { inat: o };
      g.add(bubble);

      // subtle halo ring
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
      });
      disposables.push(ringMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.012, z);
      g.add(ring);
    }
    (g.userData as any).__disposables = disposables;
    return g;
  }, [obs, terrain, exaggeration, bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon]);

  useEffect(() => () => {
    if (!group) return;
    const d = (group.userData as any).__disposables as THREE.Material[] | undefined;
    if (d) for (const m of d) m.dispose();
    group.traverse((o: any) => { if (o.geometry) o.geometry.dispose?.(); });
  }, [group]);

  if (!group) return null;
  return (
    <primitive
      object={group}
      onClick={(e: any) => {
        const o = e.object?.userData?.inat as InatObservation | undefined;
        if (o) { e.stopPropagation(); onSelect?.(o); }
      }}
      onPointerOver={(e: any) => {
        if (e.object?.userData?.inat) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    />
  );
};

export default InaturalistLayer;
