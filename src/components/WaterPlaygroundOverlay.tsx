import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';

/* ── Tiny helpers ─────────────────────────────────────────── */

const SAND = '#C4A97D';
const MUD = '#8B7355';
const WOOD = '#A0784C';
const WOOD_DARK = '#6B4E0A';
const WOOD_LIGHT = '#C6A97A';
const REED_GREEN = '#7A8B3D';
const WATER = '#5BA8A0';
const WATER_DEEP = '#3D8B83';
const ROCK = '#888';
const ROCK_DARK = '#666';
const LILY_GREEN = '#4A7A3A';

/* ── Rock scatter ─────────────────────────────────────────── */
function Rock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <mesh position={position} scale={scale} rotation={[Math.random(), Math.random(), 0]}>
      <dodecahedronGeometry args={[0.06, 0]} />
      <meshStandardMaterial color={Math.random() > 0.5 ? ROCK : ROCK_DARK} roughness={0.95} flatShading />
    </mesh>
  );
}

/* ── Lily pad ─────────────────────────────────────────────── */
function LilyPad({ position, size = 0.08 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, Math.random() * Math.PI * 2]}>
        <circleGeometry args={[size, 12]} />
        <meshStandardMaterial color={LILY_GREEN} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Wooden boardwalk segment ─────────────────────────────── */
function Boardwalk({ start, end, width = 0.12 }: { start: [number, number, number]; end: [number, number, number]; width?: number }) {
  const dx = end[0] - start[0], dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const mx = (start[0] + end[0]) / 2, mz = (start[2] + end[2]) / 2;
  const plankCount = Math.max(3, Math.floor(length / 0.08));

  return (
    <group position={[mx, 0.04, mz]} rotation={[0, -angle, 0]}>
      {Array.from({ length: plankCount }).map((_, i) => {
        const x = (i / (plankCount - 1) - 0.5) * length;
        return (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.06, 0.015, width]} />
            <meshStandardMaterial color={i % 3 === 0 ? WOOD_LIGHT : WOOD} roughness={0.9} />
          </mesh>
        );
      })}
      {/* Rails */}
      <mesh position={[0, 0.01, width / 2 + 0.01]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, length, 4]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.01, -width / 2 - 0.01]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, length, 4]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
      </mesh>
    </group>
  );
}

/* ── Canal channel (earthy) ───────────────────────────────── */
function Canal({ start, end, width = 0.35 }: { start: [number, number, number]; end: [number, number, number]; width?: number }) {
  const dx = end[0] - start[0], dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const mx = (start[0] + end[0]) / 2, mz = (start[2] + end[2]) / 2;

  return (
    <group position={[mx, 0.015, mz]} rotation={[0, -angle, 0]}>
      {/* Banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[length, width + 0.08]} />
        <meshStandardMaterial color={MUD} roughness={1} />
      </mesh>
      {/* Water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[length, width * 0.7]} />
        <meshStandardMaterial color="#4A9A6A" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

/* ── Waterfall ────────────────────────────────────────────── */
function Waterfall({ position, height = 0.3 }: { position: [number, number, number]; height?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.5 + Math.sin(s.clock.elapsedTime * 6) * 0.15;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, -height / 2, 0]}>
        <boxGeometry args={[0.12, height, 0.04]} />
        <meshStandardMaterial color="#8FDDDA" transparent opacity={0.55} />
      </mesh>
      {/* Splash pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height + 0.01, 0.05]}>
        <circleGeometry args={[0.15, 12]} />
        <meshStandardMaterial color={WATER} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ── Reed cluster ─────────────────────────────────────────── */
function Reeds({ position, count = 6 }: { position: [number, number, number]; count?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.children.forEach((c, i) => {
        c.rotation.x = Math.sin(s.clock.elapsedTime * 1.2 + i) * 0.04;
        c.rotation.z = Math.cos(s.clock.elapsedTime + i * 0.5) * 0.03;
      });
    }
  });
  return (
    <group ref={ref} position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 0.15, 0.15 + Math.random() * 0.1, (Math.random() - 0.5) * 0.15]}>
          <cylinderGeometry args={[0.004, 0.007, 0.3 + Math.random() * 0.15, 4]} />
          <meshStandardMaterial color={REED_GREEN} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Pond ─────────────────────────────────────────────────── */
function Pond({ position, size = 0.4 }: { position: [number, number, number]; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshStandardMaterial).opacity = 0.5 + Math.sin(s.clock.elapsedTime * 1.5) * 0.08;
    }
  });
  return (
    <group position={position}>
      {/* Muddy rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[size + 0.08, 20]} />
        <meshStandardMaterial color={MUD} roughness={1} />
      </mesh>
      {/* Water */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[size, 20]} />
        <meshStandardMaterial color={WATER_DEEP} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── SLUICE GATE (large) ──────────────────────────────────── */
function SluiceGate({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={2.5}>
      {/* Posts */}
      {[-0.15, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.6, 6]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
        </mesh>
      ))}
      {/* Cross beam */}
      <mesh position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.36, 6]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      {/* Gate planks */}
      {[0.12, 0.22, 0.32, 0.42].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.26, 0.035, 0.05]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.95} />
        </mesh>
      ))}
      {/* Platform */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
    </group>
  );
}

/* ── WATER TROUGH (large) ─────────────────────────────────── */
function WaterTrough({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} scale={2.5}>
      <mesh position={[0, 0.18, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.07, 0.12]} />
        <meshStandardMaterial color={WOOD} roughness={0.95} />
      </mesh>
      {/* Supports */}
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.09, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.18, 5]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
        </mesh>
      ))}
      {/* Water inside */}
      <mesh position={[0, 0.21, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.55, 0.025, 0.08]} />
        <meshStandardMaterial color={WATER} transparent opacity={0.6} />
      </mesh>
      {/* Platform */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
    </group>
  );
}

/* ── CHIGIR WATER WHEEL (large, animated) ─────────────────── */
function ChigirWheel({ position }: { position: [number, number, number] }) {
  const wheelRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (wheelRef.current) wheelRef.current.rotation.z = s.clock.elapsedTime * 0.35;
  });

  return (
    <group position={position} scale={2.5}>
      {/* Axle supports */}
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.6, 6]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
        </mesh>
      ))}
      {/* Spinning wheel */}
      <group ref={wheelRef} position={[0, 0.42, 0]}>
        <mesh>
          <torusGeometry args={[0.22, 0.018, 8, 20]} />
          <meshStandardMaterial color={WOOD} roughness={0.85} />
        </mesh>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 5]}>
            <boxGeometry args={[0.006, 0.42, 0.006]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
          </mesh>
        ))}
        {/* Clay pots on rim */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i * Math.PI * 2) / 10;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.025]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#D4A574" roughness={0.7} />
            </mesh>
          );
        })}
      </group>
      {/* Platform */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
    </group>
  );
}

/* ── SHADUF (large, animated) ─────────────────────────────── */
function Shaduf({ position }: { position: [number, number, number] }) {
  const leverRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (leverRef.current) leverRef.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.7) * 0.3;
  });

  return (
    <group position={position} scale={2.5}>
      {/* Main post */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.7, 6]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.9} />
      </mesh>
      {/* Brace */}
      <mesh position={[0, 0.22, 0.1]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.45, 5]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
      {/* Lever arm */}
      <group ref={leverRef} position={[0, 0.65, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.015, 0.7, 5]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.85} />
        </mesh>
        {/* Bucket */}
        <mesh position={[0.32, -0.06, 0]}>
          <cylinderGeometry args={[0.04, 0.03, 0.08, 8]} />
          <meshStandardMaterial color="#C67B4F" roughness={0.8} />
        </mesh>
        {/* Counterweight */}
        <mesh position={[-0.3, 0, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={ROCK_DARK} roughness={0.8} />
        </mesh>
      </group>
      {/* Well base */}
      <mesh position={[0.25, 0.07, 0]}>
        <boxGeometry args={[0.22, 0.14, 0.22]} />
        <meshStandardMaterial color={MUD} roughness={0.95} />
      </mesh>
      {/* Platform */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
    </group>
  );
}

/* ── Device positions ─────────────────────────────────────── */
const SLUICE_POS: [number, number, number] = [-1.8, 0, -0.8];
const TROUGH_POS: [number, number, number] = [2.0, 0, 1.0];
const CHIGIR_POS: [number, number, number] = [-2.0, 0, 1.8];
const SHADUF_POS: [number, number, number] = [2.2, 0, -1.2];

/* ── Main component ───────────────────────────────────────── */
interface WaterPlaygroundOverlayProps {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
}

export default function WaterPlaygroundOverlay({ terrain, exaggeration, active }: WaterPlaygroundOverlayProps) {
  if (!active) return null;

  const { width, height } = terrain;
  const maxH = 10 * (exaggeration / 100);
  const meshW = 10;
  const meshH = 10 * (height / width);

  return (
    <group>
      {/* Ground — sandy/earthy base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, maxH * 0.01, 0]}>
        <planeGeometry args={[meshW * 1.15, meshH * 1.15]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>

      {/* Western plateau — reed-mud fortress (like the reference image) */}
      <group position={[-meshW * 0.35, 0, 0]}>
        {/* Main structure */}
        <mesh position={[0, maxH * 0.1, 0]}>
          <cylinderGeometry args={[meshW * 0.12, meshW * 0.14, maxH * 0.18, 12]} />
          <meshStandardMaterial color={MUD} roughness={0.95} />
        </mesh>
        {/* Reed mat wrapping */}
        <mesh position={[0, maxH * 0.1, 0]}>
          <cylinderGeometry args={[meshW * 0.125, meshW * 0.145, maxH * 0.19, 12]} />
          <meshStandardMaterial color={REED_GREEN} roughness={1} transparent opacity={0.35} wireframe />
        </mesh>
        {/* Top surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, maxH * 0.19, 0]}>
          <circleGeometry args={[meshW * 0.12, 12]} />
          <meshStandardMaterial color="#9B8B6F" roughness={0.95} />
        </mesh>
        {/* Stairway */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[meshW * 0.1 + i * 0.12, maxH * 0.15 - i * maxH * 0.03, 0.15]}>
            <boxGeometry args={[0.12, 0.03, 0.15]} />
            <meshStandardMaterial color={WOOD_LIGHT} roughness={0.9} />
          </mesh>
        ))}
        {/* Waterfall from fortress */}
        <Waterfall position={[meshW * 0.12, maxH * 0.18, 0.3]} height={maxH * 0.15} />
        <Waterfall position={[meshW * 0.1, maxH * 0.18, -0.4]} height={maxH * 0.12} />
      </group>

      {/* ── Ponds ── */}
      <Pond position={[0, maxH * 0.01, 0]} size={0.6} />
      <Pond position={[-1.0, maxH * 0.01, -1.0]} size={0.4} />
      <Pond position={[1.2, maxH * 0.01, 1.5]} size={0.5} />
      <Pond position={[-0.8, maxH * 0.01, 2.0]} size={0.35} />
      <Pond position={[2.5, maxH * 0.01, 0]} size={0.45} />
      <Pond position={[-1.5, maxH * 0.01, 1.0]} size={0.3} />

      {/* ── Canals connecting devices ── */}
      <Canal start={SLUICE_POS} end={[0, 0, 0]} />
      <Canal start={[0, 0, 0]} end={TROUGH_POS} />
      <Canal start={[0, 0, 0]} end={CHIGIR_POS} />
      <Canal start={[0, 0, 0]} end={SHADUF_POS} />
      <Canal start={SLUICE_POS} end={CHIGIR_POS} />
      <Canal start={TROUGH_POS} end={SHADUF_POS} />
      <Canal start={CHIGIR_POS} end={[-0.8, 0, 2.0]} />
      <Canal start={TROUGH_POS} end={[1.2, 0, 1.5]} />
      <Canal start={SHADUF_POS} end={[2.5, 0, 0]} />
      <Canal start={SLUICE_POS} end={[-1.0, 0, -1.0]} />
      {/* Canal from fortress */}
      <Canal start={[-meshW * 0.22, 0, 0.3]} end={[-1.5, 0, 1.0]} />
      <Canal start={[-meshW * 0.22, 0, -0.4]} end={SLUICE_POS} />

      {/* ── Boardwalks connecting devices ── */}
      <Boardwalk start={SLUICE_POS} end={[0, 0, 0]} />
      <Boardwalk start={[0, 0, 0]} end={TROUGH_POS} />
      <Boardwalk start={[0, 0, 0]} end={CHIGIR_POS} />
      <Boardwalk start={[0, 0, 0]} end={SHADUF_POS} />
      <Boardwalk start={SLUICE_POS} end={CHIGIR_POS} />

      {/* ── Hydraulic devices (no labels) ── */}
      <SluiceGate position={SLUICE_POS} />
      <WaterTrough position={TROUGH_POS} />
      <ChigirWheel position={CHIGIR_POS} />
      <Shaduf position={SHADUF_POS} />

      {/* ── Reeds ── */}
      {[
        [-0.6, 0, 0.4], [0.5, 0, -0.4], [-1.4, 0, -0.6], [1.5, 0, 1.8],
        [-1.0, 0, 2.3], [-2.2, 0, 0.6], [2.4, 0, -0.6], [0.3, 0, -1.6],
        [-1.6, 0, 1.5], [0.8, 0, 0.6], [-0.3, 0, 1.2], [1.8, 0, 0.2],
        [2.8, 0, 0.5], [-2.5, 0, -0.3], [0, 0, 2.5],
      ].map((p, i) => (
        <Reeds key={i} position={p as [number, number, number]} count={5 + Math.floor(Math.random() * 5)} />
      ))}

      {/* ── Lily pads ── */}
      {[
        [0.15, 0.02, 0.2], [-0.2, 0.02, -0.15], [0.3, 0.02, -0.1],
        [1.0, 0.02, 1.3], [1.35, 0.02, 1.6], [-0.7, 0.02, 1.9],
        [-0.9, 0.02, -0.85], [2.3, 0.02, 0.15], [2.6, 0.02, -0.1],
        [-1.3, 0.02, 0.9], [0.5, 0.02, 0.3], [-0.1, 0.02, 0.5],
      ].map((p, i) => (
        <LilyPad key={i} position={p as [number, number, number]} size={0.06 + Math.random() * 0.06} />
      ))}

      {/* ── Rocks scattered ── */}
      {[
        [-1.6, 0.03, -0.3], [1.7, 0.03, 0.5], [0.6, 0.03, -1.2],
        [-0.4, 0.03, 1.6], [2.0, 0.03, -0.8], [-2.3, 0.03, 1.3],
        [0.9, 0.03, 2.0], [-0.2, 0.03, -1.8], [2.7, 0.03, 0.8],
        [-1.9, 0.03, -1.0], [0.1, 0.03, 1.8], [1.4, 0.03, -0.5],
      ].map((p, i) => (
        <Rock key={i} position={p as [number, number, number]} scale={0.6 + Math.random() * 0.8} />
      ))}

      {/* ── Warm ambient lighting ── */}
      <pointLight position={[0, 4, 0]} intensity={0.7} color="#FFE4B5" distance={15} />
      <pointLight position={[-3, 2, 2]} intensity={0.3} color={WATER} distance={8} />
      <pointLight position={[3, 2, -2]} intensity={0.3} color={WATER} distance={8} />
      <pointLight position={[0, 2, 3]} intensity={0.2} color="#FFD4A0" distance={6} />
    </group>
  );
}
