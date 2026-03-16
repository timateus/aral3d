import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { buildMissions, Mission } from '@/lib/game-missions';

interface Collectible {
  id: string;
  name: string;
  modelPath: string;
  lat: number;
  lon: number;
}

const COLLECTIBLES: Collectible[] = [
  { id: 'soap-1', name: 'Khorezm Soap', modelPath: '/models/soap-khorezm.glb', lat: 41.55, lon: 60.63 },
  { id: 'pumpkin-1', name: 'Suw Qabaq', modelPath: '/models/pumpkin.glb', lat: 42.46, lon: 59.6 },
  { id: 'soap-2', name: 'Khorezm Soap', modelPath: '/models/soap-khorezm.glb', lat: 43.0, lon: 59.0 },
  { id: 'pumpkin-2', name: 'Suw Qabaq', modelPath: '/models/pumpkin.glb', lat: 42.0, lon: 60.0 },
  { id: 'soap-3', name: 'Khorezm Soap', modelPath: '/models/soap-khorezm.glb', lat: 43.5, lon: 58.5 },
];

function geoToMeshPos(
  lat: number, lon: number,
  terrain: TerrainData, exaggeration: number,
  meshWidth = 10, meshHeight = 10,
): [number, number, number] {
  const bounds = terrain.bounds;
  if (!bounds) return [0, 0, 0];
  const { minLon, maxLon, minLat, maxLat } = bounds;
  const nx = (lon - minLon) / (maxLon - minLon);
  const ny = (lat - minLat) / (maxLat - minLat);
  const x = (nx - 0.5) * meshWidth;
  const planeY = (ny - 0.5) * meshHeight;

  let zHeight = 0;
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    const pixelX = Math.floor(nx * (terrain.width - 1));
    const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
    const idx = pixelY * terrain.width + pixelX;
    let elev = terrain.elevations[idx] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const normalized = (elev - terrain.minElevation) / elevRange;
    const maxMeshHeight = 10 * (exaggeration / 100);
    zHeight = normalized * maxMeshHeight;
  }
  return [x, zHeight, -planeY];
}

function getTerrainHeightAt(
  worldX: number, worldZ: number,
  terrain: TerrainData, exaggeration: number,
  meshWidth = 10, meshHeight = 10,
): number {
  const bounds = terrain.bounds;
  if (!bounds) return 0;
  const nx = (worldX / meshWidth) + 0.5;
  const ny = (-worldZ / meshHeight) + 0.5;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;
  const pixelX = Math.floor(nx * (terrain.width - 1));
  const pixelY = Math.floor((1 - ny) * (terrain.height - 1));
  const idx = pixelY * terrain.width + pixelX;
  let elev = terrain.elevations[idx] || terrain.minElevation;
  if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
  const elevRange = terrain.maxElevation - terrain.minElevation || 1;
  const normalized = (elev - terrain.minElevation) / elevRange;
  const maxMeshHeight = 10 * (exaggeration / 100);
  return normalized * maxMeshHeight;
}

/** World pos → terrain pixel row/col */
function worldToPixel(
  worldX: number, worldZ: number,
  terrain: TerrainData,
  meshWidth = 10, meshHeight = 10,
): { row: number; col: number } | null {
  const bounds = terrain.bounds;
  if (!bounds) return null;
  const nx = (worldX / meshWidth) + 0.5;
  const ny = (-worldZ / meshHeight) + 0.5;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  const col = Math.floor(nx * (terrain.width - 1));
  const row = Math.floor((1 - ny) * (terrain.height - 1));
  return { row, col };
}

// Avatar with facing direction
function Avatar({ position, facing }: { position: [number, number, number]; facing: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1] + 0.15 + Math.sin(state.clock.elapsedTime * 4) * 0.03, position[2]);
      groupRef.current.rotation.y = facing;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#f0c674" emissive="#f0c674" emissiveIntensity={0.3} />
      </mesh>
      {/* Eyes face +Z local, so facing rotation orients them */}
      <mesh position={[-0.04, 0.03, 0.1]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[0.04, 0.03, 0.1]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh position={[-0.07, -0.01, 0.09]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#e8a0bf" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.07, -0.01, 0.09]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#e8a0bf" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.06, 0.1, 8]} />
        <meshStandardMaterial color="#8ec8e8" />
      </mesh>
      <pointLight color="#f0c674" intensity={0.5} distance={1} />
    </group>
  );
}

// Water pour particles effect
function WaterPourEffect({ position, active }: { position: [number, number, number]; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const particleCount = 30;
  const positions = useMemo(() => new Float32Array(particleCount * 3), []);

  useFrame((state) => {
    if (!ref.current || !active) {
      if (ref.current) ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = position[0] + (Math.random() - 0.5) * 0.3;
      arr[i * 3 + 1] = position[1] + Math.random() * 0.4;
      arr[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.3;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#4fc3f7" size={0.03} transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function CollectibleObject({ modelPath, position, collected, name }: {
  modelPath: string; position: [number, number, number]; collected: boolean; name: string;
}) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current && !collected) {
      ref.current.rotation.y = state.clock.elapsedTime * 1.2;
      ref.current.position.y = position[1] + 0.2 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  if (collected) return null;

  return (
    <group position={[position[0], 0, position[2]]}>
      <group ref={ref} scale={[0.8, 0.8, 0.8]}>
        <primitive object={scene.clone()} />
      </group>
      <mesh position={[0, position[1] + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 24]} />
        <meshStandardMaterial color="#f0c674" emissive="#f0c674" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, position[1] + 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: '10px', color: '#f0c674', textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>{name}</div>
      </Html>
    </group>
  );
}

// Mission target beacon
function MissionBeacon({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      ref.current.rotation.y = state.clock.elapsedTime * 1.5;
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={1} />
      </mesh>
      {/* Beacon pillar */}
      <mesh position={[0, position[1] + 0.25, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
      {/* Ground ring */}
      <mesh position={[0, position[1] + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.28, 24]} />
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={0.6} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#ff6b6b" intensity={0.4} distance={1.5} />
    </group>
  );
}

export interface GameModeProps {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
  onAddWater?: (row: number, col: number) => void;
}

export interface GameModeState {
  currentMission: Mission | null;
  completedCount: number;
  totalCount: number;
  rewardMessage: string | null;
  rewardFact: string | null;
  collectMessage: string | null;
  waterPouringActive: boolean;
}

export default function GameMode({ terrain, exaggeration, active, onAddWater }: GameModeProps) {
  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 1, 0]);
  const [facing, setFacing] = useState(0);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rewardFact, setRewardFact] = useState<string | null>(null);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [waterPouring, setWaterPouring] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const facingRef = useRef(0);
  const { camera } = useThree();
  const avatarPosRef = useRef<[number, number, number]>([0, 1, 0]);
  const waterCooldownRef = useRef(0);

  // Build missions from terrain
  const missions = useMemo(() => active ? buildMissions(terrain) : [], [terrain, active]);

  const currentMission = useMemo(() => {
    return missions.find(m => !completedMissions.has(m.id)) || null;
  }, [missions, completedMissions]);

  const missionTargetPos = useMemo(() => {
    if (!currentMission) return null;
    return geoToMeshPos(currentMission.targetLat, currentMission.targetLon, terrain, exaggeration);
  }, [currentMission, terrain, exaggeration]);

  const collectiblePositions = useMemo(() => {
    return COLLECTIBLES.map(c => ({
      ...c,
      pos: geoToMeshPos(c.lat, c.lon, terrain, exaggeration),
    }));
  }, [terrain, exaggeration]);

  // Expose state for HUD (via custom event)
  useEffect(() => {
    if (!active) return;
    const state: GameModeState = {
      currentMission,
      completedCount: completedMissions.size,
      totalCount: missions.length,
      rewardMessage,
      rewardFact,
      collectMessage: collectMessage,
      waterPouringActive: waterPouring,
    };
    window.dispatchEvent(new CustomEvent('game-mode-state', { detail: state }));
  }, [active, currentMission, completedMissions.size, missions.length, rewardMessage, collectMessage, waterPouring]);

  // Initialize
  useEffect(() => {
    if (active && terrain.bounds) {
      const centerLat = (terrain.bounds.minLat + terrain.bounds.maxLat) / 2;
      const centerLon = (terrain.bounds.minLon + terrain.bounds.maxLon) / 2;
      const pos = geoToMeshPos(centerLat, centerLon, terrain, exaggeration);
      setAvatarPos(pos);
      avatarPosRef.current = pos;
    }
  }, [active]);

  // Reset on deactivate
  useEffect(() => {
    if (!active) {
      setCollected(new Set());
      setCompletedMissions(new Set());
      setCollectMessage(null);
      setRewardMessage(null);
      setRewardFact(null);
      setWaterPouring(false);
    }
  }, [active]);

  // Keyboard
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

  // Main loop
  useFrame((_, delta) => {
    if (!active) return;
    const keys = keysRef.current;
    const speed = 2 * delta;
    let dx = 0, dz = 0;

    if (keys.has('w') || keys.has('arrowup')) dz -= speed;
    if (keys.has('s') || keys.has('arrowdown')) dz += speed;
    if (keys.has('a') || keys.has('arrowleft')) dx -= speed;
    if (keys.has('d') || keys.has('arrowright')) dx += speed;

    // Update facing direction (smooth)
    if (dx !== 0 || dz !== 0) {
      const targetAngle = Math.atan2(dx, dz);
      // Smooth rotation
      let diff = targetAngle - facingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facingRef.current += diff * 0.2;
      setFacing(facingRef.current);
    }

    const [cx, , cz] = avatarPosRef.current;
    const newX = THREE.MathUtils.clamp(cx + dx, -5, 5);
    const newZ = THREE.MathUtils.clamp(cz + dz, -5, 5);
    const newY = getTerrainHeightAt(newX, newZ, terrain, exaggeration);
    const newPos: [number, number, number] = [newX, newY, newZ];
    avatarPosRef.current = newPos;
    setAvatarPos(newPos);

    // Camera follow
    const camOffset = new THREE.Vector3(0, 3, 4);
    const targetCamPos = new THREE.Vector3(newX + camOffset.x, newY + camOffset.y, newZ + camOffset.z);
    camera.position.lerp(targetCamPos, 0.05);
    camera.lookAt(newX, newY + 0.2, newZ);

    // Water pouring (SPACE key)
    const spaceHeld = keys.has(' ');
    setWaterPouring(spaceHeld);
    if (spaceHeld && onAddWater) {
      waterCooldownRef.current -= delta;
      if (waterCooldownRef.current <= 0) {
        const pixel = worldToPixel(newX, newZ, terrain);
        if (pixel) {
          onAddWater(pixel.row, pixel.col);
        }
        waterCooldownRef.current = 0.15; // Pour every 150ms
      }
    } else {
      waterCooldownRef.current = 0;
    }

    // Check collectibles
    collectiblePositions.forEach(c => {
      if (collected.has(c.id)) return;
      const dist = Math.sqrt((newX - c.pos[0]) ** 2 + (newZ - c.pos[2]) ** 2);
      if (dist < 0.3) {
        setCollected(prev => new Set([...prev, c.id]));
        setCollectMessage(c.name);
        setTimeout(() => setCollectMessage(null), 2000);
      }
    });

    // Check mission completion
    if (currentMission && missionTargetPos) {
      const dist = Math.sqrt(
        (newX - missionTargetPos[0]) ** 2 + (newZ - missionTargetPos[2]) ** 2
      );
      // For water missions, also require space to have been pressed
      const isMet = currentMission.requiresWater
        ? dist < currentMission.radius && spaceHeld
        : dist < currentMission.radius;

      if (isMet) {
        setCompletedMissions(prev => new Set([...prev, currentMission.id]));
        setRewardMessage(currentMission.reward);
        setRewardFact(currentMission.funFact);
        setTimeout(() => { setRewardMessage(null); setRewardFact(null); }, 6000);
      }
    }
  });

  if (!active) return null;

  return (
    <>
      <Avatar position={avatarPos} facing={facing} />
      <WaterPourEffect position={avatarPos} active={waterPouring} />

      {/* Mission beacon */}
      {missionTargetPos && currentMission && (
        <MissionBeacon position={missionTargetPos} />
      )}

      {/* Collectibles */}
      {collectiblePositions.map(c => (
        <CollectibleObject
          key={c.id}
          modelPath={c.modelPath}
          position={c.pos}
          collected={collected.has(c.id)}
          name={c.name}
        />
      ))}
    </>
  );
}
