import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type VoxelWorld } from '@/lib/voxel/voxel-world';

interface FishState {
  x: number; y: number; z: number; phase: number;
}

// Bobbing fish: instanced quads on water columns.
const Fish = ({ world, count = 80 }: { world: VoxelWorld; count?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const positions = useRef<FishState[]>([]);

  const geometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.1, 0.5), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9bc8d8', emissive: '#234', roughness: 0.6 }), []);

  useEffect(() => {
    const halfW = world.width / 2, halfD = world.depth / 2;
    const waterId = world.idIndex.get('water');
    const arr: FishState[] = [];
    let attempts = 0;
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
      });
    }
    positions.current = arr;
  }, [world, count]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const list = positions.current;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const dy = Math.sin(t * 1.5 + f.phase) * 0.1;
      const yaw = t * 0.4 + f.phase;
      tmpPos.set(f.x + Math.cos(yaw) * 0.2, f.y + dy, f.z + Math.sin(yaw) * 0.2);
      tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      meshRef.current.setMatrixAt(i, tmpMat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = list.length;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />;
};

export default Fish;
