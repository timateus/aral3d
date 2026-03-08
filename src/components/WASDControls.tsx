import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function WASDControls({ enabled = true }: { enabled?: boolean }) {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, q: false, e: false });
  const speed = 0.12;

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) (keys.current as any)[k] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) (keys.current as any)[k] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  useFrame(() => {
    if (!enabled) return;
    // Get camera's forward direction projected onto XZ plane
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

    const delta = new THREE.Vector3();
    if (keys.current.w) delta.addScaledVector(dir, speed);
    if (keys.current.s) delta.addScaledVector(dir, -speed);
    if (keys.current.a) delta.addScaledVector(right, -speed);
    if (keys.current.d) delta.addScaledVector(right, speed);
    if (keys.current.q) delta.y -= speed;
    if (keys.current.e) delta.y += speed;

    if (delta.lengthSq() > 0) {
      camera.position.add(delta);
      // Also move OrbitControls target so panning stays in sync
      // We dispatch a custom event that TerrainViewer listens for
      window.dispatchEvent(new CustomEvent('wasd-move', { detail: { x: delta.x, y: delta.y, z: delta.z } }));
    }
  });

  return null;
}
