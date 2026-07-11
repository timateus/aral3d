import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate, Link, useLocation } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2, Layers, Waves, Crosshair, Mountain, ArrowRight, Copy, Check } from 'lucide-react';
import { findLocation, LOCATIONS } from '@/lib/locations';
import { useMapterhornTerrain } from '@/hooks/useMapterhornTerrain';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import MapboxTerrainMesh from '@/components/MapboxTerrainMesh';
import TerrainStyleOverlay, { type TerrainStyle } from '@/components/TerrainStyleOverlay';
import OsmWaterwaysLayer from '@/components/location/OsmWaterwaysLayer';
import OsmPopulationLayer from '@/components/location/OsmPopulationLayer';
import OvertureBuildingsLayer from '@/components/location/OvertureBuildingsLayer';
import WaterFlowOverlay from '@/components/WaterFlowOverlay';
import { createFlowState, addWaterAt, stepFlow, type WaterFlowState } from '@/lib/water-flow-simulation';
import { useUserLocation } from '@/hooks/useUserLocation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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

/**
 * Extract lat/lon/elev from a pointer event whose intersection carries UVs
 * matching the terrain mesh's parameterization (i/(w-1), 1 - j/(h-1)).
 */
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

export default function LocationPage() {
  const params = useParams<{ slug?: string }>();
  const routerLoc = useLocation();
  const slug = params.slug ?? routerLoc.pathname.replace(/^\//, '').split('/')[0];
  const location = slug ? findLocation(slug) : undefined;
  const { token } = useTerrainMode();
  const { terrain, loading, error } = useMapterhornTerrain(location?.bounds ?? null, !!location);

  const [exaggeration, setExaggeration] = useState(location?.exaggeration ?? 4);
  const [showWater, setShowWater] = useState(true);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);
  const [terrainStyle, setTerrainStyle] = useState<TerrainStyle>('none');
  const [waterFlowActive, setWaterFlowActive] = useState(false);
  const [flowState, setFlowState] = useState<WaterFlowState | null>(null);
  const [flowKey, setFlowKey] = useState(0);
  const [hover, setHover] = useState<HoverCoord | null>(null);
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

  const copyCoords = async (c: HoverCoord) => {
    const txt = `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
    try { await navigator.clipboard.writeText(txt); } catch { /* ignore */ }
    setCopied(txt);
    setTimeout(() => setCopied(null), 1600);
  };

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

  return (
    <div className="fixed inset-0 bg-background text-foreground">
      <Canvas camera={{ position: [0, 8, 10], fov: 45, near: 0.1, far: 200 }} shadows={false}>
        <color attach="background" args={['#0d1117']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.0} />
        <hemisphereLight args={['#a3b8d6', '#3b2b1c', 0.3]} />

        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={1.5}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.05}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />

        {terrain && (
          <>
            <MapboxTerrainMesh terrain={terrain} exaggeration={exaggeration} token={token} />
            <TerrainStyleOverlay
              terrain={terrain}
              exaggeration={exaggeration}
              style={terrainStyle}
              contourInterval={25}
              vectorInterval={80}
            />
            {showWater && (
              <OsmWaterwaysLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} />
            )}
            {showBuildings && (
              <OvertureBuildingsLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} />
            )}
            {showPopulation && (
              <OsmPopulationLayer terrain={terrain} exaggeration={exaggeration} bounds={location.bounds} />
            )}
            {flowState && (
              <WaterFlowOverlay
                terrain={terrain}
                exaggeration={exaggeration}
                flowState={flowState}
                renderKey={flowKey}
              />
            )}
            <InspectorPlane
              terrain={terrain}
              bounds={location.bounds}
              onHover={setHover}
              onClick={copyCoords}
              waterMode={waterFlowActive && !!flowState}
              onWaterPixel={(row, col) => {
                if (!flowState) return;
                addWaterAt(flowState, row, col, 8, 4);
                setFlowKey((k) => k + 1);
              }}
            />
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
        <DropdownMenu>
          <DropdownMenuTrigger className={btnBase}>
            <Layers className="w-3.5 h-3.5" /> Layers
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Overlays</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showWater} onCheckedChange={(v) => setShowWater(!!v)}>
              OSM water
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showBuildings} onCheckedChange={(v) => setShowBuildings(!!v)}>
              OSM buildings
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showPopulation}
              onCheckedChange={(v) => setShowPopulation(!!v)}
            >
              Population density
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Terrain style</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={terrainStyle === 'contours'}
              onCheckedChange={(v) => setTerrainStyle(v ? 'contours' : 'none')}
            >
              Contours
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={terrainStyle === 'vectors'}
              onCheckedChange={(v) => setTerrainStyle(v ? 'vectors' : 'none')}
            >
              Slope vectors
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className={`${btnBase} ${terrainStyle === 'contours' ? 'text-primary border-primary/50' : ''}`}
          onClick={() => setTerrainStyle((s) => (s === 'contours' ? 'none' : 'contours'))}
          title="Toggle contour lines"
        >
          <Mountain className="w-3.5 h-3.5" /> Contours
        </button>

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

      {/* Coordinate inspector */}
      <div className="absolute bottom-3 right-3 px-3 py-2 rounded-md bg-background/80 backdrop-blur border border-border/60 text-xs font-mono min-w-[220px]">
        <div className="flex items-center justify-between gap-3">
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
        {hover ? (
          <div className="mt-1 leading-tight">
            <div>lat {hover.lat.toFixed(6)}</div>
            <div>lon {hover.lon.toFixed(6)}</div>
            <div className="text-muted-foreground">elev {hover.elev.toFixed(1)} m</div>
          </div>
        ) : (
          <div className="mt-1 text-muted-foreground">hover terrain…</div>
        )}
      </div>

      {/* Bottom vertical exag control */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-2 rounded-md bg-background/80 backdrop-blur border border-border/60 flex items-center gap-3 text-xs">
        <span className="text-muted-foreground font-mono">Vertical exag</span>
        <input
          type="range" min={1} max={20} step={1}
          value={exaggeration}
          onChange={(e) => setExaggeration(parseInt(e.target.value, 10))}
          className="w-40"
        />
        <span className="font-mono w-6 text-right">{exaggeration}x</span>
        {waterFlowActive && (
          <span className="ml-3 text-primary font-mono">click terrain to add water</span>
        )}
      </div>

      {/* Attribution */}
      <div className="absolute bottom-1 left-2 text-[10px] font-mono text-muted-foreground/70 pointer-events-none">
        Elevation: Mapterhorn · Imagery: Mapbox · Data © OpenStreetMap contributors
      </div>
    </div>
  );
}
