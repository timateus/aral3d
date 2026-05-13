import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { TerrainData } from '@/lib/geotiff-loader';
import {
  createLife, stepLife, seedRandom, seedPattern, clearLife, toggleCell,
  onLifeEvent, emitLifeStats, LifeState,
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
const LifeOverlay = ({ terrain, exaggeration, active }: Props) => {
  const stateRef = useRef<LifeState>(createLife());
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const runningRef = useRef(true);
  const speedRef = useRef(8); // generations per second
  const accumRef = useRef(0);
  const cellSizeRef = useRef(0.11);
  const [, force] = useState(0);

  // Precompute base xy + elevation for each cell of the life grid
  const layout = useMemo(() => {
    const s = stateRef.current;
    const w = s.width, h = s.height;
    const positions = new Float32Array(w * h * 3);
    const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const elevRange = maxElevation - minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);
    const meshAspect = th / tw;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const u = (c + 0.5) / w;
        const v = (r + 0.5) / h;
        // Sample elevation via nearest neighbor on terrain grid
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
      }
    }
    return positions;
  }, [terrain, exaggeration]);

  // Fixed instance buffer sized to the entire grid; dead cells get scale 0.
  const total = stateRef.current.width * stateRef.current.height;

  // Initial seed when activated
  useEffect(() => {
    if (!active) return;
    const s = stateRef.current;
    if (s.population === 0) {
      seedRandom(s);
    }
    runningRef.current = true;
    emitLifeStats({ generation: s.generation, population: s.population, running: runningRef.current, speed: speedRef.current });
    force(n => n + 1);
  }, [active]);

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
        case 'speed': speedRef.current = Math.max(0.5, e.value); break;
        case 'cell-size': cellSizeRef.current = Math.max(0.04, e.value); break;
      }
      emitLifeStats({ generation: s.generation, population: s.population, running: runningRef.current, speed: speedRef.current });
    });
    return off;
  }, []);

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
      // Cap to avoid runaway after tab focus loss
      let safety = 0;
      while (accumRef.current >= interval && safety++ < 4) {
        accumRef.current -= interval;
        stepLife(s);
        stepped = true;
      }
      if (stepped) {
        emitLifeStats({ generation: s.generation, population: s.population, running: true, speed: speedRef.current });
      }
    }
    // Update instance matrices + colors
    const cellSize = cellSizeRef.current;
    const lift = cellSize * 0.6;
    const w = s.width;
    for (let i = 0; i < total; i++) {
      const alive = s.cells[i] === 1;
      if (!alive) {
        dummy.scale.set(0, 0, 0);
      } else {
        const px = layout[i * 3];
        const py = layout[i * 3 + 1];
        const pz = layout[i * 3 + 2];
        // Mesh is rotated -PI/2 around X by parent group, but we render at root.
        // Place cubes in the unrotated mesh frame: xy plane horizontal, z up;
        // we'll let the parent group handle the rotation match.
        dummy.position.set(px, py, pz + lift);
        const a = Math.min(s.age[i], 60) / 60;
        const scale = cellSize * (0.55 + 0.45 * a);
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (alive) {
        const a = Math.min(s.age[i], 80) / 80;
        // Young = cyan, mature = magenta, old = gold
        if (a < 0.33) tmpColor.setRGB(0.25, 0.95, 1.0);
        else if (a < 0.7) tmpColor.setRGB(1.0, 0.35, 0.85);
        else tmpColor.setRGB(1.0, 0.78, 0.2);
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
        <meshStandardMaterial
          vertexColors
          emissive={'#ffffff'}
          emissiveIntensity={0.35}
          roughness={0.4}
          metalness={0.1}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};

export default LifeOverlay;
