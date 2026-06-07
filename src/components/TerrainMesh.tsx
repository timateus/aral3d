import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { TerrainData, GeoBounds, getElevationColor } from '@/lib/geotiff-loader';
import { PopData, samplePopulation } from './PopulationDensityLayer';
import { LandcoverRasterData, sampleLandcover } from './LandcoverLayer';
import { useVisualMode, useDesignerScheme } from '@/lib/visual-mode';

interface TerrainMeshProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  hideNoData?: boolean;
  waterBounds?: GeoBounds | null;
  inspectorEnabled?: boolean;
  popData?: PopData | null;
  damToolActive?: boolean;
  onDamPlace?: (row: number, col: number) => void;
  canalToolActive?: boolean;
  onCanalDig?: (row: number, col: number) => void;
  waterFlowActive?: boolean;
  onWaterFlowClick?: (row: number, col: number) => void;
  terrainVersion?: number;
  raisedPixels?: Set<number>;
  dugPixels?: Set<number>;
  lcData?: LandcoverRasterData | null;
  sandboxActive?: boolean;
  onSandboxPaint?: (sx: number, sy: number) => void;
  onSandboxPaintEnd?: () => void;
}

const SIM_WIDTH = 200;
const SIM_HEIGHT = 200;

const TerrainMesh = ({ terrain, exaggeration, waterLevel, hideNoData = false, waterBounds, inspectorEnabled = false, popData, lcData, damToolActive = false, onDamPlace, canalToolActive = false, onCanalDig, waterFlowActive = false, onWaterFlowClick, terrainVersion = 0, raisedPixels, dugPixels, sandboxActive = false, onSandboxPaint, onSandboxPaintEnd }: TerrainMeshProps) => {
  const isPaintingSandbox = useRef(false);
  const [hoverInfo, setHoverInfo] = useState<{ position: THREE.Vector3; elevation: number; lat: number; lon: number; population: number | null; landcover: { classId: number; className: string; color: string } | null } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [visualMode] = useVisualMode();
  const [designerScheme] = useDesignerScheme();

  // Geometry only depends on terrain shape + exaggeration (NOT waterLevel)
  const { geometry, vertexMeta } = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const w = width;
    const h = height;

    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    const vertexPositions: number[] = [];
    const vertexUvs: number[] = [];
    const isNoData: boolean[] = [];
    const normalizedElevs: number[] = [];
    const rawElevs: number[] = [];

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const srcIdx = j * width + i;
        let elev = elevations[srcIdx];

        const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
        isNoData.push(nd);

        if (nd) elev = minElevation;

        const normalized = (elev - minElevation) / elevRange;
        const x = (i / (w - 1) - 0.5) * 10;
        const y = (0.5 - j / (h - 1)) * 10 * (h / w);
        const z = normalized * maxHeight;

        vertexPositions.push(x, y, z);
        vertexUvs.push(i / (w - 1), 1 - j / (h - 1));
        normalizedElevs.push(normalized);
        rawElevs.push(elev);
      }
    }

    // Build index buffer
    const indices: number[] = [];
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        const b = j * w + i + 1;
        const c = (j + 1) * w + i;
        const d = (j + 1) * w + i + 1;

        if (!(hideNoData && (isNoData[a] || isNoData[b] || isNoData[c]))) {
          indices.push(a, b, c);
        }
        if (!(hideNoData && (isNoData[b] || isNoData[d] || isNoData[c]))) {
          indices.push(b, d, c);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(vertexUvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return {
      geometry: geo,
      vertexMeta: { isNoData, normalizedElevs, rawElevs, width: w, height: h },
    };
  }, [terrain, exaggeration, hideNoData, terrainVersion]);

  // Colors depend on waterLevel but NOT geometry shape — much cheaper to recompute
  useMemo(() => {
    const { normalizedElevs, rawElevs, width: w, height: h } = vertexMeta;
    const { minElevation, bounds } = terrain;
    const totalVerts = w * h;
    const colors = new Float32Array(totalVerts * 3);

    // Determine water-eligible region
    const wb = waterBounds ?? bounds;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        const elev = rawElevs[idx];
        const normalized = normalizedElevs[idx];

        // Check if this pixel is within the water bounds
        let inWaterRegion = true;
        if (wb && bounds) {
          const lon = bounds.minLon + (i / (w - 1)) * (bounds.maxLon - bounds.minLon);
          const lat = bounds.maxLat - (j / (h - 1)) * (bounds.maxLat - bounds.minLat);
          inWaterRegion = lon >= wb.minLon && lon <= wb.maxLon && lat >= wb.minLat && lat <= wb.maxLat;
        }

        const isWater = inWaterRegion && elev <= waterLevel;
        let color: [number, number, number];
        if (isWater) {
          const waterDepth = Math.max(0, Math.min(1, (waterLevel - elev) / (waterLevel - minElevation || 1)));
          if (visualMode === 'designer') {
            // Use the designer-scheme water color, darkening with depth.
            const w = designerScheme.water.replace('#', '');
            const wr = parseInt(w.slice(0, 2), 16) / 255;
            const wg = parseInt(w.slice(2, 4), 16) / 255;
            const wb2 = parseInt(w.slice(4, 6), 16) / 255;
            const k = 0.55 + (1 - waterDepth) * 0.45;
            color = [wr * k, wg * k, wb2 * k];
          } else if (visualMode === 'mirage') {
            // Pale slate-blue mirage water
            color = [
              0.55 + (1 - waterDepth) * 0.10,
              0.66 + (1 - waterDepth) * 0.06,
              0.74 + (1 - waterDepth) * 0.04,
            ];
          } else {
            color = [
              0.04 + (1 - waterDepth) * 0.12,
              0.12 + (1 - waterDepth) * 0.2,
              0.35 + (1 - waterDepth) * 0.25,
            ];
          }
        } else if (raisedPixels && raisedPixels.has(idx)) {
          // Pink for raised terrain pixels
          const base = getElevationColor(normalized, elev);
          color = [
            Math.min(1, base[0] * 0.3 + 0.91 * 0.7),
            Math.min(1, base[1] * 0.3 + 0.26 * 0.7),
            Math.min(1, base[2] * 0.3 + 0.58 * 0.7),
          ];
        } else if (dugPixels && dugPixels.has(idx)) {
          // Cyan for dug canal pixels
          const base = getElevationColor(normalized, elev);
          color = [
            Math.min(1, base[0] * 0.3 + 0.0 * 0.7),
            Math.min(1, base[1] * 0.3 + 0.71 * 0.7),
            Math.min(1, base[2] * 0.3 + 0.85 * 0.7),
          ];
        } else {
          color = getElevationColor(normalized, elev);
        }
        colors[idx * 3] = color[0];
        colors[idx * 3 + 1] = color[1];
        colors[idx * 3 + 2] = color[2];
      }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [geometry, vertexMeta, waterLevel, waterBounds, terrain, terrainVersion, raisedPixels, dugPixels, visualMode, designerScheme]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }, []);

  const uvToSimCoords = useCallback((uv: { x: number; y: number }) => {
    const sx = Math.floor(uv.x * SIM_WIDTH);
    const sy = Math.floor((1 - uv.y) * SIM_HEIGHT);
    return { sx, sy };
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!sandboxActive || !onSandboxPaint) return;
    // Only respond to left-click (button 0)
    if (e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    isPaintingSandbox.current = true;
    const { uv } = e;
    if (!uv) return;
    const { sx, sy } = uvToSimCoords(uv);
    onSandboxPaint(sx, sy);
  }, [sandboxActive, onSandboxPaint, uvToSimCoords]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Sandbox drag-painting
    if (sandboxActive && isPaintingSandbox.current && onSandboxPaint) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      const { uv } = e;
      if (!uv) return;
      const { sx, sy } = uvToSimCoords(uv);
      onSandboxPaint(sx, sy);
      return;
    }

    const { uv, point } = e;
    if (!uv) return;

    const { width, height, elevations, minElevation, noDataValue } = terrain;
    const pixelX = Math.floor(uv.x * (width - 1));
    const pixelY = Math.floor((1 - uv.y) * (height - 1));
    const idx = pixelY * width + pixelX;
    let elev = elevations[idx];

    if ((noDataValue !== null && elev === noDataValue) || isNaN(elev)) {
      elev = minElevation;
    }

    // Compute lat/lon from UV
    const { bounds } = terrain;
    const lon = bounds.minLon + uv.x * (bounds.maxLon - bounds.minLon);
    const lat = bounds.maxLat - (1 - uv.y) * (bounds.maxLat - bounds.minLat);

    const population = samplePopulation(popData ?? null, lon, lat);
    const landcover = sampleLandcover(lcData ?? null, lon, lat);
    setHoverInfo({ position: point.clone(), elevation: Math.round(elev), lat, lon, population, landcover });
  }, [terrain, popData, lcData, sandboxActive, onSandboxPaint, uvToSimCoords]);

  const handlePointerUp = useCallback(() => {
    if (isPaintingSandbox.current) {
      isPaintingSandbox.current = false;
      onSandboxPaintEnd?.();
    }
  }, [onSandboxPaintEnd]);

  const handlePointerLeave = useCallback(() => {
    setHoverInfo(null);
    if (isPaintingSandbox.current) {
      isPaintingSandbox.current = false;
      onSandboxPaintEnd?.();
    }
  }, [onSandboxPaintEnd]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (sandboxActive) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
    }
    const { uv } = e;
    if (!uv) return;
    const { bounds: b, width, height } = terrain;

    // Sandbox: use click to paint (same pattern as dam/canal tools)
    if (sandboxActive && onSandboxPaint) {
      const { sx, sy } = uvToSimCoords(uv);
      onSandboxPaint(sx, sy);
      return;
    }

    if (waterFlowActive && onWaterFlowClick) {
      const pixelX = Math.floor(uv.x * (width - 1));
      const pixelY = Math.floor((1 - uv.y) * (height - 1));
      onWaterFlowClick(pixelY, pixelX);
      return;
    }

    if (damToolActive && onDamPlace) {
      const pixelX = Math.floor(uv.x * (width - 1));
      const pixelY = Math.floor((1 - uv.y) * (height - 1));
      onDamPlace(pixelY, pixelX);
      return;
    }

    if (canalToolActive && onCanalDig) {
      const pixelX = Math.floor(uv.x * (width - 1));
      const pixelY = Math.floor((1 - uv.y) * (height - 1));
      onCanalDig(pixelY, pixelX);
      return;
    }
  }, [sandboxActive, onSandboxPaint, uvToSimCoords, damToolActive, onDamPlace, canalToolActive, onCanalDig, waterFlowActive, onWaterFlowClick, terrain]);

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        userData={{ terrainSurface: true }}
      />
      {inspectorEnabled && hoverInfo && (
        <Html
          position={[hoverInfo.position.x, hoverInfo.position.y + 0.15, hoverInfo.position.z]}
          center
          style={{ pointerEvents: 'none', zIndex: 9999 }}
        >
          <div style={{
            color: '#fff',
            background: 'rgba(0,0,0,0.85)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}>
            <div style={{ fontWeight: 600 }}>{hoverInfo.elevation} m</div>
            <div style={{ opacity: 0.8 }}>{hoverInfo.lat.toFixed(4)}°N, {hoverInfo.lon.toFixed(4)}°E</div>
            {hoverInfo.population !== null && (
              <div style={{ color: '#a8e06c', fontWeight: 500 }}>Pop: {hoverInfo.population.toFixed(1)} /km²</div>
            )}
            {hoverInfo.landcover && (
              <div style={{ color: hoverInfo.landcover.color, fontWeight: 500 }}>
                LC: {hoverInfo.landcover.className}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default TerrainMesh;
