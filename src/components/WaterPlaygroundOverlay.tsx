import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

interface HydraulicDevice {
  id: string;
  name: string;
  nameLocal: string;
  description: string;
  image: string;
  position: [number, number, number];
  type: 'sluice' | 'trough' | 'pipe' | 'chigir' | 'shaduf';
}

const DEVICES: HydraulicDevice[] = [
  {
    id: 'sluice',
    name: 'Sluice Gate',
    nameLocal: 'Bosaga',
    description: 'Wooden gates controlling water flow between canal branches — the traffic lights of ancient irrigation.',
    image: '/images/hydraulic/sluice-gate.png',
    position: [-1.5, 0, -0.5],
    type: 'sluice',
  },
  {
    id: 'trough',
    name: 'Water Trough',
    nameLocal: 'Novdan',
    description: 'Hollowed-log channels carrying water over uneven terrain — ancient aqueduct technology.',
    image: '/images/hydraulic/water-trough.png',
    position: [1.8, 0, 0.8],
    type: 'trough',
  },
  {
    id: 'pipe',
    name: 'Clay Pipe',
    nameLocal: 'Kubur',
    description: 'Terracotta pipes buried underground to transport water without evaporation loss.',
    image: '/images/hydraulic/clay-pipe.png',
    position: [0, 0, 2.2],
    type: 'pipe',
  },
  {
    id: 'chigir',
    name: 'Water Wheel',
    nameLocal: 'Chigir',
    description: 'A noria-style water wheel lifting water from canals to higher fields using clay pots.',
    image: '/images/hydraulic/chigir-wheel.png',
    position: [-2.2, 0, 1.5],
    type: 'chigir',
  },
  {
    id: 'shaduf',
    name: 'Shaduf',
    nameLocal: 'Shaduf',
    description: 'A counterweighted lever for lifting water from wells — one of humanity's oldest machines.',
    image: '/images/hydraulic/shaduf.png',
    position: [2.5, 0, -1.0],
    type: 'shaduf',
  },
];

// Sluice Gate — two vertical posts with horizontal planks
function SluiceModel({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  return (
    <group ref={groupRef} position={position}>
      {/* Posts */}
      <mesh position={[-0.12, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position={[0.12, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      {/* Cross beam */}
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
        <meshStandardMaterial color="#6B4E0A" roughness={0.85} />
      </mesh>
      {/* Gate planks */}
      {[0.1, 0.2, 0.3].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.2, 0.025, 0.04]} />
          <meshStandardMaterial color="#A0784C" roughness={0.95} />
        </mesh>
      ))}
      {/* Water below */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshStandardMaterial color="#4ECDC4" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// Water Trough — hollowed log
function TroughModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Trough body */}
      <mesh position={[0, 0.15, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.1]} />
        <meshStandardMaterial color="#8B6914" roughness={0.95} />
      </mesh>
      {/* Supports */}
      <mesh position={[-0.15, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.15, 5]} />
        <meshStandardMaterial color="#6B4E0A" roughness={0.9} />
      </mesh>
      <mesh position={[0.15, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.15, 5]} />
        <meshStandardMaterial color="#6B4E0A" roughness={0.9} />
      </mesh>
      {/* Water inside */}
      <mesh position={[0, 0.18, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.45, 0.02, 0.06]} />
        <meshStandardMaterial color="#4ECDC4" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// Clay Pipe — cylindrical segments
function PipeModel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 0.12, 0.24].map((x, i) => (
        <mesh key={i} position={[x - 0.12, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#C67B4F" roughness={0.8} />
        </mesh>
      ))}
      {/* Joint rings */}
      {[0.06, 0.18].map((x, i) => (
        <mesh key={i} position={[x - 0.12, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.045, 0.008, 8, 12]} />
          <meshStandardMaterial color="#A0603C" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// Chigir Water Wheel
function ChigirModel({ position }: { position: [number, number, number] }) {
  const wheelRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z = state.clock.elapsedTime * 0.4;
    }
  });

  return (
    <group position={position}>
      {/* Axle supports */}
      <mesh position={[-0.15, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position={[0.15, 0.25, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      {/* Spinning wheel */}
      <group ref={wheelRef} position={[0, 0.35, 0]}>
        {/* Rim */}
        <mesh>
          <torusGeometry args={[0.18, 0.015, 8, 16]} />
          <meshStandardMaterial color="#A0784C" roughness={0.85} />
        </mesh>
        {/* Spokes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]}>
            <boxGeometry args={[0.005, 0.34, 0.005]} />
            <meshStandardMaterial color="#6B4E0A" roughness={0.9} />
          </mesh>
        ))}
        {/* Clay pots */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.18, Math.sin(angle) * 0.18, 0.02]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color="#D4A574" roughness={0.7} />
            </mesh>
          );
        })}
      </group>
      {/* Water pool */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 16]} />
        <meshStandardMaterial color="#4ECDC4" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// Shaduf — counterweight lever
function ShadufModel({ position }: { position: [number, number, number] }) {
  const leverRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (leverRef.current) {
      leverRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.25;
    }
  });

  return (
    <group position={position}>
      {/* Main post */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.6, 6]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      {/* Cross support */}
      <mesh position={[0, 0.2, 0.08]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.4, 5]} />
        <meshStandardMaterial color="#6B4E0A" roughness={0.9} />
      </mesh>
      {/* Lever arm */}
      <group ref={leverRef} position={[0, 0.55, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.012, 0.6, 5]} />
          <meshStandardMaterial color="#A0784C" roughness={0.85} />
        </mesh>
        {/* Bucket */}
        <mesh position={[0.28, -0.05, 0]}>
          <cylinderGeometry args={[0.03, 0.025, 0.06, 8]} />
          <meshStandardMaterial color="#C67B4F" roughness={0.8} />
        </mesh>
        {/* Counterweight */}
        <mesh position={[-0.25, 0, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#666" roughness={0.7} />
        </mesh>
      </group>
      {/* Well base */}
      <mesh position={[0.2, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.2]} />
        <meshStandardMaterial color="#B8956A" roughness={0.95} />
      </mesh>
    </group>
  );
}

// Reed cluster
function ReedCluster({ position, count = 5 }: { position: [number, number, number]; count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.rotation.x = Math.sin(state.clock.elapsedTime * 1.5 + i) * 0.05;
        child.rotation.z = Math.cos(state.clock.elapsedTime * 1.2 + i * 0.7) * 0.03;
      });
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 0.1, 0.12 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1]}>
          <cylinderGeometry args={[0.003, 0.005, 0.25 + Math.random() * 0.1, 4]} />
          <meshStandardMaterial color="#7A8B3D" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Small pond
function Pond({ position, size = 0.3 }: { position: [number, number, number]; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshStandardMaterial).opacity = 0.45 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[size, 20]} />
        <meshStandardMaterial color="#4ECDC4" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Muddy rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[size, size + 0.05, 20]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>
    </group>
  );
}

// Canal channel
function CanalChannel({ start, end, width = 0.06 }: { start: [number, number, number]; end: [number, number, number]; width?: number }) {
  const length = Math.sqrt((end[0] - start[0]) ** 2 + (end[2] - start[2]) ** 2);
  const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
  const midX = (start[0] + end[0]) / 2;
  const midZ = (start[2] + end[2]) / 2;

  return (
    <group position={[midX, 0.015, midZ]} rotation={[0, -angle, 0]}>
      {/* Water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[length, width * 0.6]} />
        <meshStandardMaterial color="#4ECDC4" transparent opacity={0.5} />
      </mesh>
      {/* Banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>
    </group>
  );
}

interface WaterPlaygroundOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
}

export default function WaterPlaygroundOverlay({ terrain, exaggeration, active }: WaterPlaygroundOverlayProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  if (!active) return null;

  const { width, height, minElevation, maxElevation } = terrain;
  const elevRange = maxElevation - minElevation || 1;
  const maxH = 10 * (exaggeration / 100);
  const meshW = 10;
  const meshH = 10 * (height / width);

  return (
    <group>
      {/* Ground platform — reed-mud base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, maxH * 0.01, 0]}>
        <planeGeometry args={[meshW * 1.1, meshH * 1.1]} />
        <meshStandardMaterial color="#A89070" roughness={1} />
      </mesh>

      {/* Western plateau — reed-mud platform */}
      <mesh position={[-meshW * 0.35, maxH * 0.08, 0]}>
        <boxGeometry args={[meshW * 0.25, maxH * 0.12, meshH * 0.7]} />
        <meshStandardMaterial color="#9B8B6F" roughness={0.95} />
      </mesh>
      {/* Reed mat texture on top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-meshW * 0.35, maxH * 0.14 + 0.01, 0]}>
        <planeGeometry args={[meshW * 0.25, meshH * 0.7]} />
        <meshStandardMaterial color="#7A8B3D" roughness={1} transparent opacity={0.4} />
      </mesh>

      {/* Ponds */}
      <Pond position={[0, maxH * 0.01, 0]} size={0.5} />
      <Pond position={[-1.2, maxH * 0.01, -0.8]} size={0.35} />
      <Pond position={[1.0, maxH * 0.01, 1.2]} size={0.4} />
      <Pond position={[-0.5, maxH * 0.01, 1.5]} size={0.25} />

      {/* Canal network connecting ponds */}
      <CanalChannel start={[0, 0, 0]} end={[-1.2, 0, -0.8]} />
      <CanalChannel start={[0, 0, 0]} end={[1.0, 0, 1.2]} />
      <CanalChannel start={[-1.2, 0, -0.8]} end={[-0.5, 0, 1.5]} />
      <CanalChannel start={[1.0, 0, 1.2]} end={[-0.5, 0, 1.5]} />
      <CanalChannel start={[-1.2, 0, -0.8]} end={[-2.5, 0, 0]} />
      <CanalChannel start={[0, 0, 0]} end={[2.5, 0, -1.0]} />

      {/* Reed clusters around ponds */}
      {[[-0.5, 0, 0.3], [0.4, 0, -0.3], [-1.5, 0, -0.5], [1.3, 0, 1.5], [-0.8, 0, 1.8],
        [-2.0, 0, 0.5], [2.0, 0, -0.5], [0.2, 0, -1.5], [-1.8, 0, 1.2]
      ].map((pos, i) => (
        <ReedCluster key={i} position={pos as [number, number, number]} count={4 + Math.floor(Math.random() * 4)} />
      ))}

      {/* Hydraulic devices */}
      <SluiceModel position={DEVICES[0].position} />
      <TroughModel position={DEVICES[1].position} />
      <PipeModel position={DEVICES[2].position} />
      <ChigirModel position={DEVICES[3].position} />
      <ShadufModel position={DEVICES[4].position} />

      {/* Labels for each device */}
      {DEVICES.map((d) => (
        <Html
          key={d.id}
          position={[d.position[0], 0.7, d.position[2]]}
          center
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={() => setSelectedDevice(selectedDevice === d.id ? null : d.id)}
        >
          <div
            onClick={() => setSelectedDevice(selectedDevice === d.id ? null : d.id)}
            style={{
              background: selectedDevice === d.id ? 'rgba(78,205,196,0.95)' : 'rgba(13,17,23,0.88)',
              border: `1px solid ${selectedDevice === d.id ? 'rgba(78,205,196,0.8)' : 'rgba(142,200,232,0.3)'}`,
              padding: '4px 10px',
              color: selectedDevice === d.id ? '#0d1117' : '#8ec8e8',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {d.nameLocal}
          </div>
        </Html>
      ))}

      {/* Detail card for selected device */}
      {selectedDevice && (() => {
        const d = DEVICES.find(dev => dev.id === selectedDevice)!;
        return (
          <Html position={[d.position[0], 1.1, d.position[2]]} center style={{ pointerEvents: 'auto' }}>
            <div style={{
              background: 'rgba(13,17,23,0.95)',
              border: '1px solid rgba(78,205,196,0.5)',
              padding: '12px',
              maxWidth: '220px',
              color: '#e0e0e0',
              fontSize: '11px',
              lineHeight: 1.5,
            }}>
              <img
                src={d.image}
                alt={d.name}
                style={{
                  width: '100%',
                  height: '80px',
                  objectFit: 'contain',
                  marginBottom: '8px',
                  background: '#f5f0e8',
                  borderRadius: '2px',
                }}
              />
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4ECDC4', marginBottom: '2px' }}>
                {d.nameLocal}
              </div>
              <div style={{ fontSize: '10px', color: '#8ec8e8', marginBottom: '6px', fontStyle: 'italic' }}>
                {d.name}
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#ccc' }}>
                {d.description}
              </p>
            </div>
          </Html>
        );
      })()}

      {/* Warm playground lighting */}
      <pointLight position={[0, 3, 0]} intensity={0.6} color="#FFE4B5" distance={12} />
      <pointLight position={[-2, 1, 1]} intensity={0.3} color="#4ECDC4" distance={5} />
      <pointLight position={[2, 1, -1]} intensity={0.3} color="#4ECDC4" distance={5} />
    </group>
  );
}
