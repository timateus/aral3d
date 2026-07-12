import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  queryBounds?: GeoBounds;
  onSelect?: (o: InatObservation | null) => void;
}

const cache = new Map<string, InatObservation[]>();

async function fetchObservations(b: GeoBounds): Promise<InatObservation[]> {
  const key = `${b.minLat.toFixed(3)},${b.minLon.toFixed(3)},${b.maxLat.toFixed(3)},${b.maxLon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const out: InatObservation[] = [];
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
      const geo: string | undefined = r.location;
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

// muted, archival signal palette — no bright hues
const TAXON_TINT: Record<string, [number, number, number]> = {
  Plantae:        [0.86, 0.94, 0.78],
  Fungi:          [0.98, 0.86, 0.68],
  Animalia:       [0.94, 0.90, 0.98],
  Aves:           [0.82, 0.92, 1.00],
  Insecta:        [1.00, 0.92, 0.72],
  Arachnida:      [0.90, 0.82, 1.00],
  Mollusca:       [1.00, 0.88, 0.92],
  Reptilia:       [0.86, 0.98, 0.90],
  Amphibia:       [0.82, 0.96, 0.90],
  Mammalia:       [1.00, 0.88, 0.86],
  Actinopterygii: [0.86, 0.92, 1.00],
};

// Tiny circular sprite w/ soft glow — evidence "signal"
function makeDotTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.10)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

// Radial feather mask for photo fragments (archival scan look)
function makeFeatherMask(): THREE.Texture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s * 0.52);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // filmic grain
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    img.data[i + 3] = Math.max(0, Math.min(255, img.data[i + 3] + n));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

// Cache decoded photo textures + featherMask across renders
const photoTextureCache = new Map<string, THREE.Texture>();

function InatFragment({
  photoUrl, position, tint, mask, onExpire,
}: {
  photoUrl: string;
  position: THREE.Vector3;
  tint: THREE.Color;
  mask: THREE.Texture;
  onExpire: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const bornRef = useRef(performance.now());
  const [tex, setTex] = useState<THREE.Texture | null>(() => photoTextureCache.get(photoUrl) ?? null);
  const { camera } = useThree();
  const lastCamPos = useRef(new THREE.Vector3().copy(camera.position));

  useEffect(() => {
    if (tex) return;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(photoUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      photoTextureCache.set(photoUrl, t);
      setTex(t);
    });
  }, [photoUrl, tex]);

  useFrame(() => {
    if (!matRef.current) return;
    const age = (performance.now() - bornRef.current) / 1000;
    // camera-motion dissolve
    const camMove = camera.position.distanceTo(lastCamPos.current);
    lastCamPos.current.copy(camera.position);

    let base = matRef.current.userData.baseOpacity ?? 0.85;
    // slow fade-in first 0.4s, hold, fade-out after 8s
    const fadeIn = Math.min(1, age / 0.4);
    const fadeOut = age > 8 ? Math.max(0, 1 - (age - 8) / 2.5) : 1;
    // extra dissolve from camera motion
    const motionDissolve = Math.max(0.35, 1 - camMove * 5);
    matRef.current.opacity = base * fadeIn * fadeOut * motionDissolve;
    if (age > 11) onExpire();
  });

  if (!tex) return null;
  // scale roughly ~0.9 units — lays like a scan fragment on terrain
  const aspect = (tex.image?.width ?? 1) / (tex.image?.height ?? 1);
  const w = 0.9;
  const h = w / (aspect || 1);
  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y + 0.006, position.z]}
      rotation={[-Math.PI / 2, 0, (Math.random() - 0.5) * 0.4]}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        alphaMap={mask}
        transparent
        depthWrite={false}
        color={tint}
        userData={{ baseOpacity: 0.9 }}
        toneMapped={false}
      />
    </mesh>
  );
}

const InaturalistLayer = ({ terrain, exaggeration, bounds, queryBounds, onSelect }: Props) => {
  const [obs, setObs] = useState<InatObservation[] | null>(null);
  const q = queryBounds ?? bounds;
  const [fragments, setFragments] = useState<Array<{ key: string; obs: InatObservation; position: THREE.Vector3 }>>([]);

  const dotTex = useMemo(() => makeDotTexture(), []);
  const featherMask = useMemo(() => makeFeatherMask(), []);

  useEffect(() => {
    let cancelled = false;
    setObs(null);
    fetchObservations(q)
      .then((o) => { if (!cancelled) setObs(o); })
      .catch(() => { if (!cancelled) setObs([]); });
    return () => { cancelled = true; };
  }, [q.minLat, q.minLon, q.maxLat, q.maxLon]);

  // Precompute anchored world positions for every obs
  const anchored = useMemo(() => {
    if (!obs) return [] as Array<{ o: InatObservation; pos: THREE.Vector3; tint: THREE.Color }>;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const out: Array<{ o: InatObservation; pos: THREE.Vector3; tint: THREE.Color }> = [];
    for (const o of obs) {
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
      const rgb = TAXON_TINT[o.iconicTaxon ?? ''] ?? [0.95, 0.95, 0.98];
      out.push({ o, pos: new THREE.Vector3(x, y, z), tint: new THREE.Color(rgb[0], rgb[1], rgb[2]) });
    }
    return out;
  }, [obs, terrain, exaggeration, bounds.minLat, bounds.minLon, bounds.maxLat, bounds.maxLon]);

  // Signal points — tiny glowing dots
  const pointsGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(anchored.length * 3);
    const colors = new Float32Array(anchored.length * 3);
    anchored.forEach((a, i) => {
      positions[i * 3 + 0] = a.pos.x;
      positions[i * 3 + 1] = a.pos.y + 0.015;
      positions[i * 3 + 2] = a.pos.z;
      colors[i * 3 + 0] = a.tint.r;
      colors[i * 3 + 1] = a.tint.g;
      colors[i * 3 + 2] = a.tint.b;
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [anchored]);

  // Scratch strokes — short segments oriented randomly on terrain plane
  const scratchGeom = useMemo(() => {
    if (anchored.length === 0) return null;
    const positions: number[] = [];
    const colors: number[] = [];
    for (const a of anchored) {
      const angle = (a.o.id * 37) % 360 * (Math.PI / 180);
      const len = 0.028 + ((a.o.id % 7) * 0.004);
      const dx = Math.cos(angle) * len;
      const dz = Math.sin(angle) * len;
      positions.push(a.pos.x - dx, a.pos.y + 0.01, a.pos.z - dz);
      positions.push(a.pos.x + dx, a.pos.y + 0.01, a.pos.z + dz);
      colors.push(a.tint.r, a.tint.g, a.tint.b, a.tint.r, a.tint.g, a.tint.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [anchored]);

  // Randomly project a couple of photo fragments periodically (never more than 3 alive)
  useEffect(() => {
    if (anchored.length === 0) return;
    const withPhotos = anchored.filter((a) => a.o.photoUrl);
    if (withPhotos.length === 0) return;
    let alive = true;
    const spawn = () => {
      if (!alive) return;
      setFragments((cur) => {
        if (cur.length >= 3) return cur;
        const pick = withPhotos[Math.floor(Math.random() * withPhotos.length)];
        return [...cur, { key: `${pick.o.id}-${Date.now()}`, obs: pick.o, position: pick.pos }];
      });
    };
    // initial delay + interval
    const t0 = setTimeout(spawn, 1200);
    const iv = setInterval(spawn, 4500);
    return () => { alive = false; clearTimeout(t0); clearInterval(iv); };
  }, [anchored]);

  const handlePointsClick = (e: any) => {
    if (typeof e.index !== 'number') return;
    const a = anchored[e.index];
    if (!a) return;
    e.stopPropagation();
    onSelect?.(a.o);
    // also spawn a photo fragment on click if available
    if (a.o.photoUrl) {
      setFragments((cur) => [...cur, { key: `${a.o.id}-c-${Date.now()}`, obs: a.o, position: a.pos }]);
    }
  };

  if (anchored.length === 0) return null;

  return (
    <group>
      {/* scratch strokes */}
      {scratchGeom && (
        <lineSegments geometry={scratchGeom}>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </lineSegments>
      )}
      {/* soft translucent halo patches (bloom-ish) */}
      <points geometry={pointsGeom} onPointerDown={handlePointsClick}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <pointsMaterial
          size={0.28}
          map={dotTex}
          vertexColors
          transparent
          depthWrite={false}
          opacity={0.55}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          alphaTest={0.01}
          toneMapped={false}
        />
      </points>
      {/* crisp signal cores */}
      <points geometry={pointsGeom}>
        <pointsMaterial
          size={0.07}
          map={dotTex}
          vertexColors
          transparent
          depthWrite={false}
          opacity={0.95}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          alphaTest={0.01}
          toneMapped={false}
        />
      </points>
      {/* projected photo fragments */}
      {fragments.map((f) => (
        <InatFragment
          key={f.key}
          photoUrl={f.obs.photoUrl!}
          position={f.position}
          tint={new THREE.Color(0.95, 0.94, 0.9)}
          mask={featherMask}
          onExpire={() => setFragments((cur) => cur.filter((x) => x.key !== f.key))}
        />
      ))}
    </group>
  );
};

export default InaturalistLayer;
