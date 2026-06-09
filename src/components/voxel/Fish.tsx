import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type VoxelWorld } from '@/lib/voxel/voxel-world';

interface FishState {
  x: number; y: number; z: number; phase: number; bornAt: number;
}

// Bobbing fish: instanced quads on water columns. Salt nearby kills them.
// Periodically reproduces — new fish scale in next to a random existing one.
const Fish = ({ world, count = 80 }: { world: VoxelWorld; count?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const positions = useRef<FishState[]>([]);
  const maxCount = Math.max(8, count * 3);

  const geometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.1, 0.5), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9bc8d8', emissive: '#234', roughness: 0.6 }), []);

  useEffect(() => {
    const halfW = world.width / 2, halfD = world.depth / 2;
    const waterId = world.idIndex.get('water');
    const arr: FishState[] = [];
    let attempts = 0;
    const t0 = performance.now() - 5000; // already born
    while (arr.length < count && attempts++ < count * 50) {
      const i = Math.floor(Math.random() * world.width);
      const j = Math.floor(Math.random() * world.depth);
      const h = world.heights[j * world.width + i];
      if (h === 0) continue;
      const top = world.cells[(j * world.width + i) * world.maxStackHeight + h - 1];
      if (top !== waterId) continue;
      arr.push({
        x: (i - halfW) + 0.5,
        y: h - 0.3,
        z: (j - halfD) + 0.5,
        phase: Math.random() * Math.PI * 2,
        bornAt: t0,
      });
    }
    positions.current = arr;

    // Salt kill: remove any fish within 5 blocks of placed salt.
    const onSalt = (e: Event) => {
      const halfW2 = world.width / 2, halfD2 = world.depth / 2;
      const { i, j } = (e as CustomEvent<{ i: number; j: number }>).detail;
      const sx = (i - halfW2) + 0.5, sz = (j - halfD2) + 0.5;
      positions.current = positions.current.filter(f => {
        const dx = f.x - sx, dz = f.z - sz;
        return dx*dx + dz*dz >= 25;
      });
    };
    window.addEventListener('voxel:salt-placed', onSalt);

    // Reproduction tick — every 5 seconds, two fish "spawn" a child nearby.
    const id = window.setInterval(() => {
      const list = positions.current;
      if (list.length === 0 || list.length >= maxCount) return;
      const parent = list[Math.floor(Math.random() * list.length)];
      // Verify still water under the spawn cell
      const halfW2 = world.width / 2, halfD2 = world.depth / 2;
      const off = () => (Math.random() - 0.5) * 2.4;
      const nx = parent.x + off();
      const nz = parent.z + off();
      const ii = Math.floor(nx + halfW2);
      const jj = Math.floor(nz + halfD2);
      if (ii < 0 || ii >= world.width || jj < 0 || jj >= world.depth) return;
      const h = world.heights[jj * world.width + ii];
      if (h === 0) return;
      const top = world.cells[(jj * world.width + ii) * world.maxStackHeight + h - 1];
      if (top !== waterId) return;
      list.push({
        x: nx, y: h - 0.3, z: nz,
        phase: Math.random() * Math.PI * 2,
        bornAt: performance.now(),
      });
    }, 5000);

    return () => {
      window.removeEventListener('voxel:salt-placed', onSalt);
      clearInterval(id);
    };
  }, [world, count, maxCount]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const now = performance.now();
    const list = positions.current;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const dy = Math.sin(t * 1.5 + f.phase) * 0.1;
      const yaw = t * 0.4 + f.phase;
      tmpPos.set(f.x + Math.cos(yaw) * 0.2, f.y + dy, f.z + Math.sin(yaw) * 0.2);
      tmpQuat.setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
      // Grow-in animation over 2 s.
      const age = (now - f.bornAt) / 2000;
      const s = Math.min(1, Math.max(0.15, age));
      tmpScale.set(s, s, s);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      meshRef.current.setMatrixAt(i, tmpMat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = list.length;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, maxCount]} frustumCulled={false} />;
};

export default Fish;
