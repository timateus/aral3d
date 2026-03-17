import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Mini avatar for the bowl world
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
        <meshStandardMaterial color="#f0c674" emissive="#f0c674" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <coneGeometry args={[0.02, 0.03, 6]} />
        <meshStandardMaterial color="#8ec8e8" />
      </mesh>
      <pointLight color="#f0c674" intensity={0.3} distance={0.5} />
    </group>
  );
}

// Target beacon in bowl world
function BowlBeacon({ position }: { position: [number, number, number] }) {
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
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={1} />
      </mesh>
      <pointLight color="#ff6b6b" intensity={0.2} distance={0.5} />
    </group>
  );
}

interface BowlWorldProps {
  active: boolean;
  onComplete: () => void;
  orbitRef?: React.MutableRefObject<any>;
}

export default function BowlWorld({ active, onComplete, orbitRef }: BowlWorldProps) {
  const { scene } = useGLTF('/models/bowls.glb');
  const { camera } = useThree();
  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 0.1, 0.5]);
  const [facing, setFacing] = useState(0);
  const [completed, setCompleted] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const facingRef = useRef(0);
  const avatarPosRef = useRef<[number, number, number]>([0, 0.1, 0.5]);
  const initializedRef = useRef(false);

  // Target position — center of the bowls
  const targetPos: [number, number, number] = [0, 0.1, 0];

  // Compute bounding box for the model
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return box;
  }, [scene]);

  // Initialize camera
  useEffect(() => {
    if (active && !initializedRef.current) {
      initializedRef.current = true;
      const pos: [number, number, number] = [0, 0.1, 0.5];
      setAvatarPos(pos);
      avatarPosRef.current = pos;
      camera.position.set(0, 0.5, 1);
      camera.lookAt(0, 0.1, 0);
      if (orbitRef?.current) {
        orbitRef.current.target.set(0, 0.1, 0.5);
      }
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      initializedRef.current = false;
      setCompleted(false);
    }
  }, [active]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
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
    const speed = 0.3 * delta;

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
    const newX = THREE.MathUtils.clamp(cx + moveDir.x, -1, 1);
    const newZ = THREE.MathUtils.clamp(cz + moveDir.z, -1, 1);
    const newY = 0.1;
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

    // Check if reached target
    const dist = Math.sqrt((newX - targetPos[0]) ** 2 + (newZ - targetPos[2]) ** 2);
    if (dist < 0.15) {
      setCompleted(true);
      setTimeout(() => onComplete(), 3000);
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial color="#2a1f14" roughness={0.9} />
      </mesh>

      {/* Bowls model */}
      <primitive object={scene} scale={[0.5, 0.5, 0.5]} position={[0, 0, 0]} />

      {/* Warm lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[1, 2, 1]} intensity={1} color="#ffeedd" />
      <pointLight position={[0, 0.5, 0]} intensity={0.5} color="#ff9944" distance={2} />

      <MiniAvatar position={avatarPos} facing={facing} />

      {!completed && <BowlBeacon position={targetPos} />}

      {/* Completion message */}
      {completed && (
        <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,0.95)',
            border: '1px solid rgba(142,200,232,0.5)',
            padding: '12px 20px',
            color: '#8ec8e8',
            fontSize: '14px',
            fontWeight: 600,
            textAlign: 'center',
            maxWidth: '280px',
          }}>
            <p style={{ fontSize: '18px', marginBottom: '8px' }}>🏺 Bowls discovered!</p>
            <p style={{ fontSize: '11px', color: '#ccc', fontWeight: 400, lineHeight: 1.5 }}>
              These ceramic bowls carry geometric patterns inspired by water and earth — a living link to the Khorezm civilization. Returning to the map...
            </p>
          </div>
        </Html>
      )}

      {/* HUD instruction */}
      {!completed && (
        <Html center position={[0, 0.8, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,0.85)',
            border: '1px solid rgba(142,200,232,0.3)',
            padding: '6px 14px',
            color: '#8ec8e8',
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}>
            🏺 Walk to the bowls to examine them
          </div>
        </Html>
      )}
    </group>
  );
}
