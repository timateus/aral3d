import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { buildMissions, Mission } from '@/lib/game-missions';
import { useGamepad } from '@/hooks/useGamepad';
import type { CharacterDef } from '@/components/CharacterSelect';

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

// Avatar with facing direction and character colors
function Avatar({ position, facing, bodyColor = '#f0c674', hatColor = '#8ec8e8', glowColor = '#f0c674', cheekColor = '#e8a0bf' }: {
  position: [number, number, number]; facing: number;
  bodyColor?: string; hatColor?: string; glowColor?: string; cheekColor?: string;
}) {
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
        <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={0.3} />
      </mesh>
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
        <meshStandardMaterial color={cheekColor} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.07, -0.01, 0.09]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={cheekColor} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.06, 0.1, 8]} />
        <meshStandardMaterial color={hatColor} />
      </mesh>
      <pointLight color={glowColor} intensity={0.5} distance={1} />
    </group>
  );
}

// Water pour particles effect
function WaterPourEffect({ position, active }: { position: [number, number, number]; active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const particleCount = 30;
  const positions = useMemo(() => new Float32Array(particleCount * 3), []);

  useFrame(() => {
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
      <mesh position={[0, position[1] + 0.25, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
        <meshStandardMaterial color="#ff6b6b" emissive="#ff6b6b" emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
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
  character?: CharacterDef | null;
  onAddWater?: (row: number, col: number) => void;
  orbitRef?: React.MutableRefObject<any>;
}

export interface GameModeState {
  currentMission: Mission | null;
  completedCount: number;
  totalCount: number;
  rewardMessage: string | null;
  rewardFact: string | null;
  waterPouringActive: boolean;
  requiresKhorezm: boolean;
  requiresInspector: boolean;
  inBowlWorld: boolean;
}

export default function GameMode({ terrain, exaggeration, active, character, onAddWater, orbitRef }: GameModeProps) {
  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 1, 0]);
  const [facing, setFacing] = useState(0);
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [rewardFact, setRewardFact] = useState<string | null>(null);
  const [waterPouring, setWaterPouring] = useState(false);
  const [inBowlWorld, setInBowlWorld] = useState(false);
  const keysRef = useRef<Set<string>>(new Set());
  const facingRef = useRef(0);
  const { camera } = useThree();
  const avatarPosRef = useRef<[number, number, number]>([0, 1, 0]);
  const avatarGeoRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastGeoDispatchRef = useRef(0);
  const waterCooldownRef = useRef(0);
  const initializedRef = useRef(false);
  const lastBoundsKeyRef = useRef<string | null>(null);
  const { stateRef: gpRef } = useGamepad();

  const meshToGeo = useCallback((worldX: number, worldZ: number) => {
    const b = terrain.bounds;
    if (!b) return null;
    const nx = (worldX / 10) + 0.5;
    const ny = (-worldZ / 10) + 0.5;
    return {
      lon: b.minLon + nx * (b.maxLon - b.minLon),
      lat: b.minLat + ny * (b.maxLat - b.minLat),
    };
  }, [terrain]);

  const missions = useMemo(() => active ? buildMissions(terrain) : [], [terrain, active]);


  const currentMission = useMemo(() => {
    return missions.find(m => !completedMissions.has(m.id)) || null;
  }, [missions, completedMissions]);

  const missionTargetPos = useMemo(() => {
    if (!currentMission) return null;
    return geoToMeshPos(currentMission.targetLat, currentMission.targetLon, terrain, exaggeration);
  }, [currentMission, terrain, exaggeration]);

  // Expose state for HUD
  useEffect(() => {
    if (!active) return;
    const state: GameModeState = {
      currentMission,
      completedCount: completedMissions.size,
      totalCount: missions.length,
      rewardMessage,
      rewardFact,
      waterPouringActive: waterPouring,
      requiresKhorezm: currentMission?.requiresKhorezm ?? false,
      requiresInspector: currentMission?.requiresInspector ?? false,
      inBowlWorld,
    };
    window.dispatchEvent(new CustomEvent('game-mode-state', { detail: state }));
  }, [active, currentMission, completedMissions.size, missions.length, rewardMessage, rewardFact, waterPouring, inBowlWorld]);

  // Initialize
  useEffect(() => {
    if (active && terrain.bounds && !initializedRef.current) {
      initializedRef.current = true;
      const centerLat = (terrain.bounds.minLat + terrain.bounds.maxLat) / 2;
      const centerLon = (terrain.bounds.minLon + terrain.bounds.maxLon) / 2;
      const pos = geoToMeshPos(centerLat, centerLon, terrain, exaggeration);
      setAvatarPos(pos);
      avatarPosRef.current = pos;
      
      const camPos = new THREE.Vector3(pos[0], pos[1] + 3, pos[2] + 4);
      camera.position.copy(camPos);
      camera.lookAt(pos[0], pos[1] + 0.2, pos[2]);
      
      if (orbitRef?.current) {
        orbitRef.current.target.set(pos[0], pos[1] + 0.2, pos[2]);
      }
    }
  }, [active]);

  // When terrain bounds change (recenter), reposition avatar to its geo location in new mesh
  useEffect(() => {
    if (!active || !terrain.bounds) return;
    const key = `${terrain.bounds.minLon},${terrain.bounds.minLat},${terrain.bounds.maxLon},${terrain.bounds.maxLat}`;
    if (lastBoundsKeyRef.current === key) return;
    const prev = lastBoundsKeyRef.current;
    lastBoundsKeyRef.current = key;
    if (prev === null) return; // first init handled above
    const geo = avatarGeoRef.current;
    if (!geo) return;
    const pos = geoToMeshPos(geo.lat, geo.lon, terrain, exaggeration);
    const old = avatarPosRef.current;
    const dx = pos[0] - old[0];
    const dy = pos[1] - old[1];
    const dz = pos[2] - old[2];
    avatarPosRef.current = pos;
    setAvatarPos(pos);
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
    if (orbitRef?.current) orbitRef.current.target.set(pos[0], pos[1] + 0.2, pos[2]);
  }, [active, terrain, exaggeration, camera, orbitRef]);


  // Listen for bowl world completion
  useEffect(() => {
    if (!active) return;
    const handler = () => {
      if (currentMission?.enterBowlWorld) {
        setInBowlWorld(false);
        setCompletedMissions(prev => new Set([...prev, currentMission.id]));
        setRewardMessage(currentMission.reward);
        setRewardFact(currentMission.funFact);
        setTimeout(() => { setRewardMessage(null); setRewardFact(null); }, 6000);
      }
    };
    window.addEventListener('bowl-world-complete', handler);
    return () => window.removeEventListener('bowl-world-complete', handler);
  }, [active, currentMission]);

  // Reset on deactivate
  useEffect(() => {
    if (!active) {
      initializedRef.current = false;
      setCompletedMissions(new Set());
      setRewardMessage(null);
      setRewardFact(null);
      setWaterPouring(false);
      setInBowlWorld(false);
    }
  }, [active]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);
      if (e.key === ' ') e.preventDefault();
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

  // Main loop
  useFrame((_, delta) => {
    if (!active) return;
    const keys = keysRef.current;
    const speed = 2 * delta;
    
    // Get camera forward direction projected onto XZ plane
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

    // Gamepad left stick: camera-relative movement (analog magnitude)
    const gp = gpRef.current;
    if (gp.connected) {
      const lx = gp.leftStick.x;
      const ly = gp.leftStick.y;
      if (lx || ly) {
        moveDir.addScaledVector(camForward, -ly);
        moveDir.addScaledVector(camRight, lx);
      }
    }

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
      // clamp magnitude to 1 so analog input never exceeds keyboard speed
      if (moveDir.length() > 1) moveDir.normalize();
      moveDir.multiplyScalar(speed);
    }

    // Update facing direction based on movement
    if (isMoving) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - facingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facingRef.current += diff * 0.2;
      setFacing(facingRef.current);
    }

    const [cx, , cz] = avatarPosRef.current;
    const newX = THREE.MathUtils.clamp(cx + moveDir.x, -5, 5);
    const newZ = THREE.MathUtils.clamp(cz + moveDir.z, -5, 5);
    const newY = getTerrainHeightAt(newX, newZ, terrain, exaggeration);
    const newPos: [number, number, number] = [newX, newY, newZ];
    avatarPosRef.current = newPos;
    setAvatarPos(newPos);

    // Track avatar geo position for terrain recentering
    const geo = meshToGeo(newX, newZ);
    if (geo) avatarGeoRef.current = geo;

    // Keep orbit target on avatar so mouse rotation orbits around avatar
    if (orbitRef?.current) {
      orbitRef.current.target.set(newX, newY + 0.2, newZ);
    }

    // When avatar moves, translate camera to follow (preserving user's rotation)
    if (isMoving) {
      const dx = newX - cx;
      const dz = newZ - cz;
      const dy = newY - avatarPosRef.current[1];
      camera.position.x += dx;
      camera.position.z += dz;
      camera.position.y += dy;
    }

    // Note: terrain is preloaded for the entire Central Asia bbox in game mode,
    // so no on-demand recentering is needed. The avatar is naturally clamped to
    // the mesh edges (±5), which equals the Central Asia bounds.

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
        waterCooldownRef.current = 0.15;
      }
    } else {
      waterCooldownRef.current = 0;
    }

    // Check mission completion
    if (currentMission && missionTargetPos && !inBowlWorld) {
      const dist = Math.sqrt(
        (newX - missionTargetPos[0]) ** 2 + (newZ - missionTargetPos[2]) ** 2
      );
      const isMet = currentMission.requiresWater
        ? dist < currentMission.radius && spaceHeld
        : dist < currentMission.radius;

      if (isMet) {
        if (currentMission.enterBowlWorld) {
          // Enter bowl world instead of completing immediately
          setInBowlWorld(true);
          return;
        }
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
      <Avatar
        position={avatarPos}
        facing={facing}
        bodyColor={character?.bodyColor}
        hatColor={character?.hatColor}
        glowColor={character?.glowColor}
        cheekColor={character?.cheekColor}
      />
      <WaterPourEffect position={avatarPos} active={waterPouring} />

      {/* Mission beacon */}
      {missionTargetPos && currentMission && (
        <MissionBeacon position={missionTargetPos} />
      )}
    </>
  );
}
