import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { GeoBounds, TerrainData } from '@/lib/geotiff-loader';
import { getElevationColor } from '@/lib/geotiff-loader';
import { loadMapboxSatellite } from '@/lib/mapbox-tiles';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import {
  createLife, stepLife, seedRandom, seedPattern, seedQaraqalpaq, clearLife, toggleCell,
  onLifeEvent, emitLifeStats, LifeState, LifeColorMode, resizeLife, getLifeSettings,
  DEFAULT_LIFE_CELL_SIZE, LifeVariant, setLifeVariant,
} from '@/lib/life-simulation';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel?: number;
  waterBounds?: GeoBounds | null;
  active: boolean;
}

/**
 * Cellular automata rendered as colored cubes draped over the terrain.
 * The renderer supports flat Conway Life, stacked 3D Life, and Lenia.
 */
const gridWidthForCellSize = (cellSize: number) => Math.max(12, Math.min(160, Math.round(96 * (DEFAULT_LIFE_CELL_SIZE / cellSize))));
const clampLifeCellSize = (cellSize: number) => Math.max(0.04, Math.min(1, cellSize));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const enhanceTerrainColor = (r: number, g: number, b: number): [number, number, number] => {
  const avg = (r + g + b) / 3;
  const sat = 2.6;
  const contrast = 1.25;
  return [
    clamp01((avg + (r - avg) * sat) * contrast - 0.08),
    clamp01((avg + (g - avg) * sat) * contrast - 0.08),
    clamp01((avg + (b - avg) * sat) * contrast - 0.08),
  ];
};

const sampleRenderedSurfaceColor = (
  terrain: TerrainData,
  u: number,
  v: number,
  waterLevel?: number,
  waterBounds?: GeoBounds | null,
): { z: number; color: [number, number, number] } => {
  const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue, bounds } = terrain;
  const elevRange = maxElevation - minElevation || 1;
  const ti = Math.min(tw - 1, Math.max(0, Math.round(u * (tw - 1))));
  const tj = Math.min(th - 1, Math.max(0, Math.round(v * (th - 1))));
  let elev = elevations[tj * tw + ti];
  const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
  if (nd) elev = minElevation;
  const normalized = (elev - minElevation) / elevRange;

  const wb = waterBounds ?? bounds;
  let inWaterRegion = true;
  if (wb && bounds) {
    const lon = bounds.minLon + u * (bounds.maxLon - bounds.minLon);
    const lat = bounds.maxLat - v * (bounds.maxLat - bounds.minLat);
    inWaterRegion = lon >= wb.minLon && lon <= wb.maxLon && lat >= wb.minLat && lat <= wb.maxLat;
  }

  if (waterLevel !== undefined && inWaterRegion && elev <= waterLevel) {
    const waterDepth = clamp01((waterLevel - elev) / (waterLevel - minElevation || 1));
    return {
      z: normalized,
      color: [
        0.04 + (1 - waterDepth) * 0.12,
        0.12 + (1 - waterDepth) * 0.2,
        0.35 + (1 - waterDepth) * 0.25,
      ],
    };
  }

  return { z: normalized, color: getElevationColor(normalized, elev) };
};

const LifeOverlay = ({ terrain, exaggeration, waterLevel, waterBounds, active }: Props) => {
  const initialSettings = getLifeSettings();
  const stateRef = useRef<LifeState>(createLife(undefined, undefined, initialSettings.variant));
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const runningRef = useRef(true);
  const speedRef = useRef(8); // generations per second
  const accumRef = useRef(0);
  const cellSizeRef = useRef(initialSettings.cellSize);
  const colorModeRef = useRef<LifeColorMode>(initialSettings.colorMode);
  const variantRef = useRef<LifeVariant>(initialSettings.variant);
  const brightPaletteRef = useRef<Float32Array | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const meshAspect = terrain.height / terrain.width || 1;

  const emitStats = (s: LifeState) => emitLifeStats({
    generation: s.generation,
    population: s.population,
    running: runningRef.current,
    speed: speedRef.current,
    cellSize: cellSizeRef.current,
    colorMode: colorModeRef.current,
    variant: variantRef.current,
    gridWidth: s.width,
    gridHeight: s.height,
    gridDepth: s.depth,
  });

  const resizeGridForCellSize = (cellSize: number) => {
    const variant = variantRef.current;
    const baseW = gridWidthForCellSize(cellSize);
    const nextW = variant === 'life3d' ? Math.min(72, baseW) : baseW;
    const nextH = Math.max(12, Math.min(variant === 'life3d' ? 72 : 160, Math.round(nextW * meshAspect)));
    const s = stateRef.current;
    if (s.width === nextW && s.height === nextH && s.depth === (variant === 'life3d' ? 9 : 1)) return s;
    resizeLife(s, nextW, nextH);
    brightPaletteRef.current = null;
    setGridVersion(v => v + 1);
    return s;
  };

  const layout = useMemo(() => {
    const s = stateRef.current;
    const w = s.width, h = s.height, d = s.depth;
    const total = w * h * d;
    const positions = new Float32Array(total * 3);
    const surfaceColors = new Float32Array(total * 3);
    const maxHeight = 10 * (exaggeration / 100);
    const meshAspect = terrain.height / terrain.width || 1;
    const stackGap = cellSizeRef.current * 0.78;
    const stackMid = (d - 1) / 2;

    for (let z = 0; z < d; z++) {
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const u = (c + 0.5) / w;
          const v = (r + 0.5) / h;
          const surface = sampleRenderedSurfaceColor(terrain, u, v, waterLevel, waterBounds);
          const x = (u - 0.5) * 10;
          const y = (0.5 - v) * 10 * meshAspect;
          const terrainZ = surface.z * maxHeight;
          const i = (z * h + r) * w + c;
          const idx = i * 3;
          positions[idx] = x;
          positions[idx + 1] = y;
          positions[idx + 2] = terrainZ + (d > 1 ? (z - stackMid) * stackGap : 0);
          const [sr, sg, sb] = enhanceTerrainColor(...surface.color);
          surfaceColors[idx] = sr;
          surfaceColors[idx + 1] = sg;
          surfaceColors[idx + 2] = sb;
        }
      }
    }
    return { positions, surfaceColors };
  }, [terrain, exaggeration, waterLevel, waterBounds, gridVersion]);

  const getBrightPalette = (count: number) => {
    if (brightPaletteRef.current && brightPaletteRef.current.length === count * 3) return brightPaletteRef.current;
    const arr = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      tmp.setHSL(Math.random(), 0.95, 0.6);
      arr[i * 3] = tmp.r;
      arr[i * 3 + 1] = tmp.g;
      arr[i * 3 + 2] = tmp.b;
    }
    brightPaletteRef.current = arr;
    return arr;
  };

  const total = stateRef.current.width * stateRef.current.height * stateRef.current.depth;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colors = new Float32Array(total * 3);
    colors.fill(1);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const material = mesh.material as THREE.Material;
    material.needsUpdate = true;
  }, [total, gridVersion]);

  useEffect(() => {
    if (!active) return;
    const s = stateRef.current;
    resizeGridForCellSize(cellSizeRef.current);
    if (s.population === 0) {
      if (variantRef.current === 'lenia') seedRandom(s);
      else seedRandom(s);
    }
    runningRef.current = true;
    emitStats(s);
  }, [active, terrain]);

  useEffect(() => {
    const off = onLifeEvent((e) => {
      const s = stateRef.current;
      switch (e.type) {
        case 'play': runningRef.current = true; break;
        case 'pause': runningRef.current = false; break;
        case 'toggle': runningRef.current = !runningRef.current; break;
        case 'step': stepLife(s); break;
        case 'clear': clearLife(s); break;
        case 'seed-random': seedRandom(s, e.density); break;
        case 'seed-pattern': seedPattern(s, e.kind); break;
        case 'seed-qaraqalpaq': seedQaraqalpaq(s); break;
        case 'color-mode': colorModeRef.current = e.mode; break;
        case 'variant':
          variantRef.current = e.variant;
          setLifeVariant(s, e.variant);
          resizeGridForCellSize(cellSizeRef.current);
          brightPaletteRef.current = null;
          setGridVersion(v => v + 1);
          break;
        case 'speed': speedRef.current = Math.max(0.5, e.value); break;
        case 'cell-size': cellSizeRef.current = clampLifeCellSize(e.value); resizeGridForCellSize(cellSizeRef.current); break;
      }
      emitStats(stateRef.current);
    });
    return off;
  }, [meshAspect]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    if (!active || !meshRef.current) return;
    const s = stateRef.current;
    if (runningRef.current) {
      accumRef.current += delta;
      const interval = 1 / speedRef.current;
      let stepped = false;
      let safety = 0;
      while (accumRef.current >= interval && safety++ < 4) {
        accumRef.current -= interval;
        stepLife(s);
        stepped = true;
      }
      if (stepped) emitStats(s);
    }

    const cellSize = cellSizeRef.current;
    const mode = colorModeRef.current;
    const variant = variantRef.current;
    const positions = layout.positions;
    const surfaceColors = layout.surfaceColors;
    const bright = getBrightPalette(total);
    const values = s.values;

    for (let i = 0; i < total; i++) {
      const alive = s.cells[i] === 1;
      const leniaValue = values ? values[i] : 1;
      if (!alive) {
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0, 0, 0);
      } else {
        const px = positions[i * 3];
        const py = positions[i * 3 + 1];
        const pz = positions[i * 3 + 2];
        const lift = cellSize * (variant === 'life3d' ? 0.45 : 0.6);
        dummy.position.set(px, py, pz + lift);
        const ageT = Math.min(s.age[i], 60) / 60;
        const valueScale = variant === 'lenia' ? clamp01(0.35 + leniaValue * 0.9) : 1;
        const baseScale = cellSize * (variant === 'life3d' ? 0.52 : 0.7);
        const scale = baseScale * valueScale * (0.55 + 0.45 * ageT);
        dummy.scale.set(scale, scale, variant === 'lenia' ? scale * (0.5 + leniaValue * 1.7) : scale);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      if (alive) {
        if (mode === 'surface') {
          tmpColor.setRGB(surfaceColors[i * 3], surfaceColors[i * 3 + 1], surfaceColors[i * 3 + 2]);
        } else if (mode === 'bright') {
          tmpColor.setRGB(bright[i * 3], bright[i * 3 + 1], bright[i * 3 + 2]);
        } else if (variant === 'lenia') {
          const hue = 0.52 + leniaValue * 0.22;
          tmpColor.setHSL(hue, 0.95, 0.35 + leniaValue * 0.35);
        } else {
          const a = Math.min(s.age[i], 80) / 80;
          if (a < 0.33) tmpColor.setRGB(0.25, 0.95, 1.0);
          else if (a < 0.7) tmpColor.setRGB(1.0, 0.35, 0.85);
          else tmpColor.setRGB(1.0, 0.78, 0.2);
        }
        meshRef.current.setColorAt(i, tmpColor);
      } else {
        meshRef.current.setColorAt(i, tmpColor.setRGB(1, 1, 1));
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <instancedMesh
        key={`life-${stateRef.current.width}x${stateRef.current.height}x${stateRef.current.depth}`}
        ref={meshRef}
        args={[undefined, undefined, total]}
        frustumCulled={false}
        onPointerDown={(e) => {
          if (e.instanceId == null) return;
          const s = stateRef.current;
          const planeIndex = e.instanceId % (s.width * s.height);
          const z = Math.floor(e.instanceId / (s.width * s.height));
          const r = Math.floor(planeIndex / s.width);
          const c = planeIndex % s.width;
          toggleCell(s, r, c, z);
          emitStats(s);
          e.stopPropagation();
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

export default LifeOverlay;
