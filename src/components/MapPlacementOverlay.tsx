import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { geoToMeshPos } from './GeoFeatures';
import { PlacedItem, getItemDef, MapBuilderItemId, CUBE_SIZE } from '@/lib/map-builder-items';

interface Props {
  terrain: TerrainData;
  exaggeration: number;
  items: PlacedItem[];
}

const CUBE = CUBE_SIZE;

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
        case 'reed':
        case 'plant':
          shade = (rand() - 0.5) * 0.22; break;
        case 'seed':
          shade = (rand() < 0.2 ? -0.2 : 0) + (rand() - 0.5) * 0.06; break;
        case 'oil':
          shade = (rand() - 0.5) * 0.08 - 0.05; break;
        case 'lava':
          shade = Math.sin((x * 0.7 + y * 0.3) * 1.4) * 0.18 + (rand() - 0.5) * 0.1; break;
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

// ---------- Block cube ----------
function BlockCube({ type }: { type: MapBuilderItemId }) {
  const def = getItemDef(type);
  const map = useMemo(() => makeTexture(type, def.color), [type, def.color]);
  const isWater = type === 'water';
  const isLava = type === 'lava';
  const isOil = type === 'oil';
  return (
    <mesh castShadow receiveShadow position={[0, CUBE / 2, 0]}>
      <boxGeometry args={[CUBE, CUBE, CUBE]} />
      <meshStandardMaterial
        map={map}
        color={def.color}
        roughness={isWater || isOil ? 0.25 : 0.85}
        metalness={isWater ? 0.15 : isOil ? 0.35 : 0}
        transparent={isWater}
        opacity={isWater ? 0.82 : 1}
        emissive={isLava ? '#ff3300' : isWater ? def.color : '#000000'}
        emissiveIntensity={isLava ? 0.9 : isWater ? 0.15 : 0}
      />
    </mesh>
  );
}

// ---------- Oil pump derrick ----------
function OilPump() {
  const armRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (armRef.current) armRef.current.rotation.x = Math.sin(clock.elapsedTime * 2.4) * 0.5;
  });
  const dark = '#1d1d1d';
  const metal = '#444';
  return (
    <group position={[0, 0, 0]}>
      {/* base */}
      <mesh castShadow receiveShadow position={[0, CUBE * 0.5, 0]}>
        <boxGeometry args={[CUBE * 1.4, CUBE, CUBE * 1.4]} />
        <meshStandardMaterial color={dark} roughness={0.7} />
      </mesh>
      {/* tower */}
      <mesh castShadow position={[0, CUBE * 1.6, 0]}>
        <boxGeometry args={[CUBE * 0.5, CUBE * 1.2, CUBE * 0.5]} />
        <meshStandardMaterial color={metal} />
      </mesh>
      {/* rocking arm */}
      <group ref={armRef} position={[0, CUBE * 2.0, 0]}>
        <mesh castShadow position={[CUBE * 0.6, 0, 0]}>
          <boxGeometry args={[CUBE * 2.0, CUBE * 0.2, CUBE * 0.2]} />
          <meshStandardMaterial color={metal} />
        </mesh>
        <mesh castShadow position={[CUBE * 1.4, -CUBE * 0.4, 0]}>
          <boxGeometry args={[CUBE * 0.25, CUBE * 0.8, CUBE * 0.25]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Creature cubes ----------
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
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t * 0.9) * radius;
    ref.current.position.y = type === 'fish'
      ? 0.08 + Math.sin(t * 2) * 0.04
      : Math.abs(Math.sin(t * 4)) * 0.015;
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
            {it.type === 'oilpump'
              ? <OilPump />
              : def.kind === 'block'
                ? <BlockCube type={it.type} />
                : <Creature type={it.type} />}
          </group>
        );
      })}
    </group>
  );
};

export default MapPlacementOverlay;
