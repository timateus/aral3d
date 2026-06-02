import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { touchInput } from '@/lib/voxel/touch-input';
import { getColumnHeight, type VoxelWorld } from '@/lib/voxel/voxel-world';

interface Props {
  world: VoxelWorld;
  active: boolean;
  onBuild: () => void;
}

/**
 * Demo "autopilot" that drives the voxel character around the world,
 * picking random wander targets, occasionally mining, placing, jumping,
 * looking around, and triggering a build.
 *
 * It writes to the shared touchInput state and rotates the camera directly,
 * so VoxelPlayer's existing input pipeline does the actual movement /
 * collision / action work.
 */
const VoxelAutopilot = ({ world, active, onBuild }: Props) => {
  const { camera } = useThree();
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const lookOffset = useRef(0);
  const nextActionAt = useRef(0);
  const stuckTimer = useRef(0);
  const lastPos = useRef(new THREE.Vector3());

  // Take over input bus while active.
  useEffect(() => {
    if (active) {
      touchInput.active = true;
    } else {
      touchInput.move.x = 0;
      touchInput.move.y = 0;
      touchInput.sprint = false;
      // Don't clear .active here — actual touch device should keep it on.
      // We use a local flag check below to stop driving.
    }
  }, [active]);

  useFrame((state, dt) => {
    if (!active) return;
    const tMs = state.clock.elapsedTime * 1000;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;

    // Pick a wander target if missing or reached.
    const pickTarget = () => {
      const margin = 8;
      const x = (Math.random() - 0.5) * (world.width - margin * 2);
      const z = (Math.random() - 0.5) * (world.depth - margin * 2);
      targetRef.current = { x, z };
    };
    if (!targetRef.current) pickTarget();

    const tgt = targetRef.current!;
    const dx = tgt.x - camera.position.x;
    const dz = tgt.z - camera.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.5) {
      pickTarget();
    } else {
      // Aim camera at target (yaw), plus a slow scanning sweep so it feels alive.
      lookOffset.current += dt * 0.4;
      const sweep = Math.sin(lookOffset.current) * 0.35;
      const targetYaw = Math.atan2(-dx, -dz) + sweep;

      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      let d = targetYaw - e.y;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      e.y += d * Math.min(1, dt * 2.5);
      // Gentle pitch bob (look around)
      e.x = Math.sin(state.clock.elapsedTime * 0.7) * 0.18;
      camera.quaternion.setFromEuler(e);

      // Forward input
      touchInput.move.x = 0;
      touchInput.move.y = -0.85;
      touchInput.sprint = dist > 20;
    }

    // Detect being stuck → jump + repick target
    const moved = camera.position.distanceTo(lastPos.current);
    lastPos.current.copy(camera.position);
    if (moved < 0.01) {
      stuckTimer.current += dt;
      if (stuckTimer.current > 0.6) {
        touchInput.jumpQueued = true;
        if (stuckTimer.current > 1.5) {
          pickTarget();
          stuckTimer.current = 0;
        }
      }
    } else {
      stuckTimer.current = 0;
    }

    // Periodic random actions
    if (tMs > nextActionAt.current) {
      nextActionAt.current = tMs + 1500 + Math.random() * 2500;
      const r = Math.random();
      if (r < 0.45) touchInput.breakQueued = true;       // mine / interact with mob
      else if (r < 0.7) touchInput.placeQueued = true;    // place block
      else if (r < 0.85) touchInput.jumpQueued = true;
      else if (r < 0.95) window.dispatchEvent(new CustomEvent('voxel:interact')); // drink/eat
      else onBuild();                                     // build a structure
    }
  });

  return null;
};

export default VoxelAutopilot;
