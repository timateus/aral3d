import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, Droplets, MapPin } from 'lucide-react';

// Nukus city — approximate geographic envelope used for the procedural basemap.
// Center: 42.4531° N, 59.6103° E
const NUKUS = { lat: 42.4531, lon: 59.6103 };
const LAT_SPAN = 0.10; // ~11 km N-S
const LON_SPAN = 0.14; // ~11 km E-W at this latitude

// Plane size in 3D world-units (square-ish, slightly wider east-west)
const PLANE_W = 12;
const PLANE_H = 12 * (LAT_SPAN / LON_SPAN); // keep aspect

type LatLon = { lat: number; lon: number };

const project = ({ lat, lon }: LatLon): [number, number] => {
  // returns (x, z) in plane coordinates centered at NUKUS, z increases southward
  const x = ((lon - NUKUS.lon) / LON_SPAN) * PLANE_W;
  const z = -((lat - NUKUS.lat) / LAT_SPAN) * PLANE_H;
  return [x, z];
};

interface POI {
  id: string;
  name: string;
  kind: 'bazaar' | 'airport' | 'museum' | 'university' | 'park' | 'station' | 'gov' | 'stadium';
  lat: number;
  lon: number;
  blurb: string;
}

const POIS: POI[] = [
  { id: 'savitsky',  name: 'Savitsky Museum',     kind: 'museum',     lat: 42.4628, lon: 59.6086, blurb: '"Louvre of the Steppe" — 80,000+ avant-garde works.' },
  { id: 'jipek',     name: 'Jipek Joli Bazaar',   kind: 'bazaar',     lat: 42.4570, lon: 59.6210, blurb: 'Central market — melons, dried fish, spices.' },
  { id: 'airport',   name: 'Nukus Int’l Airport', kind: 'airport',    lat: 42.4884, lon: 59.6233, blurb: 'NCU — gateway to Karakalpakstan.' },
  { id: 'berdakh',   name: 'Berdakh University',  kind: 'university', lat: 42.4660, lon: 59.6020, blurb: 'Karakalpak State University.' },
  { id: 'park',      name: 'Central Park',        kind: 'park',       lat: 42.4555, lon: 59.6080, blurb: 'Shade, benches, and pigeons.' },
  { id: 'station',   name: 'Railway Station',     kind: 'station',    lat: 42.4380, lon: 59.5800, blurb: 'Trains to Tashkent and Beyneu.' },
  { id: 'amir',      name: 'Amir Timur Square',   kind: 'gov',        lat: 42.4612, lon: 59.6128, blurb: 'Civic heart of the city.' },
  { id: 'stadium',   name: 'Nukus Stadium',       kind: 'stadium',    lat: 42.4500, lon: 59.6260, blurb: 'Home of FK Aral.' },
  { id: 'mosque',    name: 'Central Mosque',      kind: 'gov',        lat: 42.4598, lon: 59.6155, blurb: 'Friday prayers and ceramic tilework.' },
  { id: 'hospital',  name: 'Regional Hospital',   kind: 'gov',        lat: 42.4500, lon: 59.5970, blurb: 'Largest medical facility in Karakalpakstan.' },
];

// 10 candidate fountain locations — spread across busy / hot / public areas
const FOUNTAIN_SITES: { id: string; name: string; rationale: string; lat: number; lon: number }[] = [
  { id: 'f1',  name: 'Bazaar Plaza',       rationale: 'Highest foot-traffic; shoppers + sellers all day.',            lat: 42.4575, lon: 59.6203 },
  { id: 'f2',  name: 'Amir Timur Sq.',     rationale: 'Civic landmark — visible, central, ceremonial.',               lat: 42.4615, lon: 59.6132 },
  { id: 'f3',  name: 'Museum Forecourt',   rationale: 'Welcomes tourists arriving at the Savitsky.',                  lat: 42.4624, lon: 59.6092 },
  { id: 'f4',  name: 'University Quad',    rationale: 'Students — refill bottles between classes.',                   lat: 42.4655, lon: 59.6035 },
  { id: 'f5',  name: 'Park Entrance',      rationale: 'Cool relief for families using the park.',                     lat: 42.4549, lon: 59.6088 },
  { id: 'f6',  name: 'Airport Terminal',   rationale: 'First taste of Nukus for arriving passengers.',                lat: 42.4878, lon: 59.6242 },
  { id: 'f7',  name: 'Stadium Gates',      rationale: 'Match-day crowds need hydration.',                             lat: 42.4505, lon: 59.6248 },
  { id: 'f8',  name: 'Rail Forecourt',     rationale: 'Travellers between long-distance trains.',                     lat: 42.4392, lon: 59.5818 },
  { id: 'f9',  name: 'Hospital Plaza',     rationale: 'Patients and families waiting outside.',                       lat: 42.4506, lon: 59.5982 },
  { id: 'f10', name: 'Riverside Promenade',rationale: 'Future Amu Darya-fed cooling oasis.',                          lat: 42.4470, lon: 59.6390 },
];

// Build the basemap as a CanvasTexture (procedural minimalist street grid + river).
function useBasemapTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const W = 1024, H = Math.round(1024 * (PLANE_H / PLANE_W));
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Paper-ish background
    ctx.fillStyle = '#e9e3d4';
    ctx.fillRect(0, 0, W, H);

    // Subtle outer city tint (lighter near center)
    const grd = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.05, W * 0.5, H * 0.5, W * 0.55);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Amu Darya — flows roughly N→S on the east side
    ctx.strokeStyle = '#9cc6d6';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.86, 0);
    ctx.bezierCurveTo(W * 0.78, H * 0.35, W * 0.92, H * 0.55, W * 0.80, H);
    ctx.stroke();
    ctx.strokeStyle = '#bcd9e3';
    ctx.lineWidth = 38; ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Small canal branch toward the city
    ctx.strokeStyle = '#a7cdd9';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W * 0.80, H * 0.40);
    ctx.bezierCurveTo(W * 0.65, H * 0.45, W * 0.55, H * 0.50, W * 0.40, H * 0.55);
    ctx.stroke();

    // Street grid — minimalist
    ctx.strokeStyle = '#c9c0a8';
    ctx.lineWidth = 1.4;
    const step = 48;
    for (let x = (W * 0.18) % step; x < W * 0.82; x += step) {
      ctx.beginPath(); ctx.moveTo(x, H * 0.08); ctx.lineTo(x, H * 0.92); ctx.stroke();
    }
    for (let y = (H * 0.18) % step; y < H * 0.92; y += step) {
      ctx.beginPath(); ctx.moveTo(W * 0.10, y); ctx.lineTo(W * 0.78, y); ctx.stroke();
    }

    // A few major avenues
    ctx.strokeStyle = '#9b9176';
    ctx.lineWidth = 3;
    [0.32, 0.5, 0.66].forEach(f => {
      ctx.beginPath(); ctx.moveTo(W * 0.08, H * f); ctx.lineTo(W * 0.82, H * f); ctx.stroke();
    });
    [0.30, 0.5, 0.68].forEach(f => {
      ctx.beginPath(); ctx.moveTo(W * f, H * 0.06); ctx.lineTo(W * f, H * 0.94); ctx.stroke();
    });

    // Diagonal road to airport (NE)
    ctx.strokeStyle = '#9b9176';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W * 0.5, H * 0.5);
    ctx.lineTo(W * 0.78, H * 0.08);
    ctx.stroke();

    // Park (green patch near center)
    ctx.fillStyle = '#c5d6b0';
    ctx.beginPath(); ctx.ellipse(W * 0.50, H * 0.54, 38, 28, 0, 0, Math.PI * 2); ctx.fill();

    // Airport runway hint (top right)
    ctx.strokeStyle = '#8a8270';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(W * 0.74, H * 0.10); ctx.lineTo(W * 0.86, H * 0.16); ctx.stroke();

    // Title and N arrow
    ctx.fillStyle = '#5b5240';
    ctx.font = '500 28px ui-monospace, monospace';
    ctx.fillText('NUKUS', 28, 44);
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Karakalpakstan · 42.45° N, 59.61° E', 28, 64);

    // North arrow
    ctx.strokeStyle = '#5b5240'; ctx.fillStyle = '#5b5240'; ctx.lineWidth = 2;
    const ax = W - 60, ay = 60;
    ctx.beginPath(); ctx.moveTo(ax, ay - 22); ctx.lineTo(ax - 8, ay + 10); ctx.lineTo(ax + 8, ay + 10); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('N', ax - 5, ay + 28);

    // Scale bar
    ctx.fillStyle = '#5b5240'; ctx.fillRect(28, H - 36, 120, 4);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('~ 2 km', 28, H - 14);

    // Border frame
    ctx.strokeStyle = '#5b5240'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

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
        <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
        <meshStandardMaterial color={KIND_COLOR[poi.kind]} emissive={KIND_COLOR[poi.kind]} emissiveIntensity={0.4} />
      </mesh>
      <Html distanceFactor={10} center position={[0, 0.25, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(15,17,21,0.78)', color: 'white', padding: '2px 6px',
          fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.05em',
          border: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap',
        }}>
          {poi.name}
        </div>
      </Html>
      {hovered && (
        <Html distanceFactor={8} position={[0, 0.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(15,17,21,0.92)', color: 'white', padding: '6px 10px',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.4,
            border: `1px solid ${KIND_COLOR[poi.kind]}`, maxWidth: 220,
          }}>
            <div style={{ color: KIND_COLOR[poi.kind], textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.15em', marginBottom: 4 }}>{poi.kind}</div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{poi.name}</div>
            <div style={{ opacity: 0.75 }}>{poi.blurb}</div>
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
  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.15;
      ringRef.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={[x, 0, z]}>
      {/* Droplet body — floats above the plane */}
      <mesh
        position={[0, 0.6, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial
          color={selected ? '#22d3ee' : '#38bdf8'}
          emissive={selected ? '#22d3ee' : '#0ea5e9'}
          emissiveIntensity={selected ? 1.2 : 0.7}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>
      {/* Pulsing ring on the ground */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.28, 0.34, 32]} />
        <meshBasicMaterial color={selected ? '#22d3ee' : '#38bdf8'} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Vertical post */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.55} />
      </mesh>
      <Html distanceFactor={9} center position={[0, 1.0, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: selected ? '#22d3ee' : 'rgba(8,47,73,0.9)',
          color: selected ? '#0c1116' : '#bae6fd',
          padding: '2px 6px', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700,
          border: '1px solid #22d3ee', whiteSpace: 'nowrap', letterSpacing: '0.1em',
        }}>
          F{index + 1} · {site.name.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

function MapPlane() {
  const tex = useBasemapTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE_W, PLANE_H]} />
      <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
    </mesh>
  );
}

interface Props {
  onClose: () => void;
}

const FountainsOfNukus = ({ onClose }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Water Fountains of Nukus';
    return () => { document.title = prev; };
  }, []);

  const selectedSite = FOUNTAIN_SITES.find(s => s.id === selected);

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-[#0b1220] via-[#0e1726] to-[#050810] text-white">
      {/* Top bar */}
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
            10 candidate sites · drag to rotate · scroll to zoom · click a droplet
          </div>
        </div>
        <div className="w-[80px]" />
      </div>

      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: [0, 10, 10], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0a1020']} />
        <fog attach="fog" args={['#0a1020', 25, 80]} />

        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.0} />
        <directionalLight position={[-8, 6, -4]} intensity={0.3} color="#88aaff" />

        <MapPlane />

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
          maxDistance={28}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>

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
          <Droplets className="w-3 h-3" /> Fountain site
        </div>
      </div>

      {/* Selected fountain panel */}
      {selectedSite && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[420px] max-w-[92vw] bg-black/80 border border-cyan-400/50 backdrop-blur-md font-mono">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-400/30">
            <div className="flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-cyan-300 text-[10px] uppercase tracking-widest">Fountain Site · {FOUNTAIN_SITES.findIndex(s => s.id === selectedSite.id) + 1}/10</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-white/40 hover:text-white text-[10px]"
            >✕</button>
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
    </div>
  );
};

export default FountainsOfNukus;
