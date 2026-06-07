import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGamepad } from '@/hooks/useGamepad';

function WASDHandler({ enabled, orbitRef, rightStickCameraEnabled = true }: { enabled: boolean; orbitRef: React.MutableRefObject<any>; rightStickCameraEnabled?: boolean }) {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, q: false, e: false, up: false, down: false, left: false, right: false });
  const speed = 0.12;
  const { stateRef: gpRef } = useGamepad();

  useEffect(() => {
    const map = (e: KeyboardEvent): keyof typeof keys.current | null => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') return k as any;
      if (e.key === 'ArrowUp') return 'up';
      if (e.key === 'ArrowDown') return 'down';
      if (e.key === 'ArrowLeft') return 'left';
      if (e.key === 'ArrowRight') return 'right';
      return null;
    };
    const onDown = (e: KeyboardEvent) => { const k = map(e); if (k) { e.preventDefault(); (keys.current as any)[k] = true; } };
    const onUp = (e: KeyboardEvent) => { const k = map(e); if (k) (keys.current as any)[k] = false; };
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
    if (keys.current.w || keys.current.up) delta.addScaledVector(dir, speed);
    if (keys.current.s || keys.current.down) delta.addScaledVector(dir, -speed);
    if (keys.current.a || keys.current.left) delta.addScaledVector(right, -speed);
    if (keys.current.d || keys.current.right) delta.addScaledVector(right, speed);
    if (keys.current.q) delta.y -= speed;
    if (keys.current.e) delta.y += speed;

    // Gamepad: left stick = pan on XZ plane (camera-relative).
    const gp = gpRef.current;
    if (gp.connected) {
      const lx = gp.leftStick.x;
      const ly = gp.leftStick.y;
      if (lx || ly) {
        delta.addScaledVector(dir, -ly * speed);
        delta.addScaledVector(right, lx * speed);
      }

      // Controller arrows / D-pad pan the map exactly like the left stick.
      const dpadX = (gp.buttons.right ? 1 : 0) - (gp.buttons.left ? 1 : 0);
      const dpadY = (gp.buttons.down ? 1 : 0) - (gp.buttons.up ? 1 : 0);
      if (dpadX || dpadY) {
        delta.addScaledVector(dir, -dpadY * speed);
        delta.addScaledVector(right, dpadX * speed);
      }
    }

    if (delta.lengthSq() > 0) {
      camera.position.add(delta);
      window.dispatchEvent(new CustomEvent('wasd-move', { detail: { x: delta.x, y: delta.y, z: delta.z } }));
    }

    // Gamepad: outside the slider level, right stick controls camera orbit on both axes.
    // In the slider level, HUD owns the right stick and camera rotation is disabled.
    if (gp.connected && orbitRef.current) {
      const rxRaw = gp.rightStick.x;
      const ryRaw = gp.rightStick.y;
      const target: THREE.Vector3 = orbitRef.current.target;
      if (rightStickCameraEnabled && (Math.abs(rxRaw) > 0.08 || Math.abs(ryRaw) > 0.08)) {
        const offset = new THREE.Vector3().subVectors(camera.position, target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        const rotSpeed = 0.04;
        spherical.theta -= rxRaw * rotSpeed;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + ryRaw * rotSpeed, 0.12, Math.PI / 2.05);
        offset.setFromSpherical(spherical);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
      }
      const zoom = (gp.buttons.rt > 0.1 ? gp.buttons.rt : 0) - (gp.buttons.lt > 0.1 ? gp.buttons.lt : 0);
      if (zoom !== 0) {
        const offset = new THREE.Vector3().subVectors(camera.position, target);
        const factor = 1 - zoom * 0.04;
        const newLen = THREE.MathUtils.clamp(offset.length() * factor, 2, 30);
        offset.setLength(newLen);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
      }
    }
  });

  return null;
}

export default function MapControls({ enabled, orbitRef, gameModeActive, sandboxActive, rightStickCameraEnabled = true }: { enabled: boolean; orbitRef: React.MutableRefObject<any>; gameModeActive?: boolean; sandboxActive?: boolean; rightStickCameraEnabled?: boolean }) {
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
      {/* Disable WASD/gamepad handler in game mode — GameMode handles its own movement */}
      <WASDHandler enabled={enabled && !gameModeActive} orbitRef={orbitRef} rightStickCameraEnabled={rightStickCameraEnabled} />
    </>
  );
}
