import { useMemo, useRef, useEffect } from 'react';
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

const CUBE_SIZE = 0.032;
const REED_RADIUS = 0.006;
const REED_HEIGHT = 0.12;
const MAX_INSTANCES = 60000;
const MAX_DUST = 8000;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

// Shared geometries
const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const reedGeo = new THREE.CylinderGeometry(REED_RADIUS * 0.3, REED_RADIUS, REED_HEIGHT, 4);
const reedTopGeo = new THREE.ConeGeometry(REED_RADIUS * 1.5, REED_HEIGHT * 0.3, 4);

// Colors
const WATER_COLOR = new THREE.Color(0.07, 0.40, 0.85);
const IRRIG_COLOR = new THREE.Color(0.83, 0.63, 0.09);
const SALT_COLOR = new THREE.Color(0.91, 0.88, 0.82);
const REED_COLOR = new THREE.Color(0.15, 0.55, 0.18);
const REED_TOP_COLOR = new THREE.Color(0.35, 0.70, 0.25);

function toWorldPos(
  col: number, row: number, elev: number, terrain: TerrainData, elevRange: number, maxHeight: number
): [number, number, number] {
  const x = (col / (terrain.width - 1) - 0.5) * 10;
  const y = (0.5 - row / (terrain.height - 1)) * 10 * (terrain.height / terrain.width);
  const z = ((elev - terrain.minElevation) / elevRange) * maxHeight;
  return [x, y, z];
}

export default function SandboxOverlay({ terrain, exaggeration, simState, renderKey }: SandboxOverlayProps) {
  const waterRef = useRef<THREE.InstancedMesh>(null);
  const irrigRef = useRef<THREE.InstancedMesh>(null);
  const saltRef = useRef<THREE.InstancedMesh>(null);
  const reedRef = useRef<THREE.InstancedMesh>(null);
  const reedTopRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const dustPositions = useRef(new Float32Array(MAX_DUST * 3));
  const dustColors = useRef(new Float32Array(MAX_DUST * 3));
  const dustSizes = useRef(new Float32Array(MAX_DUST));
  const timeRef = useRef(0);

  // Update instanced meshes each render
  useEffect(() => {
    if (!simState) return;
    const { width, height } = terrain;
    const { waterDepth, irrigationDepth, saltDepth, dustDensity, reedsDensity, effectiveElev } = simState;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxHeight = 10 * (exaggeration / 100);

    let wCount = 0, iCount = 0, sCount = 0, rCount = 0;
    let dCount = 0;

    // Sample stride for performance - skip pixels
    const stride = width > 300 ? 2 : 1;

    for (let j = 0; j < height; j += stride) {
      for (let i = 0; i < width; i += stride) {
        const idx = j * width + i;
        const w = waterDepth[idx];
        const ir = irrigationDepth[idx];
        const s = saltDepth[idx];
        const d = dustDensity[idx];
        const re = reedsDensity[idx];
        const elev = effectiveElev[idx];

        // Water cubes - stack them
        if (w > 0.01 && wCount < MAX_INSTANCES) {
          const layers = Math.min(Math.ceil(w / 1.5), 5);
          for (let layer = 0; layer < layers && wCount < MAX_INSTANCES; layer++) {
            const [x, y, z] = toWorldPos(i, j, elev + layer * 0.8, terrain, elevRange, maxHeight);
            _mat4.compose(
              _pos.set(x, y, z + CUBE_SIZE * 0.5),
              _quat.identity(),
              _scale.set(1, 1, 1)
            );
            waterRef.current?.setMatrixAt(wCount, _mat4);
            const shade = 0.7 + layer * 0.06;
            waterRef.current?.setColorAt(wCount, WATER_COLOR.clone().multiplyScalar(shade));
            wCount++;
          }
        }

        // Irrigation cubes
        if (ir > 0.01 && iCount < MAX_INSTANCES) {
          const layers = Math.min(Math.ceil(ir / 1.5), 4);
          for (let layer = 0; layer < layers && iCount < MAX_INSTANCES; layer++) {
            const [x, y, z] = toWorldPos(i, j, elev + layer * 0.8, terrain, elevRange, maxHeight);
            _mat4.compose(
              _pos.set(x, y, z + CUBE_SIZE * 0.5),
              _quat.identity(),
              _scale.set(1, 1, 1)
            );
            irrigRef.current?.setMatrixAt(iCount, _mat4);
            irrigRef.current?.setColorAt(iCount, IRRIG_COLOR.clone().multiplyScalar(0.8 + layer * 0.05));
            iCount++;
          }
        }

        // Salt cubes - flat stacks
        if (s > 0.01 && sCount < MAX_INSTANCES) {
          const layers = Math.min(Math.ceil(s / 2), 3);
          for (let layer = 0; layer < layers && sCount < MAX_INSTANCES; layer++) {
            const [x, y, z] = toWorldPos(i, j, elev + layer * 0.5, terrain, elevRange, maxHeight);
            _mat4.compose(
              _pos.set(x, y, z + CUBE_SIZE * 0.3),
              _quat.identity(),
              _scale.set(1.3, 1.3, 0.6) // flatter cubes for salt (z is up)
            );
            saltRef.current?.setMatrixAt(sCount, _mat4);
            saltRef.current?.setColorAt(sCount, SALT_COLOR);
            sCount++;
          }
        }

        // Reeds - tall thin cylinders (cylinder is Y-aligned, but we need Z-aligned in local space)
        if (re > 0.01 && rCount < MAX_INSTANCES) {
          const stalks = Math.min(Math.ceil(re / 3), 4);
          const reedRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
          for (let stalk = 0; stalk < stalks && rCount < MAX_INSTANCES; stalk++) {
            const offsetX = (Math.sin(idx * 7 + stalk * 3) * 0.5) * CUBE_SIZE * 2;
            const offsetY = (Math.cos(idx * 11 + stalk * 5) * 0.5) * CUBE_SIZE * 2;
            const reedH = REED_HEIGHT * (0.6 + re * 0.04);
            const [x, y, z] = toWorldPos(i, j, elev, terrain, elevRange, maxHeight);
            // Stem - rotate cylinder from Y-up to Z-up in local space
            const stalkTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
              Math.PI / 2 + Math.sin(idx * 3 + stalk) * 0.15, 0,
              Math.cos(idx * 5 + stalk) * 0.15
            ));
            _mat4.compose(
              _pos.set(x + offsetX, y + offsetY, z + reedH * 0.5),
              stalkTilt,
              _scale.set(1, reedH / REED_HEIGHT, 1)
            );
            reedRef.current?.setMatrixAt(rCount, _mat4);
            reedRef.current?.setColorAt(rCount, REED_COLOR.clone().multiplyScalar(0.8 + stalk * 0.1));
            // Top tuft
            _mat4.compose(
              _pos.set(x + offsetX, y + offsetY, z + reedH + 0.01),
              reedRotation,
              _scale.set(1 + re * 0.02, 1, 1 + re * 0.02)
            );
            reedTopRef.current?.setMatrixAt(rCount, _mat4);
            reedTopRef.current?.setColorAt(rCount, REED_TOP_COLOR);
            rCount++;
          }
        }

        // Dust particles - float above terrain (z is up in local space)
        if (d > 0.1 && dCount < MAX_DUST) {
          const particles = Math.min(Math.ceil(d / 10), 3);
          for (let p = 0; p < particles && dCount < MAX_DUST; p++) {
            const floatH = 1.5 + Math.sin(idx * 7 + p * 13) * 1.0 + p * 0.5;
            const [x, y, z] = toWorldPos(i, j, elev, terrain, elevRange, maxHeight);
            const pi = dCount * 3;
            dustPositions.current[pi] = x + Math.sin(idx * 3 + p) * 0.05;
            dustPositions.current[pi + 1] = y + Math.cos(idx * 5 + p) * 0.05;
            dustPositions.current[pi + 2] = z + floatH * (maxHeight / 10);
            const intensity = Math.min(d / 50, 1);
            dustColors.current[pi] = 0.78;
            dustColors.current[pi + 1] = 0.66 - intensity * 0.1;
            dustColors.current[pi + 2] = 0.49 - intensity * 0.15;
            dustSizes.current[dCount] = 3 + intensity * 5;
            dCount++;
          }
        }
      }
    }

    // Hide unused instances by scaling to zero
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = wCount; k < Math.min(wCount + 10, MAX_INSTANCES); k++) waterRef.current?.setMatrixAt(k, hideMatrix);
    for (let k = iCount; k < Math.min(iCount + 10, MAX_INSTANCES); k++) irrigRef.current?.setMatrixAt(k, hideMatrix);
    for (let k = sCount; k < Math.min(sCount + 10, MAX_INSTANCES); k++) saltRef.current?.setMatrixAt(k, hideMatrix);
    for (let k = rCount; k < Math.min(rCount + 10, MAX_INSTANCES); k++) reedRef.current?.setMatrixAt(k, hideMatrix);
    for (let k = rCount; k < Math.min(rCount + 10, MAX_INSTANCES); k++) reedTopRef.current?.setMatrixAt(k, hideMatrix);

    // Zero out unused dust
    for (let k = dCount; k < Math.min(dCount + 30, MAX_DUST); k++) {
      dustPositions.current[k * 3 + 1] = -100;
    }

    // Update instance counts
    if (waterRef.current) { waterRef.current.count = wCount; waterRef.current.instanceMatrix.needsUpdate = true; if (waterRef.current.instanceColor) waterRef.current.instanceColor.needsUpdate = true; }
    if (irrigRef.current) { irrigRef.current.count = iCount; irrigRef.current.instanceMatrix.needsUpdate = true; if (irrigRef.current.instanceColor) irrigRef.current.instanceColor.needsUpdate = true; }
    if (saltRef.current) { saltRef.current.count = sCount; saltRef.current.instanceMatrix.needsUpdate = true; if (saltRef.current.instanceColor) saltRef.current.instanceColor.needsUpdate = true; }
    if (reedRef.current) { reedRef.current.count = rCount; reedRef.current.instanceMatrix.needsUpdate = true; if (reedRef.current.instanceColor) reedRef.current.instanceColor.needsUpdate = true; }
    if (reedTopRef.current) { reedTopRef.current.count = rCount; reedTopRef.current.instanceMatrix.needsUpdate = true; if (reedTopRef.current.instanceColor) reedTopRef.current.instanceColor.needsUpdate = true; }

    if (dustRef.current) {
      const geo = dustRef.current.geometry;
      geo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions.current.slice(0, dCount * 3), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(dustColors.current.slice(0, dCount * 3), 3));
      geo.setAttribute('size', new THREE.Float32BufferAttribute(dustSizes.current.slice(0, dCount), 1));
    }
  }, [terrain, exaggeration, simState, renderKey]);

  // Animate dust particles drifting
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!dustRef.current) return;
    const posAttr = dustRef.current.geometry.getAttribute('position');
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i + 2] < -50) continue; // z is height in local space
      // Drift east (x) + wobble on y and z
      arr[i] += delta * 0.03; // east drift
      arr[i + 1] += Math.sin(timeRef.current * 1.5 + i * 0.7) * delta * 0.005;
      arr[i + 2] += Math.sin(timeRef.current * 2 + i) * delta * 0.008; // height wobble
    }
    posAttr.needsUpdate = true;
  });

  // Sway reeds
  useFrame((_, delta) => {
    timeRef.current += delta * 0.5;
    if (!reedRef.current) return;
    // Subtle wind sway on reed instances - handled by simulation wind already
  });

  const dustMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Water cubes */}
      <instancedMesh ref={waterRef} args={[cubeGeo, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors transparent opacity={0.8} roughness={0.3} metalness={0.2} />
      </instancedMesh>

      {/* Irrigation cubes */}
      <instancedMesh ref={irrigRef} args={[cubeGeo, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors transparent opacity={0.75} roughness={0.5} />
      </instancedMesh>

      {/* Salt cubes */}
      <instancedMesh ref={saltRef} args={[cubeGeo, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
      </instancedMesh>

      {/* Reed stems */}
      <instancedMesh ref={reedRef} args={[reedGeo, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>

      {/* Reed tops */}
      <instancedMesh ref={reedTopRef} args={[reedTopGeo, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>

      {/* Dust particle system */}
      <points ref={dustRef} material={dustMaterial}>
        <bufferGeometry />
      </points>
    </group>
  );
}
