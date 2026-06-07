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
  const isFire = type === 'fire';
  const isSmoke = type === 'smoke';
  const isOil = type === 'oil';
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const grpRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (isFire && matRef.current) {
      matRef.current.emissiveIntensity = 1.4 + Math.sin(t * 20) * 0.6;
    }
    if (isLava && matRef.current) {
      matRef.current.emissiveIntensity = 0.9 + Math.sin(t * 6) * 0.3;
    }
    if (isFire && grpRef.current) {
      grpRef.current.scale.y = 1 + Math.sin(t * 14) * 0.15;
    }
    if (isSmoke && grpRef.current) {
      grpRef.current.position.y = (CUBE / 2) + Math.sin(t * 2) * 0.03;
    }
  });
  return (
    <group ref={grpRef} position={[0, CUBE / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CUBE, CUBE, CUBE]} />
        <meshStandardMaterial
          ref={matRef}
          map={map}
          color={def.color}
          roughness={isWater || isOil ? 0.25 : isFire || isSmoke ? 0.95 : 0.85}
          metalness={isWater ? 0.15 : isOil ? 0.35 : 0}
          transparent={isWater || isSmoke || isFire}
          opacity={isWater ? 0.82 : isSmoke ? 0.55 : isFire ? 0.9 : 1}
          emissive={isLava ? '#ff3300' : isFire ? '#ff5500' : isWater ? def.color : '#000000'}
          emissiveIntensity={isLava ? 0.9 : isFire ? 1.6 : isWater ? 0.15 : 0}
        />
      </mesh>
      {isFire && (
        <pointLight color="#ff7a22" intensity={1.5} distance={0.6} decay={2} position={[0, CUBE * 0.6, 0]} />
      )}
    </group>
  );
}

// ---------- Flower (pixel cube + petals) ----------
function Flower() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 1.2) * 0.25;
  });
  const stem = '#4caf50';
  const petal = ['#ff7ab8', '#ffd166', '#f25f5c', '#a8dadc'][Math.floor(Math.random() * 4)];
  return (
    <group ref={ref} position={[0, CUBE / 2, 0]}>
      <mesh castShadow><boxGeometry args={[CUBE * 0.18, CUBE * 0.9, CUBE * 0.18]} /><meshStandardMaterial color={stem} /></mesh>
      <mesh castShadow position={[0, CUBE * 0.55, 0]}>
        <boxGeometry args={[CUBE * 0.55, CUBE * 0.25, CUBE * 0.55]} />
        <meshStandardMaterial color={petal} emissive={petal} emissiveIntensity={0.3} />
      </mesh>
      <mesh castShadow position={[0, CUBE * 0.55, 0]}>
        <boxGeometry args={[CUBE * 0.2, CUBE * 0.27, CUBE * 0.2]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.5} />
      </mesh>
    </group>
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
              : it.type === 'flower'
                ? <Flower />
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
