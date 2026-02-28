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
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();

    if (keys.current.w) camera.position.addScaledVector(dir, speed);
    if (keys.current.s) camera.position.addScaledVector(dir, -speed);
    if (keys.current.a) camera.position.addScaledVector(right, -speed);
    if (keys.current.d) camera.position.addScaledVector(right, speed);
    if (keys.current.q) camera.position.y -= speed;
    if (keys.current.e) camera.position.y += speed;
  });

  return null;
}
