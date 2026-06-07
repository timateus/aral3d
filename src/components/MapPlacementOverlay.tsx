import { useMemo } from 'react';
import { TerrainData } from '@/lib/geotiff-loader';
import { geoToMeshPos } from './GeoFeatures';
import { PlacedItem, getItemDef, MapBuilderItemId } from '@/lib/map-builder-items';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  items: PlacedItem[];
}

/** Tiny 3D model per item type — pure geometry, no emoji / no HTML. */
function ItemMesh({ type }: { type: MapBuilderItemId }) {
  const def = getItemDef(type);
  const color = def.color;

  switch (type) {
    case 'water':
      return (
        <mesh castShadow position={[0, 0.04, 0]}>
          <boxGeometry args={[0.18, 0.08, 0.18]} />
          <meshStandardMaterial color={color} transparent opacity={0.8} roughness={0.25} metalness={0.1} emissive={color} emissiveIntensity={0.18} />
        </mesh>
      );
    case 'salt':
      return (
        <mesh castShadow position={[0, 0.07, 0]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.4} emissive={'#ffffff'} emissiveIntensity={0.05} />
        </mesh>
      );
    case 'sand':
      return (
        <mesh castShadow position={[0, 0.06, 0]}>
          <boxGeometry args={[0.16, 0.1, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      );
    case 'saxaul':
      return (
        <group>
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.018, 0.025, 0.12, 6]} />
            <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'reed':
      return (
        <group>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh key={i} castShadow position={[Math.cos(a) * 0.03, 0.1, Math.sin(a) * 0.03]}>
                <cylinderGeometry args={[0.006, 0.006, 0.2, 5]} />
                <meshStandardMaterial color={color} roughness={0.85} />
              </mesh>
            );
          })}
        </group>
      );
    case 'tree':
      return (
        <group>
          <mesh castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.022, 0.03, 0.16, 6]} />
            <meshStandardMaterial color="#5a3a1f" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.24, 0]}>
            <coneGeometry args={[0.13, 0.26, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'yurt':
      return (
        <group>
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.12, 16]} />
            <meshStandardMaterial color={'#e8e3d6'} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.17, 0]}>
            <coneGeometry args={[0.15, 0.1, 16]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        </group>
      );
    case 'saiga':
      return (
        <group>
          {/* body */}
          <mesh castShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[0.22, 0.1, 0.1]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* head with snout */}
          <mesh castShadow position={[0.13, 0.13, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.19, 0.11, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.06, 6]} rotation={[0, 0, Math.PI / 2]} />
            <meshStandardMaterial color={'#8a6a45'} roughness={0.85} />
          </mesh>
          {/* legs */}
          {[[-0.07, 0.02], [0.07, 0.02], [-0.07, -0.04], [0.07, -0.04]].map(([dx, dz], i) => (
            <mesh key={i} castShadow position={[dx, 0.04, dz]}>
              <boxGeometry args={[0.02, 0.08, 0.02]} />
              <meshStandardMaterial color={'#7a5a3a'} roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case 'camel':
      return (
        <group>
          <mesh castShadow position={[0, 0.13, 0]}>
            <boxGeometry args={[0.28, 0.12, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* hump */}
          <mesh castShadow position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {/* neck + head */}
          <mesh castShadow position={[0.16, 0.22, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.022, 0.03, 0.12, 6]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.22, 0.27, 0]}>
            <boxGeometry args={[0.07, 0.05, 0.05]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          {[[-0.1, 0.04], [0.1, 0.04], [-0.1, -0.04], [0.1, -0.04]].map(([dx, dz], i) => (
            <mesh key={i} castShadow position={[dx, 0.06, dz]}>
              <boxGeometry args={[0.025, 0.12, 0.025]} />
              <meshStandardMaterial color={'#8a6a3a'} roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case 'fish':
      return (
        <group rotation={[0, 0, 0]}>
          <mesh castShadow position={[0, 0.1, 0]} scale={[1.4, 0.6, 0.6]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} emissive={color} emissiveIntensity={0.15} />
          </mesh>
          {/* tail */}
          <mesh castShadow position={[-0.12, 0.1, 0]} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.05, 0.08, 4]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow position={[0, 0.06, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      );
  }
}

const MapPlacementOverlay = ({ terrain, exaggeration, items }: Props) => {
  const bounds = terrain.bounds;
  const w = terrain.width;
  const h = terrain.height;
  const meshWidth = 10;
  const meshHeight = 10 * (h / w);

  const positioned = useMemo(() => {
    if (!bounds) return [];
    return items
      .map((it) => {
        const pos = geoToMeshPos(it.lat, it.lon, bounds, terrain, exaggeration, meshWidth, meshHeight);
        if (!pos) return null;
        return { it, pos };
      })
      .filter(Boolean) as { it: PlacedItem; pos: [number, number, number] }[];
  }, [items, terrain, exaggeration, bounds, meshWidth, meshHeight]);

  return (
    <group>
      {positioned.map(({ it, pos }) => (
        <group key={it.id} position={pos}>
          <ItemMesh type={it.type} />
        </group>
      ))}
    </group>
  );
};

export default MapPlacementOverlay;
