import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getColumnHeight, type VoxelWorld } from '@/lib/voxel/voxel-world';

interface Props {
  world: VoxelWorld;
  count?: number;
  onMilked?: () => void;
}

interface CamelState { x: number; z: number; vx: number; vz: number; alive: boolean; }

// Simple instanced camel mobs walking randomly on the voxel surface.
// Right-click + within 2 blocks -> 'milk' event (parent handles inventory).
const Camels = ({ world, count = 10, onMilked }: Props) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const states = useRef<CamelState[]>([]);

  const geometry = useMemo(() => {
    // Stylized "camel": tall capsule body + hump.
    const g = new THREE.BoxGeometry(0.8, 1.4, 1.6);
    g.translate(0, 0.7, 0);
    return g;
  }, []);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c89968', roughness: 0.85, metalness: 0,
  }), []);

  // Seed positions
  useEffect(() => {
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const arr: CamelState[] = [];
    for (let n = 0; n < count; n++) {
      // Find a non-empty column above water
      let attempts = 0;
      while (attempts++ < 50) {
        const i = Math.floor(Math.random() * world.width);
        const j = Math.floor(Math.random() * world.depth);
        const h = getColumnHeight(world, i, j);
        if (h > 0) {
          arr.push({
            x: (i - halfW) + 0.5,
            z: (j - halfD) + 0.5,
            vx: 0, vz: 0, alive: true,
          });
          break;
        }
      }
    }
    states.current = arr;
  }, [world, count]);

  // Left-click camel within range + forward cone -> milk
  useEffect(() => {
    const onClick = (e: Event) => {
      const ce = e as CustomEvent<{ pos: number[]; dir: number[]; handled: { value: boolean } }>;
      const { pos, dir, handled } = ce.detail;
      if (handled.value) return;
      let nearest = -1; let bestD = Infinity;
      for (let i = 0; i < states.current.length; i++) {
        const s = states.current[i]; if (!s.alive) continue;
        const dx = s.x - pos[0], dz = s.z - pos[2];
        const d2 = dx*dx + dz*dz;
        if (d2 > 16) continue; // 4 block reach
        // Forward cone: dot product of normalized offset with dir.xz > 0.5
        const len = Math.sqrt(d2) || 1;
        const dot = (dx / len) * dir[0] + (dz / len) * dir[2];
        if (dot < 0.5) continue;
        if (d2 < bestD) { bestD = d2; nearest = i; }
      }
      if (nearest >= 0) {
        handled.value = true;
        onMilked?.();
      }
    };
    // Salt poisons nearby camels.
    const onSalt = (e: Event) => {
      const halfW = world.width / 2, halfD = world.depth / 2;
      const { i, j } = (e as CustomEvent<{ i: number; j: number }>).detail;
      const sx = (i - halfW) + 0.5, sz = (j - halfD) + 0.5;
      for (const s of states.current) {
        if (!s.alive) continue;
        const dx = s.x - sx, dz = s.z - sz;
        if (dx*dx + dz*dz < 25) s.alive = false;
      }
    };
    window.addEventListener('voxel:left-click', onClick);
    window.addEventListener('voxel:salt-placed', onSalt);
    return () => {
      window.removeEventListener('voxel:left-click', onClick);
      window.removeEventListener('voxel:salt-placed', onSalt);
    };
  }, [onMilked, world]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    for (let i = 0; i < states.current.length; i++) {
      const s = states.current[i];
      if (!s.alive) continue;
      // Random walk
      if (Math.random() < 0.02) {
        const ang = Math.random() * Math.PI * 2;
        s.vx = Math.cos(ang) * 1.2;
        s.vz = Math.sin(ang) * 1.2;
      }
      let nx = s.x + s.vx * delta;
      let nz = s.z + s.vz * delta;
      nx = Math.max(-halfW + 1, Math.min(halfW - 1, nx));
      nz = Math.max(-halfD + 1, Math.min(halfD - 1, nz));
      s.x = nx; s.z = nz;
      const ii = Math.floor(nx + halfW);
      const jj = Math.floor(nz + halfD);
      const h = getColumnHeight(world, ii, jj);
      tmpPos.set(nx, h, nz);
      const yaw = Math.atan2(s.vx, s.vz);
      tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      meshRef.current.setMatrixAt(i, tmpMat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = states.current.length;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />;
};

export default Camels;
