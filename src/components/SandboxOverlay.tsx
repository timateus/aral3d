import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { TerrainData } from '@/lib/geotiff-loader';
import type { SandboxSimState } from '@/lib/sandbox-simulation';

interface SandboxOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  simState: SandboxSimState;
  renderKey: number;
}

const CUBE_SIZE = 0.022;
const MAX_CUBES = 100000;

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);

// Water color gradient from shallow to deep
const SHALLOW = new THREE.Color(0.15, 0.55, 0.95);  // bright cyan-blue
const DEEP = new THREE.Color(0.02, 0.12, 0.55);      // dark navy

const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

function toWorld(
  col: number, row: number, elev: number,
  terrain: TerrainData, elevRange: number, maxH: number
): [number, number, number] {
  const x = (col / (terrain.width - 1) - 0.5) * 10;
  const y = (0.5 - row / (terrain.height - 1)) * 10 * (terrain.height / terrain.width);
  const z = ((elev - terrain.minElevation) / elevRange) * maxH;
  return [x, y, z];
}

export default function SandboxOverlay({ terrain, exaggeration, simState, renderKey }: SandboxOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const elevRange = terrain.maxElevation - terrain.minElevation || 1;
  const maxH = 10 * (exaggeration / 100);

  useEffect(() => {
    if (!simState || !meshRef.current) return;
    const { width, height, waterDepth } = simState;
    const elevations = simState.terrain.elevations;
    const noData = simState.terrain.noDataValue;

    let count = 0;
    const stride = width > 300 ? 2 : 1;
    const _color = new THREE.Color();

    for (let r = 0; r < height; r += stride) {
      for (let c = 0; c < width; c += stride) {
        const idx = r * width + c;
        const w = waterDepth[idx];
        if (w < 0.02) continue;

        let elev = elevations[idx];
        if (isNaN(elev) || (noData !== null && elev === noData) || elev <= -9999) continue;

        // Stack cubes based on water depth
        const layers = Math.min(Math.ceil(w / 1.0), 10);
        for (let L = 0; L < layers && count < MAX_CUBES; L++) {
          const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
          const stackZ = z + L * CUBE_SIZE * 1.05 + CUBE_SIZE * 0.5;

          // Slight jitter for organic look
          const jx = Math.sin(idx * 7 + L * 3) * CUBE_SIZE * 0.25;
          const jy = Math.cos(idx * 11 + L * 5) * CUBE_SIZE * 0.25;

          _mat.compose(
            _pos.set(x + jx, y + jy, stackZ),
            _quat.setFromEuler(new THREE.Euler(0, 0, Math.sin(idx + L) * 0.1)),
            _scl.set(1, 1, 1)
          );
          meshRef.current!.setMatrixAt(count, _mat);

          // Color: shallow layers are bright, deep are dark
          const t = L / Math.max(layers - 1, 1);
          _color.copy(SHALLOW).lerp(DEEP, t);
          meshRef.current!.setColorAt(count, _color);
          count++;
        }
      }
    }

    // Hide unused
    const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = count; k < Math.min(count + 50, MAX_CUBES); k++) {
      meshRef.current!.setMatrixAt(k, hideM);
    }

    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [terrain, exaggeration, simState, renderKey, elevRange, maxH]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <instancedMesh ref={meshRef} args={[cubeGeo, undefined, MAX_CUBES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors transparent opacity={0.8} roughness={0.3} metalness={0.15} />
      </instancedMesh>
    </group>
  );
}
