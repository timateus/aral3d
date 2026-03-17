import { useRef, useState, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

export interface LibraryObject {
  id: string;
  name: string;
  imagePath: string;
  description: string;
  lat: number;
  lon: number;
}

export const LIBRARY_OBJECTS: LibraryObject[] = [
  {
    id: 'yarn-ball',
    name: 'Yarn Ball',
    imagePath: '/images/objects/yarn-ball.png',
    description: 'Traditional craft object from the Aral region',
    lat: 44.5,
    lon: 59.0,
  },
  {
    id: 'aryq',
    name: 'Aryq',
    imagePath: '/images/vocabulary/aryq.jpg',
    description: 'Traditional irrigation canal — the lifeline of Karakalpak agriculture',
    lat: 42.462,
    lon: 59.603,
  },
  {
    id: 'noahs-arc',
    name: "Noah's Arc",
    imagePath: '/images/vocabulary/keme.jpg',
    description: 'A vessel for navigating the disappearing waters — canal thinking in action',
    lat: 43.8,
    lon: 58.5,
  },
];

function geoTo3D(lat: number, lon: number, terrain: TerrainData, exaggeration: number): THREE.Vector3 {
  const { bounds, width, height, elevations } = terrain;
  const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
  const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);

  const scaleX = 10;
  const scaleZ = 10;
  const x = (nx - 0.5) * scaleX;
  const z = -(ny - 0.5) * scaleZ;

  const col = Math.min(Math.max(Math.round(nx * (width - 1)), 0), width - 1);
  const row = Math.min(Math.max(Math.round((1 - ny) * (height - 1)), 0), height - 1);
  const elev = elevations[row * width + col];
  const elevRange = terrain.maxElevation - terrain.minElevation;
  const y = ((elev - terrain.minElevation) / elevRange) * exaggeration;

  return new THREE.Vector3(x, y + 1.5, z);
}

interface ObjectCardProps {
  obj: LibraryObject;
  terrain: TerrainData;
  exaggeration: number;
  onSelect: (obj: LibraryObject) => void;
}

function ObjectCard({ obj, terrain, exaggeration, onSelect }: ObjectCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const position = useMemo(
    () => geoTo3D(obj.lat, obj.lon, terrain, exaggeration),
    [obj.lat, obj.lon, terrain, exaggeration]
  );

  const texture = useLoader(THREE.TextureLoader, obj.imagePath);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 1.2 + position.x) * 0.15;
    meshRef.current.quaternion.copy(state.camera.quaternion);
    const targetScale = hovered ? 1.3 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        onClick={(e) => { e.stopPropagation(); onSelect(obj); }}
      >
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          opacity={hovered ? 1 : 0.9}
        />
      </mesh>

      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              position.x, position.y - 1.5, position.z,
              position.x, position.y - 0.3, position.z,
            ]), 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#8ec8e8" transparent opacity={0.4} />
      </line>

      {hovered && (
        <Html position={[position.x, position.y + 1, position.z]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(13,17,23,0.9)',
            border: '1px solid rgba(142,200,232,0.4)',
            padding: '4px 10px',
            whiteSpace: 'nowrap',
            color: '#8ec8e8',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}>
            {obj.name}
          </div>
        </Html>
      )}
    </group>
  );
}

interface ObjectLibrary3DProps {
  terrain: TerrainData;
  exaggeration: number;
  onSelect: (obj: LibraryObject) => void;
}

export default function ObjectLibrary3D({ terrain, exaggeration, onSelect }: ObjectLibrary3DProps) {
  return (
    <group>
      {LIBRARY_OBJECTS.map((obj) => (
        <ObjectCard
          key={obj.id}
          obj={obj}
          terrain={terrain}
          exaggeration={exaggeration}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
