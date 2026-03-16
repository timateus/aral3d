import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function WASDHandler({ enabled }: { enabled: boolean }) {
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
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useFrame(() => {
    if (!enabled) return;
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
      window.dispatchEvent(new CustomEvent('wasd-move', { detail: { x: delta.x, y: delta.y, z: delta.z } }));
    }
  });

  return null;
}

export default function MapControls({ enabled, orbitRef, gameModeActive }: { enabled: boolean; orbitRef: React.MutableRefObject<any>; gameModeActive?: boolean }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const { x, y, z } = (e as CustomEvent).detail;
      if (orbitRef.current) {
        orbitRef.current.target.x += x;
        orbitRef.current.target.y += y;
        orbitRef.current.target.z += z;
      }
    };
    window.addEventListener('wasd-move', handler);
    return () => window.removeEventListener('wasd-move', handler);
  }, [orbitRef]);

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        enabled={enabled}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={!gameModeActive}
        enableKeys={false}
        mouseButtons={{
          LEFT: gameModeActive ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: gameModeActive ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
      {/* Disable WASD handler in game mode — GameMode handles its own movement */}
      <WASDHandler enabled={enabled && !gameModeActive} />
    </>
  );
}
