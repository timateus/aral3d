import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate, Link, useLocation } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2, Layers, Waves, Crosshair, Mountain, ArrowRight, Copy, Check, Sliders, Eye, X } from 'lucide-react';
import { findLocation, LOCATIONS } from '@/lib/locations';
import { useMapterhornTerrain } from '@/hooks/useMapterhornTerrain';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import MapboxTerrainMesh from '@/components/MapboxTerrainMesh';
import TerrainStyleOverlay, { type TerrainStyle } from '@/components/TerrainStyleOverlay';
import OsmWaterwaysLayer from '@/components/location/OsmWaterwaysLayer';
import OsmPopulationLayer from '@/components/location/OsmPopulationLayer';
import OvertureBuildingsLayer from '@/components/location/OvertureBuildingsLayer';
import OsmBuildingsLayer from '@/components/location/OsmBuildingsLayer';
import WaterFlowOverlay from '@/components/WaterFlowOverlay';
import { createFlowState, addWaterAt, stepFlow, type WaterFlowState } from '@/lib/water-flow-simulation';
import { useUserLocation } from '@/hooks/useUserLocation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function LocationsIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-semibold mb-4">Locations</h1>
      <ul className="space-y-2">
        {LOCATIONS.map((l) => (
          <li key={l.slug}>
            <Link to={`/${l.slug}`} className="text-primary hover:underline inline-flex items-center gap-2">
              {l.label} <ArrowRight className="w-3 h-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HoverCoord { lat: number; lon: number; elev: number }
interface CameraInfo {
  pos: [number, number, number];
  target: [number, number, number];
  distance: number;
  headingDeg: number;
  tiltDeg: number;
  fov: number;
}

function uvToCoord(
  uv: THREE.Vector2,
  terrain: import('@/lib/geotiff-loader').TerrainData,
  bounds: import('@/lib/geotiff-loader').GeoBounds,
): HoverCoord {
  const nx = uv.x, ny = uv.y;
  const lon = bounds.minLon + nx * (bounds.maxLon - bounds.minLon);
  const lat = bounds.minLat + ny * (bounds.maxLat - bounds.minLat);
  const col = Math.max(0, Math.min(terrain.width - 1, Math.floor(nx * (terrain.width - 1))));
  const row = Math.max(0, Math.min(terrain.height - 1, Math.floor((1 - ny) * (terrain.height - 1))));
  const elev = terrain.elevations[row * terrain.width + col] ?? terrain.minElevation;
  return { lat, lon, elev };
}

function CameraProbe({ orbitRef, onChange }: { orbitRef: React.MutableRefObject<any>; onChange: (c: CameraInfo) => void }) {
  const { camera } = useThree();
  useFrame(() => {
    const ctrl = orbitRef.current;
    const target = ctrl ? ctrl.target : new THREE.Vector3();
    const dx = camera.position.x - target.x;
    const dy = camera.position.y - target.y;
    const dz = camera.position.z - target.z;
    const distance = Math.hypot(dx, dy, dz);
    // Heading: compass 0=N, 90=E. In our scene +Z is toward viewer(south), -Z is north.
    const headingDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const tiltDeg = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    onChange({
      pos: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      distance,
      headingDeg: (headingDeg + 360) % 360,
      tiltDeg,
      fov,
    });
  });
  return null;
}

function UserPin({
  terrain, bounds, exaggeration, location,
}: {
  terrain: import('@/lib/geotiff-loader').TerrainData;
  bounds: import('@/lib/geotiff-loader').GeoBounds;
  exaggeration: number;
  location: { lat: number; lon: number };
}) {
  const pos = useMemo(() => {
    const nx = (location.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
    const ny = (location.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    const meshW = 10;
    const meshH = 10 * (terrain.height / terrain.width);
    const x = (nx - 0.5) * meshW;
    const z = -((ny - 0.5) * meshH);
    const px = Math.floor(nx * (terrain.width - 1));
    const py = Math.floor((1 - ny) * (terrain.height - 1));
    const elev = terrain.elevations[py * terrain.width + px] ?? terrain.minElevation;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const y = ((elev - terrain.minElevation) / elevRange) * maxH;
    return [x, y, z] as [number, number, number];
  }, [terrain, bounds, exaggeration, location.lat, location.lon]);
  if (!pos) return null;
  return (
    <group position={pos}>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.12, 0.5, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="font-mono w-10 text-right">{format ? format(value) : value}</span>
    </div>
  );
}

export default function LocationPage() {
  const params = useParams<{ slug?: string }>();
  const routerLoc = useLocation();
  const slug = params.slug ?? routerLoc.pathname.replace(/^\//, '').split('/')[0];
  const location = slug ? findLocation(slug) : undefined;
  const { token } = useTerrainMode();
  const { terrain, loading, error } = useMapterhornTerrain(location?.bounds ?? null, !!location);

  const [exaggeration, setExaggeration] = useState(location?.exaggeration ?? 30);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showOsmBuildings, setShowOsmBuildings] = useState(true);
  const [showOvertureBuildings, setShowOvertureBuildings] = useState(false);

  // View mode & per-mode parameters
  const [terrainStyle, setTerrainStyle] = useState<TerrainStyle>('none');
  const [contourInterval, setContourInterval] = useState(25);
  const [vectorInterval, setVectorInterval] = useState(80);
  const [meshInterval, setMeshInterval] = useState(60);

  // Basemap image adjustments
  const [brightness, setBrightness] = useState(1.75);
  const [contrast, setContrast] = useState(0.8);
  const [saturation, setSaturation] = useState(0.6);
  const [gamma, setGamma] = useState(0.9);

  const [waterFlowActive, setWaterFlowActive] = useState(false);
  const [flowState, setFlowState] = useState<WaterFlowState | null>(null);
  const [flowKey, setFlowKey] = useState(0);
  const [hover, setHover] = useState<HoverCoord | null>(null);
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const flowLoopRef = useRef<number | null>(null);
  const orbitRef = useRef<any>(null);

  const { location: userLoc, loading: locating, requestLocation } = useUserLocation();

  useEffect(() => {
    if (!terrain) return;
    setFlowState(createFlowState(terrain));
    setFlowKey((k) => k + 1);
  }, [terrain]);

  useEffect(() => {
    if (!waterFlowActive || !flowState) return;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      if (now - last > 60) { stepFlow(flowState); setFlowKey((k) => k + 1); last = now; }
      flowLoopRef.current = requestAnimationFrame(loop);
    };
    flowLoopRef.current = requestAnimationFrame(loop);
    return () => { if (flowLoopRef.current) cancelAnimationFrame(flowLoopRef.current); };
  }, [waterFlowActive, flowState]);

  const copyText = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); } catch { /* ignore */ }
    setCopied(txt);
    setTimeout(() => setCopied(null), 1600);
  };
  const copyCoords = (c: HoverCoord) => copyText(`${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`);

  if (!slug) return <Navigate to="/" replace />;
  if (!location) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Location not found</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Add it to <code>src/lib/locations.ts</code> to make it available.
          </p>
          <Link to="/" className="text-primary hover:underline">Home</Link>
        </div>
      </div>
    );
  }

  const btnBase =
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border/60 bg-background/80 backdrop-blur hover:bg-accent transition-colors';

  const dataBase = `/data/locations/${location.slug}`;

  return (
    <div className="fixed inset-0 bg-background text-foreground">
      <Canvas camera={{ position: [0, 8, 10], fov: 45, near: 0.1, far: 200 }} shadows={false}>
        <color attach="background" args={['#f3f0e7']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 20, 10]} intensity={1.1} />
        <hemisphereLight args={['#ffffff', '#c9b98a', 0.5]} />

        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={1.5}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.05}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
        <CameraProbe orbitRef={orbitRef} onChange={setCamera} />

        {terrain && (
          <>
            <group
              onPointerMove={(e) => {
                if (!e.uv) return;
                setHover(uvToCoord(e.uv, terrain, location.bounds));
              }}
              onPointerOut={() => setHover(null)}
              onClick={(e) => {
                if (!e.uv) return;
                e.stopPropagation();
                const c = uvToCoord(e.uv, terrain, location.bounds);
                if (waterFlowActive && flowState) {
                  const col = Math.floor((e.uv.x) * (terrain.width - 1));
                  const row = Math.floor((1 - e.uv.y) * (terrain.height - 1));
                  addWaterAt(flowState, row, col, 8, 4);
                  setFlowKey((k) => k + 1);
                  return;
                }
                copyCoords(c);
              }}
            >
              {showTerrain && (
                <MapboxTerrainMesh
                  terrain={terrain}
                  exaggeration={exaggeration}
                  token={token}
                  baseStyleOverride="satlas"
                  brightness={brightness}
                  contrast={contrast}
                  saturation={saturation}
                  gamma={gamma}
                />
              )}
            </group>
            <TerrainStyleOverlay
              terrain={terrain}
              exaggeration={exaggeration}
              style={terrainStyle}
              contourInterval={contourInterval}
              vectorInterval={vectorInterval}
              meshInterval={meshInterval}
              bounds={location.bounds}
            />
            {showWater && (
              <OsmWaterwaysLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} dataUrl={`${dataBase}/water.json`} />
            )}
            {showOsmBuildings && (
              <OsmBuildingsLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} dataUrl={`${dataBase}/buildings.json`} />
            )}
            {showOvertureBuildings && (
              <OvertureBuildingsLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} />
            )}
            {showPopulation && (
              <OsmPopulationLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} dataUrl={`${dataBase}/population.json`} />
            )}
            {flowState && (
              <WaterFlowOverlay
                terrain={terrain}
                exaggeration={exaggeration}
                flowState={flowState}
                renderKey={flowKey}
              />
            )}
            {userLoc && (
              <UserPin
                terrain={terrain}
                bounds={location.bounds}
                exaggeration={exaggeration}
                location={userLoc}
              />
            )}
          </>
        )}
      </Canvas>

      {/* Header */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-md bg-background/80 backdrop-blur border border-border/60 pointer-events-auto">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Location
          </div>
          <div className="text-sm font-semibold">{location.label}</div>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-border/60 text-xs text-muted-foreground pointer-events-auto">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading terrain…
          </div>
        )}
        {error && (
          <div className="px-2 py-1 rounded-md bg-destructive/10 border border-destructive/40 text-destructive text-xs pointer-events-auto">
            {error}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {/* Layers */}
        <DropdownMenu>
          <DropdownMenuTrigger className={btnBase}>
            <Layers className="w-3.5 h-3.5" /> Layers
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Overlays</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showWater} onCheckedChange={(v) => setShowWater(!!v)}>
              OSM water
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showOsmBuildings} onCheckedChange={(v) => setShowOsmBuildings(!!v)}>
              OSM buildings
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showOvertureBuildings} onCheckedChange={(v) => setShowOvertureBuildings(!!v)}>
              Overture buildings
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showPopulation} onCheckedChange={(v) => setShowPopulation(!!v)}>
              Population density
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode */}
        <Popover>
          <PopoverTrigger className={`${btnBase} ${terrainStyle !== 'none' ? 'text-primary border-primary/50' : ''}`}>
            <Eye className="w-3.5 h-3.5" /> View
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Terrain</div>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTerrain}
                  onChange={(e) => setShowTerrain(e.target.checked)}
                />
                Show
              </label>
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Overlay</div>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {(['none','contours','mesh','vectors'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTerrainStyle(m)}
                  className={`px-2 py-1 rounded border ${terrainStyle === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-accent'}`}
                >
                  {m === 'none' ? 'Off' : m === 'contours' ? 'Contour' : m === 'mesh' ? 'Mesh' : 'Vectors'}
                </button>
              ))}
            </div>
            {terrainStyle === 'contours' && (
              <Slider label="Interval" value={contourInterval} min={5} max={200} step={5}
                onChange={setContourInterval} format={(v) => `${v}m`} />
            )}
            {terrainStyle === 'vectors' && (
              <Slider label="Spacing" value={vectorInterval} min={10} max={400} step={5}
                onChange={setVectorInterval} format={(v) => `${v}m`} />
            )}
            {terrainStyle === 'mesh' && (
              <Slider label="Spacing" value={meshInterval} min={5} max={400} step={5}
                onChange={setMeshInterval} format={(v) => `${v}m`} />
            )}
          </PopoverContent>
        </Popover>

        {/* Image adjust */}
        <Popover>
          <PopoverTrigger className={btnBase}>
            <Sliders className="w-3.5 h-3.5" /> Image
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Basemap</div>
            <Slider label="Brightness" value={brightness} min={0.5} max={3} step={0.05}
              onChange={setBrightness} format={(v) => v.toFixed(2)} />
            <Slider label="Contrast" value={contrast} min={0.5} max={2.5} step={0.05}
              onChange={setContrast} format={(v) => v.toFixed(2)} />
            <Slider label="Saturation" value={saturation} min={0} max={2.5} step={0.05}
              onChange={setSaturation} format={(v) => v.toFixed(2)} />
            <Slider label="Gamma" value={gamma} min={0.4} max={2.5} step={0.05}
              onChange={setGamma} format={(v) => v.toFixed(2)} />
            <button
              onClick={() => { setBrightness(1.75); setContrast(0.8); setSaturation(0.6); setGamma(0.9); }}
              className="w-full mt-1 text-[11px] px-2 py-1 rounded border border-border/60 hover:bg-accent"
            >
              Reset
            </button>
          </PopoverContent>
        </Popover>

        <button
          className={`${btnBase} ${waterFlowActive ? 'text-primary border-primary/50' : ''}`}
          onClick={() => setWaterFlowActive((a) => !a)}
          title="Click on terrain to pour water"
        >
          <Waves className="w-3.5 h-3.5" />
          {waterFlowActive ? 'Pouring…' : 'Water flow'}
        </button>

        <button
          className={btnBase}
          onClick={requestLocation}
          disabled={locating}
          title="Show my location"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          Locate me
        </button>
      </div>

      {/* Inspector */}
      <div className="absolute bottom-3 right-3 px-3 py-2 rounded-md bg-background/80 backdrop-blur border border-border/60 text-xs font-mono min-w-[240px]">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Inspector</span>
          {copied ? (
            <span className="flex items-center gap-1 text-primary">
              <Check className="w-3 h-3" /> copied
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Copy className="w-3 h-3" /> click to copy
            </span>
          )}
        </div>

        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Cursor</div>
        {hover ? (
          <button
            className="block w-full text-left hover:text-primary leading-tight"
            onClick={() => copyCoords(hover)}
            title="Copy lat, lon"
          >
            <div>lat {hover.lat.toFixed(6)}</div>
            <div>lon {hover.lon.toFixed(6)}</div>
            <div className="text-muted-foreground">elev {hover.elev.toFixed(1)} m</div>
          </button>
        ) : (
          <div className="text-muted-foreground">hover terrain…</div>
        )}

        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Camera</div>
        {camera ? (
          <button
            className="block w-full text-left hover:text-primary leading-tight"
            onClick={() => copyText(
              `pos ${camera.pos.map((n) => n.toFixed(3)).join(', ')}\n` +
              `target ${camera.target.map((n) => n.toFixed(3)).join(', ')}\n` +
              `distance ${camera.distance.toFixed(3)}\n` +
              `heading ${camera.headingDeg.toFixed(1)}°\n` +
              `tilt ${camera.tiltDeg.toFixed(1)}°\n` +
              `fov ${camera.fov.toFixed(1)}°`
            )}
            title="Copy camera state"
          >
            <div>dist {camera.distance.toFixed(2)}</div>
            <div>hdg {camera.headingDeg.toFixed(1)}° · tilt {camera.tiltDeg.toFixed(1)}°</div>
            <div className="text-muted-foreground">fov {camera.fov.toFixed(0)}°</div>
            <div className="text-muted-foreground">
              pos {camera.pos.map((n) => n.toFixed(1)).join(',')}
            </div>
          </button>
        ) : (
          <div className="text-muted-foreground">—</div>
        )}
      </div>

      {/* Bottom vertical exag control */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-2 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center gap-3 text-xs">
        <span className="text-muted-foreground font-mono">Vertical exag</span>
        <input
          type="range" min={0} max={100} step={1}
          value={exaggeration}
          onChange={(e) => setExaggeration(parseInt(e.target.value, 10))}
          className="w-52"
        />
        <span className="font-mono w-8 text-right">{exaggeration}x</span>
        {waterFlowActive && (
          <span className="ml-3 text-primary font-mono">click terrain to add water</span>
        )}
      </div>

      {/* Attribution */}
      <div className="absolute bottom-1 left-2 text-[10px] font-mono text-muted-foreground/70 pointer-events-none">
        Elevation: Mapterhorn · Imagery: Satlas Super-Res 2023 (Allen Institute for AI) · Buildings: OSM / Overture Maps Foundation · Data © OpenStreetMap contributors
      </div>
    </div>
  );
}
