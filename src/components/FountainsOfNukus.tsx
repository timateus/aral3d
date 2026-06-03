import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, Droplets, MapPin, Loader2 } from 'lucide-react';

// Nukus city centre + envelope (degrees). Plate Carrée at this latitude has ~27% E/W stretch
// but for a local 10 km tile we keep the plane aspect proportional to deg-span so OSM tiles match.
const NUKUS = { lat: 42.4531, lon: 59.6103 };
const HALF_LAT = 0.055; // ±6 km N/S
const HALF_LON = 0.075; // ±6 km E/W
const BBOX = {
  minLat: NUKUS.lat - HALF_LAT, maxLat: NUKUS.lat + HALF_LAT,
  minLon: NUKUS.lon - HALF_LON, maxLon: NUKUS.lon + HALF_LON,
};
const LAT_SPAN = BBOX.maxLat - BBOX.minLat;
const LON_SPAN = BBOX.maxLon - BBOX.minLon;

// 3D plane sized so 1 unit ≈ ~600 m. Aspect matches Web-Mercator pixel aspect at this latitude.
const PLANE_W = 14;
// At Mercator, vertical/horizontal pixel ratio for an equal lat/lon span is 1/cos(lat) flipped.
// We sized plane to match what we crop from the tile sheet (computed via Mercator below).
const MERC_ASPECT = (() => {
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const dy = merc(BBOX.maxLat) - merc(BBOX.minLat);
  const dx = ((BBOX.maxLon - BBOX.minLon) * Math.PI) / 180;
  return dy / dx; // height/width
})();
const PLANE_H = PLANE_W * MERC_ASPECT;

// Geo → plane (x east, z south)
const project = ({ lat, lon }: { lat: number; lon: number }): [number, number] => {
  const merc = (l: number) => Math.log(Math.tan(Math.PI / 4 + (l * Math.PI / 180) / 2));
  const u = (lon - BBOX.minLon) / LON_SPAN;           // 0..1 west→east
  const vMercTop = merc(BBOX.maxLat);
  const vMercBot = merc(BBOX.minLat);
  const v = (vMercTop - merc(lat)) / (vMercTop - vMercBot); // 0..1 north→south
  const x = (u - 0.5) * PLANE_W;
  const z = (v - 0.5) * PLANE_H;
  return [x, z];
};

interface POI {
  id: string;
  name: string;
  kind: 'bazaar' | 'airport' | 'museum' | 'university' | 'park' | 'station' | 'gov' | 'stadium';
  lat: number; lon: number;
  blurb: string;
}

const POIS: POI[] = [
  { id: 'savitsky',  name: 'Savitsky Museum',     kind: 'museum',     lat: 42.4628, lon: 59.6086, blurb: '"Louvre of the Steppe" — 80k+ avant-garde works.' },
  { id: 'jipek',     name: 'Jipek Joli Bazaar',   kind: 'bazaar',     lat: 42.4570, lon: 59.6210, blurb: 'Central market — melons, dried fish, spices.' },
  { id: 'airport',   name: 'Nukus Int’l Airport', kind: 'airport',    lat: 42.4884, lon: 59.6233, blurb: 'NCU — gateway to Karakalpakstan.' },
  { id: 'berdakh',   name: 'Berdakh University',  kind: 'university', lat: 42.4660, lon: 59.6020, blurb: 'Karakalpak State University.' },
  { id: 'park',      name: 'Central Park',        kind: 'park',       lat: 42.4555, lon: 59.6080, blurb: 'Shade, benches, pigeons.' },
  { id: 'station',   name: 'Railway Station',     kind: 'station',    lat: 42.4380, lon: 59.5800, blurb: 'Trains to Tashkent and Beyneu.' },
  { id: 'amir',      name: 'Amir Timur Square',   kind: 'gov',        lat: 42.4612, lon: 59.6128, blurb: 'Civic heart of the city.' },
  { id: 'stadium',   name: 'Nukus Stadium',       kind: 'stadium',    lat: 42.4500, lon: 59.6260, blurb: 'Home of FK Aral.' },
  { id: 'mosque',    name: 'Central Mosque',      kind: 'gov',        lat: 42.4598, lon: 59.6155, blurb: 'Friday prayers and ceramic tilework.' },
  { id: 'hospital',  name: 'Regional Hospital',   kind: 'gov',        lat: 42.4500, lon: 59.5970, blurb: 'Largest medical facility.' },
];

const FOUNTAIN_SITES: { id: string; name: string; rationale: string; lat: number; lon: number }[] = [
  { id: 'f1',  name: 'Bazaar Plaza',        rationale: 'Highest foot-traffic; shoppers + sellers all day.',  lat: 42.4575, lon: 59.6203 },
  { id: 'f2',  name: 'Amir Timur Sq.',      rationale: 'Civic landmark — visible, central, ceremonial.',    lat: 42.4615, lon: 59.6132 },
  { id: 'f3',  name: 'Museum Forecourt',    rationale: 'Welcomes tourists arriving at the Savitsky.',       lat: 42.4624, lon: 59.6092 },
  { id: 'f4',  name: 'University Quad',     rationale: 'Students refill bottles between classes.',          lat: 42.4655, lon: 59.6035 },
  { id: 'f5',  name: 'Park Entrance',       rationale: 'Cool relief for families using the park.',          lat: 42.4549, lon: 59.6088 },
  { id: 'f6',  name: 'Airport Terminal',    rationale: 'First taste of Nukus for arriving passengers.',     lat: 42.4878, lon: 59.6242 },
  { id: 'f7',  name: 'Stadium Gates',       rationale: 'Match-day crowds need hydration.',                  lat: 42.4505, lon: 59.6248 },
  { id: 'f8',  name: 'Rail Forecourt',      rationale: 'Travellers between long-distance trains.',          lat: 42.4392, lon: 59.5818 },
  { id: 'f9',  name: 'Hospital Plaza',      rationale: 'Patients and families waiting outside.',            lat: 42.4506, lon: 59.5982 },
  { id: 'f10', name: 'Riverside Promenade', rationale: 'Future Amu Darya-fed cooling oasis.',               lat: 42.4470, lon: 59.6390 },
];

// ─── OSM tile loader ─────────────────────────────────────────────────────────
function lonToTileX(lon: number, z: number) { return ((lon + 180) / 360) * Math.pow(2, z); }
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
}

async function buildOsmTexture(setStatus: (s: string) => void): Promise<THREE.CanvasTexture> {
  const Z = 13;
  const tx0f = lonToTileX(BBOX.minLon, Z);
  const tx1f = lonToTileX(BBOX.maxLon, Z);
  const ty0f = latToTileY(BBOX.maxLat, Z); // north → smaller y
  const ty1f = latToTileY(BBOX.minLat, Z);
  const tx0 = Math.floor(tx0f), tx1 = Math.floor(tx1f);
  const ty0 = Math.floor(ty0f), ty1 = Math.floor(ty1f);
  const cols = tx1 - tx0 + 1;
  const rows = ty1 - ty0 + 1;

  const TILE = 256;
  const sheet = document.createElement('canvas');
  sheet.width = cols * TILE; sheet.height = rows * TILE;
  const sctx = sheet.getContext('2d')!;
  sctx.fillStyle = '#e9e3d4'; sctx.fillRect(0, 0, sheet.width, sheet.height);

  setStatus(`Loading ${cols * rows} OSM tiles…`);

  // CARTO Voyager (no-label, light) — has CORS and is great for an underlay; falls back to OSM.
  const providers = [
    (z: number, x: number, y: number) => `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
    (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  ];

  const loadOne = (x: number, y: number) => new Promise<void>((resolve) => {
    let providerIdx = 0;
    const tryNext = () => {
      if (providerIdx >= providers.length) return resolve();
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        sctx.drawImage(img, (x - tx0) * TILE, (y - ty0) * TILE);
        resolve();
      };
      img.onerror = () => { providerIdx++; tryNext(); };
      img.src = providers[providerIdx](Z, x, y);
    };
    tryNext();
  });

  const jobs: Promise<void>[] = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) jobs.push(loadOne(x, y));
  await Promise.all(jobs);

  // Crop sheet to exact bbox
  const cropX = (tx0f - tx0) * TILE;
  const cropY = (ty0f - ty0) * TILE;
  const cropW = (tx1f - tx0f) * TILE;
  const cropH = (ty1f - ty0f) * TILE;

  const out = document.createElement('canvas');
  // Keep good resolution
  out.width = Math.round(cropW);
  out.height = Math.round(cropH);
  const octx = out.getContext('2d')!;
  octx.drawImage(sheet, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);

  // Subtle dark tint so labels pop
  octx.fillStyle = 'rgba(8, 14, 26, 0.18)';
  octx.fillRect(0, 0, out.width, out.height);

  // North arrow + scale
  octx.fillStyle = '#0c1116'; octx.strokeStyle = '#0c1116';
  octx.font = '600 18px ui-monospace, monospace';
  octx.fillText('NUKUS · 42.45°N 59.61°E', 14, 26);
  octx.fillRect(14, out.height - 22, 90, 3);
  octx.font = '11px ui-monospace, monospace';
  octx.fillText('~ 2 km', 14, out.height - 6);
  octx.lineWidth = 3;
  octx.strokeRect(1.5, 1.5, out.width - 3, out.height - 3);

  const tex = new THREE.CanvasTexture(out);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ─── 3D scene pieces ─────────────────────────────────────────────────────────

const KIND_COLOR: Record<POI['kind'], string> = {
  bazaar: '#d97706', airport: '#0ea5e9', museum: '#a855f7', university: '#10b981',
  park: '#65a30d', station: '#64748b', gov: '#475569', stadium: '#ef4444',
};

function PoiMarker({ poi }: { poi: POI }) {
  const [x, z] = project(poi);
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[x, 0.02, z]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <cylinderGeometry args={[0.09, 0.09, 0.05, 20]} />
        <meshStandardMaterial color={KIND_COLOR[poi.kind]} emissive={KIND_COLOR[poi.kind]} emissiveIntensity={0.5} />
      </mesh>
      {hovered && (
        <Html distanceFactor={9} position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(15,17,21,0.95)', color: 'white', padding: '6px 10px',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.4,
            border: `1px solid ${KIND_COLOR[poi.kind]}`, maxWidth: 220, whiteSpace: 'normal',
          }}>
            <div style={{ color: KIND_COLOR[poi.kind], textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.15em', marginBottom: 4 }}>{poi.kind}</div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{poi.name}</div>
            <div style={{ opacity: 0.8, fontSize: 10 }}>{poi.blurb}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function FountainMarker({
  site, index, selected, onSelect,
}: {
  site: typeof FOUNTAIN_SITES[number];
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [x, z] = project(site);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.18;
      ringRef.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          color={selected ? '#22d3ee' : '#38bdf8'}
          emissive={selected ? '#22d3ee' : '#0ea5e9'}
          emissiveIntensity={selected ? 1.4 : 0.8}
          metalness={0.4} roughness={0.2}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.22, 0.28, 32]} />
        <meshBasicMaterial color={selected ? '#22d3ee' : '#38bdf8'} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.6} />
      </mesh>
      {/* Compact number badge always visible — full name only on hover/selected */}
      <Html distanceFactor={9} position={[0, 0.85, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
        <div style={{
          background: selected || hovered ? '#22d3ee' : 'rgba(8,47,73,0.92)',
          color: selected || hovered ? '#0c1116' : '#bae6fd',
          padding: '1px 5px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10, fontWeight: 700,
          border: '1px solid #22d3ee',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
          transform: 'translateY(-50%)',
        }}>
          {selected || hovered ? `F${index + 1} · ${site.name}` : `F${index + 1}`}
        </div>
      </Html>
    </group>
  );
}

function MapPlane({ texture }: { texture: THREE.Texture | null }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
      {texture
        ? <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
        : <meshStandardMaterial color="#1c2230" roughness={1} />}
    </mesh>
  );
}

interface Props { onClose: () => void; }

const FountainsOfNukus = ({ onClose }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [status, setStatus] = useState<string>('Loading map tiles…');

  useEffect(() => {
    const prev = document.title;
    document.title = 'Water Fountains of Nukus';
    let cancelled = false;
    buildOsmTexture(setStatus).then(t => { if (!cancelled) { setTexture(t); setStatus(''); } })
      .catch(e => setStatus(`Map failed to load: ${String(e?.message ?? e)}`));
    return () => { cancelled = true; document.title = prev; };
  }, []);

  const selectedSite = FOUNTAIN_SITES.find(s => s.id === selected);
  const selectedIdx = selected ? FOUNTAIN_SITES.findIndex(s => s.id === selected) : -1;

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-[#0b1220] via-[#0e1726] to-[#050810] text-white">
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 border border-white/20 text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors font-mono"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 font-mono flex items-center gap-2 justify-center">
            <Droplets className="w-3.5 h-3.5" /> Water Fountains of Nukus
          </div>
          <div className="text-[9px] text-white/40 font-mono mt-0.5">
            10 candidate sites · drag to rotate · scroll to zoom · hover landmark · click droplet
          </div>
        </div>
        <div className="w-[80px]" />
      </div>

      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 11, 11], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0a1020']} />
        <fog attach="fog" args={['#0a1020', 28, 90]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 12, 5]} intensity={1.0} />
        <directionalLight position={[-8, 6, -4]} intensity={0.3} color="#88aaff" />

        <MapPlane texture={texture} />

        {POIS.map((p) => <PoiMarker key={p.id} poi={p} />)}
        {FOUNTAIN_SITES.map((s, i) => (
          <FountainMarker
            key={s.id}
            site={s}
            index={i}
            selected={selected === s.id}
            onSelect={() => setSelected(prev => prev === s.id ? null : s.id)}
          />
        ))}

        <OrbitControls
          target={[0, 0, 0]}
          enableDamping
          minDistance={4}
          maxDistance={32}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>

      {/* Loading status */}
      {status && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-black/70 border border-white/15 px-3 py-1.5 font-mono text-[10px] text-white/70 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> {status}
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-20 left-4 z-10 bg-black/70 border border-white/15 px-3 py-2 font-mono text-[10px] backdrop-blur-sm">
        <div className="text-white/50 uppercase tracking-widest mb-1.5 text-[9px]">Legend</div>
        {Object.entries(KIND_COLOR).map(([k, c]) => (
          <div key={k} className="flex items-center gap-2 text-white/80">
            <span className="inline-block w-2 h-2" style={{ background: c }} />
            <span className="capitalize">{k}</span>
          </div>
        ))}
        <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-center gap-2 text-cyan-300">
          <Droplets className="w-3 h-3" /> Fountain site (F1–F10)
        </div>
        <div className="mt-1 text-[9px] text-white/40">Hover landmark for details</div>
      </div>

      {/* Fountain list — sidebar */}
      <div className="absolute top-20 right-4 z-10 bg-black/70 border border-white/15 px-3 py-2 font-mono text-[10px] backdrop-blur-sm w-[200px]">
        <div className="text-white/50 uppercase tracking-widest mb-1.5 text-[9px]">Fountain Sites</div>
        <div className="space-y-0.5">
          {FOUNTAIN_SITES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelected(prev => prev === s.id ? null : s.id)}
              className={`w-full text-left flex items-center gap-2 px-1.5 py-1 transition-colors ${
                selected === s.id ? 'bg-cyan-400/20 text-cyan-200' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <span className={`inline-block w-5 text-center text-[9px] font-bold ${selected === s.id ? 'text-cyan-300' : 'text-cyan-400/70'}`}>
                F{i + 1}
              </span>
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected fountain panel */}
      {selectedSite && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[440px] max-w-[92vw] bg-black/85 border border-cyan-400/50 backdrop-blur-md font-mono">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-400/30">
            <div className="flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-cyan-300 text-[10px] uppercase tracking-widest">Fountain Site · {selectedIdx + 1}/10</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-[10px]">✕</button>
          </div>
          <div className="p-3">
            <div className="text-sm font-semibold mb-1.5">{selectedSite.name}</div>
            <div className="text-[11px] text-white/70 leading-relaxed mb-2">{selectedSite.rationale}</div>
            <div className="flex items-center gap-1.5 text-[9px] text-white/40 uppercase tracking-widest">
              <MapPin className="w-2.5 h-2.5" />
              {selectedSite.lat.toFixed(4)}° N, {selectedSite.lon.toFixed(4)}° E
            </div>
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-1 right-2 z-10 text-[8px] text-white/40 font-mono">
        © OpenStreetMap · CARTO
      </div>
    </div>
  );
};

export default FountainsOfNukus;
