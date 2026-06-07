import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TerrainData } from '@/lib/geotiff-loader';
import { geoToMeshPos } from './GeoFeatures';
import { PlacedItem, getItemDef } from '@/lib/map-builder-items';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  items: PlacedItem[];
}

/**
 * Renders placed Level-5 items on top of the terrain.
 * Blocks → small cubes sitting on the surface.
 * Creatures → emoji billboard floating slightly above.
 */
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
      {positioned.map(({ it, pos }) => {
        const def = getItemDef(it.type);
        const isCreature = def.kind === 'creature';
        const size = 0.07;
        const lift = isCreature ? 0.18 : size / 2;
        return (
          <group key={it.id} position={[pos[0], pos[1] + lift, pos[2]]}>
            {!isCreature && (
              <mesh castShadow>
                <boxGeometry args={[size, size, size]} />
                <meshStandardMaterial
                  color={def.color}
                  emissive={def.color}
                  emissiveIntensity={0.25}
                  roughness={0.6}
                />
              </mesh>
            )}
            <Html
              position={[0, isCreature ? 0 : size * 0.9, 0]}
              center
              distanceFactor={6}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  fontSize: isCreature ? '20px' : '14px',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
                  lineHeight: 1,
                }}
              >
                {def.emoji}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

export default MapPlacementOverlay;
