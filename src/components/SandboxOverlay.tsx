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

const CUBE_SIZE = 0.025;
const MAX_CUBES = 80000;
const MAX_DUST = 6000;

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);

// Vivid distinct colors per element
const COLORS = {
  water:      new THREE.Color(0.05, 0.35, 0.95),  // bright blue
  waterDeep:  new THREE.Color(0.02, 0.15, 0.70),  // deep blue
  irrig:      new THREE.Color(0.95, 0.65, 0.05),  // amber/orange
  irrigDeep:  new THREE.Color(0.80, 0.45, 0.02),  // dark amber
  salt:       new THREE.Color(0.97, 0.95, 0.90),  // bright white
  saltCrust:  new THREE.Color(0.85, 0.80, 0.70),  // tan crust
  reed:       new THREE.Color(0.10, 0.70, 0.15),  // vivid green
  reedTop:    new THREE.Color(0.30, 0.85, 0.20),  // lime
  dust:       new THREE.Color(0.85, 0.65, 0.40),  // sandy brown
};

// Shared geos
const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const reedGeo = new THREE.CylinderGeometry(0.003, 0.005, 0.10, 4);
const reedTopGeo = new THREE.SphereGeometry(0.012, 4, 3);

function toWorld(
  col: number, row: number, elev: number,
  terrain: TerrainData, elevRange: number, maxH: number
): [number, number, number] {
  const x = (col / (terrain.width - 1) - 0.5) * 10;
  const y = (0.5 - row / (terrain.height - 1)) * 10 * (terrain.height / terrain.width);
  const z = ((elev - terrain.minElevation) / elevRange) * maxH;
  return [x, y, z];
}

// Track falling cubes for drop animation
interface FallingCube {
  col: number;
  row: number;
  element: string;
  startTime: number;
  targetZ: number;
  currentZ: number;
  settled: boolean;
}

// Module-level falling cubes queue
const fallingCubes: FallingCube[] = [];
let lastAddTime = 0;

// Called externally when elements are placed
export function spawnFallingCubes(row: number, col: number, element: string, count: number = 8) {
  const now = performance.now() / 1000;
  for (let i = 0; i < count; i++) {
    fallingCubes.push({
      col: col + (Math.random() - 0.5) * 8,
      row: row + (Math.random() - 0.5) * 8,
      element,
      startTime: now + i * 0.05,
      targetZ: 0,
      currentZ: 3 + Math.random() * 2, // start high above
      settled: false,
    });
  }
  // Cap to prevent memory leak
  while (fallingCubes.length > 500) fallingCubes.shift();
  lastAddTime = now;
}

export default function SandboxOverlay({ terrain, exaggeration, simState, renderKey }: SandboxOverlayProps) {
  const cubeRef = useRef<THREE.InstancedMesh>(null);
  const reedRef = useRef<THREE.InstancedMesh>(null);
  const reedTopRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const dustPosArr = useRef(new Float32Array(MAX_DUST * 3));
  const dustColArr = useRef(new Float32Array(MAX_DUST * 3));
  const timeRef = useRef(0);

  const elevRange = terrain.maxElevation - terrain.minElevation || 1;
  const maxH = 10 * (exaggeration / 100);

  // Rebuild instances from sim state
  useEffect(() => {
    if (!simState || !cubeRef.current) return;
    const { width, height, waterDepth, irrigationDepth, saltDepth, reedsDensity, dustDensity, effectiveElev } = simState;

    let cubeCount = 0;
    let reedCount = 0;
    let dustCount = 0;
    const stride = width > 300 ? 2 : 1;

    for (let r = 0; r < height; r += stride) {
      for (let c = 0; c < width; c += stride) {
        const idx = r * width + c;
        const w = waterDepth[idx];
        const ir = irrigationDepth[idx];
        const s = saltDepth[idx];
        const re = reedsDensity[idx];
        const d = dustDensity[idx];
        const elev = effectiveElev[idx];

        // Water - stacking cubes, bright blue
        if (w > 0.02 && cubeCount < MAX_CUBES) {
          const layers = Math.min(Math.ceil(w / 1.0), 8);
          for (let L = 0; L < layers && cubeCount < MAX_CUBES; L++) {
            const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
            const stackZ = z + L * CUBE_SIZE * 1.1 + CUBE_SIZE * 0.5;
            // Slight random offset for organic feel
            const jx = Math.sin(idx * 7 + L * 3) * CUBE_SIZE * 0.3;
            const jy = Math.cos(idx * 11 + L * 5) * CUBE_SIZE * 0.3;
            _mat.compose(
              _pos.set(x + jx, y + jy, stackZ),
              _quat.setFromEuler(new THREE.Euler(0, 0, Math.sin(idx + L) * 0.15)),
              _scl.set(1, 1, 1)
            );
            cubeRef.current!.setMatrixAt(cubeCount, _mat);
            const shade = L / layers;
            cubeRef.current!.setColorAt(cubeCount,
              COLORS.water.clone().lerp(COLORS.waterDeep, shade));
            cubeCount++;
          }
        }

        // Irrigation - amber/orange stacking cubes
        if (ir > 0.02 && cubeCount < MAX_CUBES) {
          const layers = Math.min(Math.ceil(ir / 1.0), 6);
          for (let L = 0; L < layers && cubeCount < MAX_CUBES; L++) {
            const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
            const stackZ = z + L * CUBE_SIZE * 1.1 + CUBE_SIZE * 0.5;
            _mat.compose(
              _pos.set(x + Math.sin(idx * 5 + L) * CUBE_SIZE * 0.2, y, stackZ),
              _quat.setFromEuler(new THREE.Euler(0, 0, Math.cos(idx + L) * 0.1)),
              _scl.set(1, 1, 1)
            );
            cubeRef.current!.setMatrixAt(cubeCount, _mat);
            cubeRef.current!.setColorAt(cubeCount,
              COLORS.irrig.clone().lerp(COLORS.irrigDeep, L / layers));
            cubeCount++;
          }
        }

        // Salt - wide flat white slabs
        if (s > 0.02 && cubeCount < MAX_CUBES) {
          const layers = Math.min(Math.ceil(s / 1.5), 5);
          for (let L = 0; L < layers && cubeCount < MAX_CUBES; L++) {
            const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
            _mat.compose(
              _pos.set(x, y, z + L * CUBE_SIZE * 0.6 + CUBE_SIZE * 0.3),
              _quat.setFromEuler(new THREE.Euler(0, 0, (idx + L) * 0.3)),
              _scl.set(1.4, 1.4, 0.5)
            );
            cubeRef.current!.setMatrixAt(cubeCount, _mat);
            cubeRef.current!.setColorAt(cubeCount,
              COLORS.salt.clone().lerp(COLORS.saltCrust, L / layers));
            cubeCount++;
          }
        }

        // Reeds - tall green cylinders with round tops
        if (re > 0.1 && reedCount < MAX_CUBES) {
          const stalks = Math.min(Math.ceil(re / 2), 5);
          for (let st = 0; st < stalks && reedCount < MAX_CUBES; st++) {
            const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
            const ox = Math.sin(idx * 7 + st * 3) * CUBE_SIZE * 3;
            const oy = Math.cos(idx * 11 + st * 5) * CUBE_SIZE * 3;
            const h = 0.06 + re * 0.005;
            const stalkQuat = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(Math.PI / 2 + Math.sin(timeRef.current * 2 + idx + st) * 0.1, 0, Math.cos(idx * 3 + st) * 0.12)
            );
            _mat.compose(
              _pos.set(x + ox, y + oy, z + h * 0.5),
              stalkQuat,
              _scl.set(1, h / 0.10, 1)
            );
            reedRef.current?.setMatrixAt(reedCount, _mat);
            reedRef.current?.setColorAt(reedCount, COLORS.reed.clone().multiplyScalar(0.8 + st * 0.1));
            // Top
            _mat.compose(
              _pos.set(x + ox, y + oy, z + h + 0.01),
              _quat.identity(),
              _scl.set(0.8 + re * 0.03, 0.8, 0.8 + re * 0.03)
            );
            reedTopRef.current?.setMatrixAt(reedCount, _mat);
            reedTopRef.current?.setColorAt(reedCount, COLORS.reedTop);
            reedCount++;
          }
        }

        // Dust - floating particles
        if (d > 0.5 && dustCount < MAX_DUST) {
          const n = Math.min(Math.ceil(d / 8), 4);
          for (let p = 0; p < n && dustCount < MAX_DUST; p++) {
            const [x, y, z] = toWorld(c, r, elev, terrain, elevRange, maxH);
            const fi = dustCount * 3;
            dustPosArr.current[fi] = x + Math.sin(idx * 3 + p) * 0.06;
            dustPosArr.current[fi + 1] = y + Math.cos(idx * 5 + p) * 0.06;
            dustPosArr.current[fi + 2] = z + 0.15 + Math.random() * 0.3 + p * 0.08;
            const intensity = Math.min(d / 50, 1);
            dustColArr.current[fi] = COLORS.dust.r;
            dustColArr.current[fi + 1] = COLORS.dust.g - intensity * 0.1;
            dustColArr.current[fi + 2] = COLORS.dust.b - intensity * 0.15;
            dustCount++;
          }
        }
      }
    }

    // Add falling cubes (animated drops)
    const now = performance.now() / 1000;
    for (let fi = fallingCubes.length - 1; fi >= 0; fi--) {
      const fc = fallingCubes[fi];
      if (fc.settled || cubeCount >= MAX_CUBES) continue;
      const elapsed = now - fc.startTime;
      if (elapsed < 0) continue; // not started yet

      const [x, y, groundZ] = toWorld(
        Math.round(fc.col), Math.round(fc.row), 
        terrain.minElevation + (terrain.maxElevation - terrain.minElevation) * 0.3,
        terrain, elevRange, maxH
      );

      // Gravity drop: z = startH - 0.5*g*t^2
      const g = 8;
      const dropZ = fc.currentZ - 0.5 * g * elapsed * elapsed;
      const finalZ = Math.max(groundZ + CUBE_SIZE * 0.5, dropZ);

      if (finalZ <= groundZ + CUBE_SIZE * 0.6) {
        fc.settled = true;
      }

      const color = fc.element === 'river' ? COLORS.water :
                    fc.element === 'irrigation' ? COLORS.irrig :
                    fc.element === 'salt' ? COLORS.salt :
                    fc.element === 'reeds' ? COLORS.reed : COLORS.dust;

      // Tumbling rotation during fall
      const spin = elapsed * 5;
      _mat.compose(
        _pos.set(x, y, finalZ),
        _quat.setFromEuler(new THREE.Euler(spin, spin * 0.7, 0)),
        _scl.set(1, 1, 1)
      );
      cubeRef.current!.setMatrixAt(cubeCount, _mat);
      cubeRef.current!.setColorAt(cubeCount, color);
      cubeCount++;
    }

    // Clean up old settled cubes
    const cutoff = now - 2;
    while (fallingCubes.length > 0 && fallingCubes[0].settled && fallingCubes[0].startTime < cutoff) {
      fallingCubes.shift();
    }

    // Hide unused
    const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = cubeCount; k < Math.min(cubeCount + 20, MAX_CUBES); k++) cubeRef.current?.setMatrixAt(k, hideM);
    for (let k = reedCount; k < Math.min(reedCount + 20, MAX_CUBES); k++) {
      reedRef.current?.setMatrixAt(k, hideM);
      reedTopRef.current?.setMatrixAt(k, hideM);
    }
    for (let k = dustCount; k < Math.min(dustCount + 30, MAX_DUST); k++) {
      dustPosArr.current[k * 3 + 2] = -100;
    }

    // Commit
    if (cubeRef.current) {
      cubeRef.current.count = cubeCount;
      cubeRef.current.instanceMatrix.needsUpdate = true;
      if (cubeRef.current.instanceColor) cubeRef.current.instanceColor.needsUpdate = true;
    }
    if (reedRef.current) {
      reedRef.current.count = reedCount;
      reedRef.current.instanceMatrix.needsUpdate = true;
      if (reedRef.current.instanceColor) reedRef.current.instanceColor.needsUpdate = true;
    }
    if (reedTopRef.current) {
      reedTopRef.current.count = reedCount;
      reedTopRef.current.instanceMatrix.needsUpdate = true;
      if (reedTopRef.current.instanceColor) reedTopRef.current.instanceColor.needsUpdate = true;
    }
    if (dustRef.current) {
      const geo = dustRef.current.geometry;
      geo.setAttribute('position', new THREE.Float32BufferAttribute(dustPosArr.current.slice(0, dustCount * 3), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(dustColArr.current.slice(0, dustCount * 3), 3));
    }
  }, [terrain, exaggeration, simState, renderKey, elevRange, maxH]);

  // Animate dust drift + request falling cube re-render
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (dustRef.current) {
      const posAttr = dustRef.current.geometry.getAttribute('position');
      if (posAttr) {
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          if (arr[i + 2] < -50) continue;
          arr[i] += delta * 0.04; // east drift
          arr[i + 1] += Math.sin(timeRef.current * 1.5 + i * 0.7) * delta * 0.008;
          arr[i + 2] += Math.sin(timeRef.current * 2 + i) * delta * 0.01;
        }
        posAttr.needsUpdate = true;
      }
    }
  });

  const dustMat = useMemo(() => new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* All solid cubes (water, irrigation, salt, falling) */}
      <instancedMesh ref={cubeRef} args={[cubeGeo, undefined, MAX_CUBES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors transparent opacity={0.85} roughness={0.4} metalness={0.1} />
      </instancedMesh>

      {/* Reed stems */}
      <instancedMesh ref={reedRef} args={[reedGeo, undefined, MAX_CUBES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>

      {/* Reed tops */}
      <instancedMesh ref={reedTopRef} args={[reedTopGeo, undefined, MAX_CUBES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </instancedMesh>

      {/* Dust particles */}
      <points ref={dustRef} material={dustMat}>
        <bufferGeometry />
      </points>
    </group>
  );
}
