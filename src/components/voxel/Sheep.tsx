import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getColumnHeight, type VoxelWorld } from '@/lib/voxel/voxel-world';

interface Props {
  world: VoxelWorld;
  count?: number;
  onShear?: () => void;
}

interface S { x: number; z: number; vx: number; vz: number; alive: boolean; }

const Sheep = ({ world, count = 8, onShear }: Props) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const states = useRef<S[]>([]);

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(0.7, 0.8, 1.0);
    g.translate(0, 0.4, 0);
    return g;
  }, []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 0.95 }), []);

  useEffect(() => {
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const arr: S[] = [];
    const grassId = world.idIndex.get('grass');
    const reedId = world.idIndex.get('reed');
    for (let n = 0; n < count; n++) {
      let attempts = 0;
      while (attempts++ < 80) {
        const i = Math.floor(Math.random() * world.width);
        const j = Math.floor(Math.random() * world.depth);
        const h = getColumnHeight(world, i, j);
        if (h === 0) continue;
        const top = world.cells[(j * world.width + i) * world.maxStackHeight + h - 1];
        if (top === grassId || top === reedId || attempts > 60) {
          arr.push({ x: (i - halfW) + 0.5, z: (j - halfD) + 0.5, vx: 0, vz: 0, alive: true });
          break;
        }
      }
    }
    states.current = arr;
  }, [world, count]);

  useEffect(() => {
    const onClick = (e: Event) => {
      const ce = e as CustomEvent<{ pos: number[]; dir: number[]; handled: { value: boolean } }>;
      const { pos, dir, handled } = ce.detail;
      if (handled.value) return;
      let best = -1, bd = Infinity;
      for (let i = 0; i < states.current.length; i++) {
        const s = states.current[i]; if (!s.alive) continue;
        const dx = s.x - pos[0], dz = s.z - pos[2];
        const d2 = dx*dx + dz*dz;
        if (d2 > 16) continue;
        const len = Math.sqrt(d2) || 1;
        const dot = (dx / len) * dir[0] + (dz / len) * dir[2];
        if (dot < 0.5) continue;
        if (d2 < bd) { bd = d2; best = i; }
      }
      if (best >= 0) { handled.value = true; onShear?.(); }
    };
    window.addEventListener('voxel:left-click', onClick);
    return () => {
      window.removeEventListener('voxel:left-click', onClick);
    };
  }, [onShear, world]);


  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const halfW = world.width / 2, halfD = world.depth / 2;
    for (let i = 0; i < states.current.length; i++) {
      const s = states.current[i];
      if (Math.random() < 0.015) {
        const ang = Math.random() * Math.PI * 2;
        s.vx = Math.cos(ang) * 0.8;
        s.vz = Math.sin(ang) * 0.8;
      }
      let nx = Math.max(-halfW + 1, Math.min(halfW - 1, s.x + s.vx * delta));
      let nz = Math.max(-halfD + 1, Math.min(halfD - 1, s.z + s.vz * delta));
      s.x = nx; s.z = nz;
      const ii = Math.floor(nx + halfW), jj = Math.floor(nz + halfD);
      const h = getColumnHeight(world, ii, jj);
      tmpPos.set(nx, h, nz);
      tmpQuat.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.atan2(s.vx, s.vz));
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      meshRef.current.setMatrixAt(i, tmpMat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = states.current.length;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />;
};

export default Sheep;
