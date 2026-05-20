import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { BLOCKS, RENDERABLE_BLOCKS, type BlockId } from '@/lib/voxel/block-types';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';

interface Props {
  world: VoxelWorld;
  version: number; // bump to rebuild instances
}

// Renders the voxel world as: per-column top cube + scaled shaft below it.
// Two InstancedMesh per block type (tops + shafts).
const VoxelTerrain = ({ world, version }: Props) => {
  const groupRef = useRef<THREE.Group>(null);

  // Pre-create a single shared box geometry.
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Build per-block-type instanced meshes.
  const meshes = useMemo(() => {
    const out: { id: BlockId; topMesh: THREE.InstancedMesh; shaftMesh: THREE.InstancedMesh }[] = [];
    for (const id of RENDERABLE_BLOCKS) {
      const def = BLOCKS[id];
      const color = new THREE.Color(def.color);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: id === 'water' ? 0.3 : id === 'snow' ? 0.4 : 0.85,
        metalness: 0,
        transparent: id === 'water',
        opacity: id === 'water' ? 0.75 : 1,
        emissive: def.emissive ? color.clone().multiplyScalar(0.4) : new THREE.Color(0x000000),
      });
      const topMesh = new THREE.InstancedMesh(boxGeo, mat, world.width * world.depth);
      topMesh.count = 0;
      topMesh.frustumCulled = false;
      const shaftMesh = new THREE.InstancedMesh(boxGeo, mat, world.width * world.depth);
      shaftMesh.count = 0;
      shaftMesh.frustumCulled = false;
      out.push({ id, topMesh, shaftMesh });
    }
    return out;
  }, [boxGeo, world.width, world.depth]);

  // Populate instances whenever version changes.
  useEffect(() => {
    const tmpMatrix = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();

    // Reset all counts.
    const counts = new Map<BlockId, { top: number; shaft: number }>();
    for (const m of meshes) counts.set(m.id, { top: 0, shaft: 0 });
    const meshById = new Map(meshes.map(m => [m.id, m]));

    const halfW = world.width / 2;
    const halfD = world.depth / 2;

    for (let j = 0; j < world.depth; j++) {
      for (let i = 0; i < world.width; i++) {
        const idx = j * world.width + i;
        const h = world.heights[idx];
        if (h === 0) continue;
        const topY = h - 1;
        const topBlockIdx = world.cells[idx * world.maxStackHeight + topY];
        if (topBlockIdx === 0) continue;
        const topBlock = world.palette[topBlockIdx];
        const target = meshById.get(topBlock);
        if (!target) continue;

        const wx = (i - halfW) + 0.5;
        const wz = (j - halfD) + 0.5;

        // Top cube (1×1×1) at integer y center = topY + 0.5
        tmpPos.set(wx, topY + 0.5, wz);
        tmpScale.set(1, 1, 1);
        tmpQuat.identity();
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        const c = counts.get(target.id)!;
        target.topMesh.setMatrixAt(c.top, tmpMatrix);
        c.top++;

        // Shaft below the top, only if h > 1. Use the block type of the lower portion's top
        // (approximate by sampling the block just below the top).
        if (h > 1) {
          const shaftBlockIdx = world.cells[idx * world.maxStackHeight + (topY - 1)];
          const shaftBlock = world.palette[shaftBlockIdx];
          const shaftTarget = meshById.get(shaftBlock) ?? target;
          const shaftH = h - 1;
          tmpPos.set(wx, shaftH / 2, wz);
          tmpScale.set(1, shaftH, 1);
          tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
          const sc = counts.get(shaftTarget.id)!;
          shaftTarget.shaftMesh.setMatrixAt(sc.shaft, tmpMatrix);
          sc.shaft++;
        }
      }
    }

    for (const m of meshes) {
      const c = counts.get(m.id)!;
      m.topMesh.count = c.top;
      m.shaftMesh.count = c.shaft;
      m.topMesh.instanceMatrix.needsUpdate = true;
      m.shaftMesh.instanceMatrix.needsUpdate = true;
    }
  }, [meshes, world, version]);

  return (
    <group ref={groupRef}>
      {meshes.map(({ id, topMesh, shaftMesh }) => (
        <group key={id}>
          <primitive object={topMesh} />
          <primitive object={shaftMesh} />
        </group>
      ))}
    </group>
  );
};

export default VoxelTerrain;
