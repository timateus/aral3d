import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

function MiniAvatar({ position, facing }: { position: [number, number, number]; facing: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1] + 0.05 + Math.sin(state.clock.elapsedTime * 4) * 0.01, position[2]);
      groupRef.current.rotation.y = facing;
    }
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <coneGeometry args={[0.02, 0.03, 6]} />
        <meshStandardMaterial color="#8ec8e8" />
      </mesh>
      <pointLight color="#38bdf8" intensity={0.3} distance={0.5} />
    </group>
  );
}

function AryqBeacon({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + 0.15 + Math.sin(state.clock.elapsedTime * 2.5) * 0.05;
      ref.current.rotation.y = state.clock.elapsedTime * 2;
    }
  });
  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.025, 0]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1} />
      </mesh>
      <pointLight color="#38bdf8" intensity={0.2} distance={0.5} />
    </group>
  );
}

interface AryqWorldProps {
  active: boolean;
  onComplete: () => void;
  orbitRef?: React.MutableRefObject<any>;
}

export default function AryqWorld({ active, onComplete, orbitRef }: AryqWorldProps) {
  const { scene } = useGLTF('/models/aryq.glb');
  const { camera } = useThree();
  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 0.02, 1.5]);
  const [facing, setFacing] = useState(0);
  const [completed, setCompleted] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const facingRef = useRef(0);
  const avatarPosRef = useRef<[number, number, number]>([0, 0.02, 1.5]);
  const initializedRef = useRef(false);
  const raycaster = useRef(new THREE.Raycaster());
  const modelRef = useRef<THREE.Group>(null);

  const targetPos: [number, number, number] = [0, 0.1, 0];

  useEffect(() => {
    if (active && !initializedRef.current) {
      initializedRef.current = true;
      const pos: [number, number, number] = [0, 0.02, 1.5];
      setAvatarPos(pos);
      avatarPosRef.current = pos;
      camera.position.set(0, 2, 3.5);
      camera.lookAt(0, 0, 0);
      if (orbitRef?.current) {
        orbitRef.current.target.set(0, 0.02, 1.5);
      }
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      initializedRef.current = false;
      setCompleted(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      keysRef.current.clear();
    };
  }, [active]);

  useFrame((_, delta) => {
    if (!active || completed) return;
    const keys = keysRef.current;
    const speed = 0.4 * delta;

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    let moveDir = new THREE.Vector3(0, 0, 0);
    if (keys.has('w') || keys.has('arrowup')) moveDir.add(camForward);
    if (keys.has('s') || keys.has('arrowdown')) moveDir.sub(camForward);
    if (keys.has('a') || keys.has('arrowleft')) moveDir.sub(camRight);
    if (keys.has('d') || keys.has('arrowright')) moveDir.add(camRight);

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) moveDir.normalize().multiplyScalar(speed);

    if (isMoving) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - facingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facingRef.current += diff * 0.2;
      setFacing(facingRef.current);
    }

    const [cx, , cz] = avatarPosRef.current;
    const newX = THREE.MathUtils.clamp(cx + moveDir.x, -2, 2);
    const newZ = THREE.MathUtils.clamp(cz + moveDir.z, -2, 2);

    // Raycast down onto the aryq model to find surface height
    let newY = 0.02;
    if (modelRef.current) {
      raycaster.current.set(new THREE.Vector3(newX, 5, newZ), new THREE.Vector3(0, -1, 0));
      const hits = raycaster.current.intersectObject(modelRef.current, true);
      if (hits.length > 0) {
        newY = hits[0].point.y + 0.02;
      }
    }

    const newPos: [number, number, number] = [newX, newY, newZ];
    avatarPosRef.current = newPos;
    setAvatarPos(newPos);

    if (orbitRef?.current) {
      orbitRef.current.target.set(newX, newY + 0.05, newZ);
    }

    if (isMoving) {
      const dx = newX - cx;
      const dz = newZ - cz;
      camera.position.x += dx;
      camera.position.z += dz;
    }

    const dist = Math.sqrt((newX - targetPos[0]) ** 2 + (newZ - targetPos[2]) ** 2);
    if (dist < 0.2) {
      setCompleted(true);
      setTimeout(() => onComplete(), 4000);
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* Aryq model */}
      <group ref={modelRef}>
        <primitive object={scene} scale={[1, 1, 1]} position={[0, 0, 0]} />
      </group>

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 2]} intensity={1.2} color="#e8f4ff" />
      <pointLight position={[0, 1, 0]} intensity={0.4} color="#38bdf8" distance={3} />

      <MiniAvatar position={avatarPos} facing={facing} />
      {!completed && <AryqBeacon position={targetPos} />}

      {completed && (
        <Html center position={[0, 1, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,0.95)',
            border: '1px solid rgba(56,189,248,0.5)',
            padding: '14px 24px',
            color: '#38bdf8',
            fontSize: '14px',
            fontWeight: 600,
            textAlign: 'center',
            maxWidth: '300px',
          }}>
            <p style={{ fontSize: '18px', marginBottom: '8px' }}>💧 Aryq explored!</p>
            <p style={{ fontSize: '11px', color: '#ccc', fontWeight: 400, lineHeight: 1.5 }}>
              An aryq is a traditional irrigation canal — the lifeline of agriculture in Karakalpakstan. These channels carry water from rivers to fields, sustaining communities across the arid landscape. Returning to the map...
            </p>
          </div>
        </Html>
      )}

      {!completed && (
        <Html center position={[0, 1.5, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,0.85)',
            border: '1px solid rgba(56,189,248,0.3)',
            padding: '6px 14px',
            color: '#38bdf8',
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}>
            💧 Walk along the aryq to explore it
          </div>
        </Html>
      )}
    </group>
  );
}
