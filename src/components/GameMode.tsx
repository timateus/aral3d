import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

interface Collectible {
  id: string;
  name: string;
  modelPath: string;
  lat: number;
  lon: number;
  collected: boolean;
}

const COLLECTIBLES: Omit<Collectible, 'collected'>[] = [
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

// Simple cute avatar — a bouncing sphere with eyes
function Avatar({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle bounce
      groupRef.current.position.y = position[1] + 0.15 + Math.sin(state.clock.elapsedTime * 4) * 0.03;
      groupRef.current.position.x = position[0];
      groupRef.current.position.z = position[2];
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#f0c674" emissive="#f0c674" emissiveIntensity={0.3} />
      </mesh>
      {/* Left eye */}
      <mesh position={[-0.04, 0.03, 0.1]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Right eye */}
      <mesh position={[0.04, 0.03, 0.1]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Blush left */}
      <mesh position={[-0.07, -0.01, 0.09]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#e8a0bf" transparent opacity={0.6} />
      </mesh>
      {/* Blush right */}
      <mesh position={[0.07, -0.01, 0.09]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#e8a0bf" transparent opacity={0.6} />
      </mesh>
      {/* Little hat */}
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.06, 0.1, 8]} />
        <meshStandardMaterial color="#8ec8e8" />
      </mesh>
      {/* Point light to glow */}
      <pointLight color="#f0c674" intensity={0.5} distance={1} />
    </group>
  );
}

function CollectibleObject({ 
  modelPath, position, collected, onCollect, name 
}: { 
  modelPath: string; position: [number, number, number]; collected: boolean; onCollect: () => void; name: string;
}) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

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
      {/* Glow ring */}
      <mesh position={[0, position[1] + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 24]} />
        <meshStandardMaterial color="#f0c674" emissive="#f0c674" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Html position={[0, position[1] + 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          fontSize: '10px',
          color: '#f0c674',
          textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
      </Html>
    </group>
  );
}

interface GameModeProps {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
}

export default function GameMode({ terrain, exaggeration, active }: GameModeProps) {
  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 1, 0]);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [showCollectMsg, setShowCollectMsg] = useState<string | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const facingRef = useRef(0); // angle in radians
  const { camera } = useThree();
  const avatarPosRef = useRef<[number, number, number]>([0, 1, 0]);

  // Compute collectible positions
  const collectiblePositions = useMemo(() => {
    return COLLECTIBLES.map(c => ({
      ...c,
      pos: geoToMeshPos(c.lat, c.lon, terrain, exaggeration),
    }));
  }, [terrain, exaggeration]);

  // Initialize avatar position at center of terrain
  useEffect(() => {
    if (active && terrain.bounds) {
      const centerLat = (terrain.bounds.minLat + terrain.bounds.maxLat) / 2;
      const centerLon = (terrain.bounds.minLon + terrain.bounds.maxLon) / 2;
      const pos = geoToMeshPos(centerLat, centerLon, terrain, exaggeration);
      setAvatarPos(pos);
      avatarPosRef.current = pos;
    }
  }, [active]);

  // Reset collected when deactivated
  useEffect(() => {
    if (!active) {
      setCollected(new Set());
      setShowCollectMsg(null);
    }
  }, [active]);

  // Keyboard listeners
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

  // Movement + camera follow + collection detection
  useFrame((_, delta) => {
    if (!active) return;
    const keys = keysRef.current;
    const speed = 2 * delta;
    let dx = 0, dz = 0;

    if (keys.has('w') || keys.has('arrowup')) dz -= speed;
    if (keys.has('s') || keys.has('arrowdown')) dz += speed;
    if (keys.has('a') || keys.has('arrowleft')) dx -= speed;
    if (keys.has('d') || keys.has('arrowright')) dx += speed;

    if (dx !== 0 || dz !== 0) {
      facingRef.current = Math.atan2(dx, dz);
    }

    const [cx, , cz] = avatarPosRef.current;
    const newX = THREE.MathUtils.clamp(cx + dx, -5, 5);
    const newZ = THREE.MathUtils.clamp(cz + dz, -5, 5);
    const newY = getTerrainHeightAt(newX, newZ, terrain, exaggeration);
    
    const newPos: [number, number, number] = [newX, newY, newZ];
    avatarPosRef.current = newPos;
    setAvatarPos(newPos);

    // Camera follow — overhead third-person
    const camOffset = new THREE.Vector3(0, 3, 4);
    const targetCamPos = new THREE.Vector3(newX + camOffset.x, newY + camOffset.y, newZ + camOffset.z);
    camera.position.lerp(targetCamPos, 0.05);
    camera.lookAt(newX, newY + 0.2, newZ);

    // Check collection
    collectiblePositions.forEach(c => {
      if (collected.has(c.id)) return;
      const dist = Math.sqrt(
        (newX - c.pos[0]) ** 2 + (newZ - c.pos[2]) ** 2
      );
      if (dist < 0.3) {
        setCollected(prev => new Set([...prev, c.id]));
        setShowCollectMsg(c.name);
        setTimeout(() => setShowCollectMsg(null), 2000);
      }
    });
  });

  if (!active) return null;

  return (
    <>
      <Avatar position={avatarPos} />
      
      {collectiblePositions.map(c => (
        <CollectibleObject
          key={c.id}
          modelPath={c.modelPath}
          position={c.pos}
          collected={collected.has(c.id)}
          onCollect={() => {}}
          name={c.name}
        />
      ))}

      {/* HUD */}
      <Html position={[avatarPos[0], avatarPos[1] + 2.5, avatarPos[2]]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          {showCollectMsg && (
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#f0c674',
              textShadow: '0 2px 8px rgba(0,0,0,0.9)',
              animation: 'fadeInUp 0.3s ease-out',
            }}>
              ✨ {showCollectMsg} collected!
            </div>
          )}
        </div>
      </Html>
    </>
  );
}
