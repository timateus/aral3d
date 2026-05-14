import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { TerrainData } from '@/lib/geotiff-loader';
import { getElevationColor } from '@/lib/geotiff-loader';
import {
  createLife, stepLife, seedRandom, seedPattern, seedQaraqalpaq, clearLife, toggleCell,
  onLifeEvent, emitLifeStats, LifeState, LifeColorMode, resizeLife, getLifeSettings,
  DEFAULT_LIFE_CELL_SIZE,
} from '@/lib/life-simulation';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
}

/**
 * Conway's Game of Life rendered as little glowing cubes draped over the
 * terrain. Cells are in their own grid (independent of terrain resolution)
 * and are positioned by sampling terrain elevation at the cell's mesh xy.
 */
const meshWidth = 10;

const gridWidthForCellSize = (cellSize: number) => Math.max(12, Math.min(160, Math.round(96 * (DEFAULT_LIFE_CELL_SIZE / cellSize))));
const clampLifeCellSize = (cellSize: number) => Math.max(0.04, Math.min(1, cellSize));

const LifeOverlay = ({ terrain, exaggeration, active }: Props) => {
  const initialSettings = getLifeSettings();
  const stateRef = useRef<LifeState>(createLife());
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const runningRef = useRef(true);
  const speedRef = useRef(8); // generations per second
  const accumRef = useRef(0);
  const cellSizeRef = useRef(initialSettings.cellSize);
  const colorModeRef = useRef<LifeColorMode>(initialSettings.colorMode);
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
    gridWidth: s.width,
    gridHeight: s.height,
  });

  const resizeGridForCellSize = (cellSize: number) => {
    const nextW = gridWidthForCellSize(cellSize);
    const nextH = Math.max(12, Math.min(160, Math.round(nextW * meshAspect)));
    const s = stateRef.current;
    if (s.width === nextW && s.height === nextH) return s;
    resizeLife(s, nextW, nextH);
    brightPaletteRef.current = null;
    setGridVersion(v => v + 1);
    return s;
  };

  // Precompute base xy + elevation + surface color for each cell of the life grid
  const layout = useMemo(() => {
    const s = stateRef.current;
    const w = s.width, h = s.height;
    const positions = new Float32Array(w * h * 3);
    const surfaceColors = new Float32Array(w * h * 3);
    const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const meshAspect = th / tw;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const u = (c + 0.5) / w;
        const v = (r + 0.5) / h;
        const ti = Math.min(tw - 1, Math.floor(u * tw));
        const tj = Math.min(th - 1, Math.floor(v * th));
        let elev = elevations[tj * tw + ti];
        const nd = isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999;
        if (nd) elev = minElevation;
        const z = ((elev - minElevation) / elevRange) * maxHeight;
        const x = (u - 0.5) * 10;
        const y = (0.5 - v) * 10 * meshAspect;
        const idx = (r * w + c) * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
        const normalized = (elev - minElevation) / elevRange;
        const sc = getElevationColor(normalized, elev);
        surfaceColors[idx] = sc[0];
        surfaceColors[idx + 1] = sc[1];
        surfaceColors[idx + 2] = sc[2];
      }
    }
    return { positions, surfaceColors };
  }, [terrain, exaggeration, gridVersion]);

  // Lazily build a per-cell bright palette (vivid hues)
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


  // Fixed instance buffer sized to the entire grid; dead cells get scale 0.
  const total = stateRef.current.width * stateRef.current.height;

  // Initial seed when activated
  useEffect(() => {
    if (!active) return;
    const s = stateRef.current;
    resizeGridForCellSize(cellSizeRef.current);
    if (s.population === 0) {
      seedRandom(s);
    }
    runningRef.current = true;
    emitStats(s);
  }, [active, terrain]);

  // HUD event handling
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
        case 'speed': speedRef.current = Math.max(0.5, e.value); break;
        case 'cell-size': cellSizeRef.current = clampLifeCellSize(e.value); resizeGridForCellSize(cellSizeRef.current); break;
      }
      emitStats(stateRef.current);
    });
    return off;
  }, [meshAspect]);

  // Per-frame stepping + instance update
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
      if (stepped) {
        emitStats(s);
      }
    }
    const cellSize = cellSizeRef.current;
    const lift = cellSize * 0.6;
    const mode = colorModeRef.current;
    const positions = layout.positions;
    const surfaceColors = layout.surfaceColors;
    const bright = getBrightPalette(total);
    for (let i = 0; i < total; i++) {
      const alive = s.cells[i] === 1;
      if (!alive) {
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0, 0, 0);
      } else {
        const px = positions[i * 3];
        const py = positions[i * 3 + 1];
        const pz = positions[i * 3 + 2];
        dummy.position.set(px, py, pz + lift);
        const a = Math.min(s.age[i], 60) / 60;
        const scale = cellSize * (0.55 + 0.45 * a);
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (alive) {
        if (mode === 'surface') {
          tmpColor.setRGB(surfaceColors[i * 3], surfaceColors[i * 3 + 1], surfaceColors[i * 3 + 2]);
        } else if (mode === 'bright') {
          tmpColor.setRGB(bright[i * 3], bright[i * 3 + 1], bright[i * 3 + 2]);
        } else {
          const a = Math.min(s.age[i], 80) / 80;
          if (a < 0.33) tmpColor.setRGB(0.25, 0.95, 1.0);
          else if (a < 0.7) tmpColor.setRGB(1.0, 0.35, 0.85);
          else tmpColor.setRGB(1.0, 0.78, 0.2);
        }
        meshRef.current.setColorAt(i, tmpColor);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, total]}
        frustumCulled={false}
        onPointerDown={(e) => {
          // Toggle a cell at the clicked instance
          if (e.instanceId == null) return;
          const s = stateRef.current;
          const r = Math.floor(e.instanceId / s.width);
          const c = e.instanceId % s.width;
          toggleCell(s, r, c);
          emitLifeStats({ generation: s.generation, population: s.population, running: runningRef.current, speed: speedRef.current });
          e.stopPropagation();
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

export default LifeOverlay;
