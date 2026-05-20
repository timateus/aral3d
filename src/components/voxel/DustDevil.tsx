// Slow particle column wandering salt flats. Visual-only in v2.
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getColumnHeight, type VoxelWorld } from '@/lib/voxel/voxel-world';
import { playSfx } from '@/lib/voxel/voxel-audio';

const DustDevil = ({ world, enabled = true }: { world: VoxelWorld; enabled?: boolean }) => {
  const meshRef = useRef<THREE.Points>(null);
  const center = useRef({ x: 0, z: 0, vx: 0.6, vz: 0.4 });
  const PARTICLES = 80;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLES * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const material = useMemo(() => new THREE.PointsMaterial({
    color: '#d4c9a8', size: 0.4, transparent: true, opacity: 0.55, sizeAttenuation: true,
  }), []);

  useEffect(() => {
    // Seed center on a sand/salt area
    const halfW = world.width / 2, halfD = world.depth / 2;
    const saltId = world.idIndex.get('salt');
    const sandId = world.idIndex.get('sand');
    for (let n = 0; n < 100; n++) {
      const i = Math.floor(Math.random() * world.width);
      const j = Math.floor(Math.random() * world.depth);
      const h = world.heights[j * world.width + i];
      if (h === 0) continue;
      const top = world.cells[(j * world.width + i) * world.maxStackHeight + h - 1];
      if (top === saltId || top === sandId) {
        center.current.x = (i - halfW) + 0.5;
        center.current.z = (j - halfD) + 0.5;
        break;
      }
    }
  }, [world]);

  const lastSfx = useRef(0);

  useFrame((state, delta) => {
    if (!enabled || !meshRef.current) return;
    const c = center.current;
    // Drift
    if (Math.random() < 0.005) {
      const ang = Math.random() * Math.PI * 2;
      c.vx = Math.cos(ang) * 0.8;
      c.vz = Math.sin(ang) * 0.8;
    }
    const halfW = world.width / 2 - 5, halfD = world.depth / 2 - 5;
    c.x = Math.max(-halfW, Math.min(halfW, c.x + c.vx * delta));
    c.z = Math.max(-halfD, Math.min(halfD, c.z + c.vz * delta));
    const ii = Math.floor(c.x + world.width / 2);
    const jj = Math.floor(c.z + world.depth / 2);
    const baseY = getColumnHeight(world, ii, jj);

    const t = state.clock.elapsedTime;
    const arr = (geometry.attributes.position.array as Float32Array);
    for (let i = 0; i < PARTICLES; i++) {
      const ang = (i / PARTICLES) * Math.PI * 2 + t * 2 + (i % 5);
      const r = 0.5 + (i / PARTICLES) * 1.2 + Math.sin(t + i) * 0.2;
      const y = baseY + (i / PARTICLES) * 6 + Math.sin(t * 3 + i) * 0.2;
      arr[i * 3 + 0] = c.x + Math.cos(ang) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = c.z + Math.sin(ang) * r;
    }
    geometry.attributes.position.needsUpdate = true;

    if (t - lastSfx.current > 6) {
      playSfx('wind');
      lastSfx.current = t;
    }
  });

  if (!enabled) return null;
  return <points ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />;
};

export default DustDevil;
