import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getColumnHeight, type VoxelWorld } from '@/lib/voxel/voxel-world';

// Neutral fox that scatters when player is near.
const Fox = ({ world, count = 6 }: { world: VoxelWorld; count?: number }) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const states = useRef<{ x: number; z: number; vx: number; vz: number }[]>([]);

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(0.5, 0.5, 0.9);
    g.translate(0, 0.25, 0);
    return g;
  }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c45a2a', roughness: 0.8 }), []);

  useEffect(() => {
    const halfW = world.width / 2, halfD = world.depth / 2;
    const arr: any[] = [];
    for (let n = 0; n < count; n++) {
      const i = Math.floor(Math.random() * world.width);
      const j = Math.floor(Math.random() * world.depth);
      if (getColumnHeight(world, i, j) === 0) continue;
      arr.push({ x: (i - halfW) + 0.5, z: (j - halfD) + 0.5, vx: 0, vz: 0 });
    }
    states.current = arr;
  }, [world, count]);

  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const halfW = world.width / 2, halfD = world.depth / 2;
    for (let i = 0; i < states.current.length; i++) {
      const s = states.current[i];
      const dx = s.x - camera.position.x;
      const dz = s.z - camera.position.z;
      const distSq = dx*dx + dz*dz;
      if (distSq < 100) {
        const d = Math.sqrt(distSq) || 1;
        s.vx = (dx / d) * 3;
        s.vz = (dz / d) * 3;
      } else if (Math.random() < 0.02) {
        const ang = Math.random() * Math.PI * 2;
        s.vx = Math.cos(ang) * 1.4;
        s.vz = Math.sin(ang) * 1.4;
      }
      s.x = Math.max(-halfW + 1, Math.min(halfW - 1, s.x + s.vx * delta));
      s.z = Math.max(-halfD + 1, Math.min(halfD - 1, s.z + s.vz * delta));
      const ii = Math.floor(s.x + halfW), jj = Math.floor(s.z + halfD);
      const h = getColumnHeight(world, ii, jj);
      tmpPos.set(s.x, h, s.z);
      tmpQuat.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.atan2(s.vx, s.vz));
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      meshRef.current.setMatrixAt(i, tmpMat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = states.current.length;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} />;
};

export default Fox;
