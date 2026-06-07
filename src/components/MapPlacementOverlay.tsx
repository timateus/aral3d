import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { geoToMeshPos } from './GeoFeatures';
import { PlacedItem, getItemDef, MapBuilderItemId } from '@/lib/map-builder-items';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  items: PlacedItem[];
}

const CUBE = 0.06; // small minecraft-style voxel

// ---------- Procedural pixel textures (one per material) ----------
const textureCache = new Map<MapBuilderItemId, THREE.CanvasTexture>();
function makeTexture(type: MapBuilderItemId, baseColor: string): THREE.CanvasTexture {
  const cached = textureCache.get(type);
  if (cached) return cached;
  const size = 16;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const base = new THREE.Color(baseColor);
  const rand = () => Math.random();

  // Type-specific noise pattern
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let shade = 0;
      switch (type) {
        case 'water':
          shade = Math.sin((x + y) * 0.8) * 0.06 + (rand() - 0.5) * 0.04; break;
        case 'salt':
          shade = (rand() < 0.15 ? 0.15 : 0) + (rand() - 0.5) * 0.05; break;
        case 'sand':
          shade = (rand() - 0.5) * 0.18; break;
        case 'saxaul':
        case 'tree':
        case 'reed':
          shade = (rand() - 0.5) * 0.22; break;
        case 'yurt':
          shade = (y % 4 === 0 ? -0.1 : 0) + (rand() - 0.5) * 0.05; break;
        default:
          shade = (rand() - 0.5) * 0.1;
      }
      const col = base.clone().offsetHSL(0, 0, shade);
      ctx.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(type, tex);
  return tex;
}

// ---------- Block cube (material) ----------
function BlockCube({ type }: { type: MapBuilderItemId }) {
  const def = getItemDef(type);
  const map = useMemo(() => makeTexture(type, def.color), [type, def.color]);
  const isWater = type === 'water';
  return (
    <mesh castShadow receiveShadow position={[0, CUBE / 2, 0]}>
      <boxGeometry args={[CUBE, CUBE, CUBE]} />
      <meshStandardMaterial
        map={map}
        color={def.color}
        roughness={isWater ? 0.25 : 0.85}
        metalness={isWater ? 0.15 : 0}
        transparent={isWater}
        opacity={isWater ? 0.82 : 1}
        emissive={isWater ? def.color : '#000000'}
        emissiveIntensity={isWater ? 0.15 : 0}
      />
    </mesh>
  );
}

// ---------- Creature cubes (Minecraft mobs) ----------
function CreatureBody({ type }: { type: MapBuilderItemId }) {
  const def = getItemDef(type);
  const c = def.color;
  const dark = '#3a2a1a';
  if (type === 'fish') {
    return (
      <group>
        <mesh castShadow><boxGeometry args={[0.08, 0.04, 0.04]} /><meshStandardMaterial color={c} /></mesh>
        <mesh castShadow position={[-0.06, 0, 0]}><boxGeometry args={[0.03, 0.05, 0.02]} /><meshStandardMaterial color={c} /></mesh>
      </group>
    );
  }
  if (type === 'saiga') {
    return (
      <group>
        <mesh castShadow position={[0, 0.04, 0]}><boxGeometry args={[0.1, 0.05, 0.05]} /><meshStandardMaterial color={c} /></mesh>
        <mesh castShadow position={[0.06, 0.06, 0]}><boxGeometry args={[0.04, 0.04, 0.04]} /><meshStandardMaterial color={c} /></mesh>
        <mesh castShadow position={[0.09, 0.05, 0]}><boxGeometry args={[0.03, 0.025, 0.025]} /><meshStandardMaterial color={dark} /></mesh>
        {[[-0.035, 0.02], [0.035, 0.02], [-0.035, -0.02], [0.035, -0.02]].map(([dx, dz], i) => (
          <mesh key={i} castShadow position={[dx, 0.01, dz]}>
            <boxGeometry args={[0.018, 0.04, 0.018]} /><meshStandardMaterial color={dark} />
          </mesh>
        ))}
      </group>
    );
  }
  // camel
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]}><boxGeometry args={[0.13, 0.06, 0.06]} /><meshStandardMaterial color={c} /></mesh>
      <mesh castShadow position={[0, 0.105, 0]}><boxGeometry args={[0.06, 0.04, 0.05]} /><meshStandardMaterial color={c} /></mesh>
      <mesh castShadow position={[0.08, 0.1, 0]}><boxGeometry args={[0.025, 0.06, 0.03]} /><meshStandardMaterial color={c} /></mesh>
      <mesh castShadow position={[0.1, 0.13, 0]}><boxGeometry args={[0.04, 0.03, 0.035]} /><meshStandardMaterial color={c} /></mesh>
      {[[-0.05, 0.02], [0.05, 0.02], [-0.05, -0.02], [0.05, -0.02]].map(([dx, dz], i) => (
        <mesh key={i} castShadow position={[dx, 0.02, dz]}>
          <boxGeometry args={[0.02, 0.06, 0.02]} /><meshStandardMaterial color={dark} />
        </mesh>
      ))}
    </group>
  );
}

function Creature({ type }: { type: MapBuilderItemId }) {
  const ref = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 1000, []);
  const radius = type === 'fish' ? 0.25 : 0.35;
  const speed = type === 'fish' ? 1.2 : 0.5;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + seed;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t * 0.9) * radius;
    ref.current.position.x = x;
    ref.current.position.z = z;
    if (type === 'fish') {
      ref.current.position.y = 0.08 + Math.sin(t * 2) * 0.04;
    } else {
      // tiny bob from "walking"
      ref.current.position.y = Math.abs(Math.sin(t * 4)) * 0.015;
    }
    // Face direction of travel
    const yaw = Math.atan2(-Math.sin(t * 0.9) * 0.9 * radius, -Math.sin(t) * radius);
    ref.current.rotation.y = yaw;
  });
  return (
    <group ref={ref}>
      <CreatureBody type={type} />
    </group>
  );
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
      {positioned.map(({ it, pos }) => {
        const def = getItemDef(it.type);
        const stack = it.stack ?? 0;
        const yOffset = def.kind === 'block' ? stack * CUBE : 0;
        return (
          <group key={it.id} position={[pos[0], pos[1] + yOffset, pos[2]]}>
            {def.kind === 'block' ? <BlockCube type={it.type} /> : <Creature type={it.type} />}
          </group>
        );
      })}
    </group>
  );
};

export default MapPlacementOverlay;
