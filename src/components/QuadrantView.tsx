import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { loadGeoTiff, TerrainData, getElevationColor } from '@/lib/geotiff-loader';
import * as THREE from 'three';

export type QuadrantId = 'serious-large' | 'playful-large' | 'serious-small' | 'playful-small';

interface QuadrantViewProps {
  onSelectQuadrant: (id: QuadrantId) => void;
  onBack: () => void;
}

// Adventure Time color palette
const AT_COLORS = {
  sky: '#87CEEB',
  grass: '#7CFC00',
  water: '#00BFFF',
  sand: '#FFD700',
  pink: '#FF69B4',
  purple: '#9B59B6',
};

function getATColor(normalized: number): [number, number, number] {
  // Adventure Time–style terrain colors: vibrant, candy-like
  if (normalized < 0.15) return [0, 0.75, 1]; // bright cyan water
  if (normalized < 0.25) return [0.49, 0.99, 0]; // lime green shore
  if (normalized < 0.4) return [1, 0.84, 0]; // gold sand
  if (normalized < 0.55) return [1, 0.41, 0.71]; // hot pink
  if (normalized < 0.7) return [0.61, 0.35, 0.71]; // purple mountains
  if (normalized < 0.85) return [0.4, 0.8, 1]; // light blue peaks
  return [1, 1, 1]; // white snow
}

// DEM terrain mesh generated from actual data
function DEMTerrain({ terrain, playful }: { terrain: TerrainData; playful: boolean }) {
  const geo = useMemo(() => {
    const { width, height, elevation, minElev, maxElev, noDataValue } = terrain;
    // Downsample for perf — max 128x128
    const step = Math.max(1, Math.floor(Math.max(width, height) / 128));
    const w = Math.floor(width / step);
    const h = Math.floor(height / step);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const scale = 4; // fit in view
    const elevScale = playful ? 3 : 1.5;

    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const si = (iy * step) * width + (ix * step);
        let elev = elevation[si];
        const isNoData = noDataValue !== undefined && elev === noDataValue;
        if (isNoData) elev = minElev;

        const normalized = (elev - minElev) / (maxElev - minElev + 0.001);
        const px = (ix / w - 0.5) * scale;
        const pz = (iy / h - 0.5) * scale;
        const py = normalized * elevScale - 0.5;

        positions.push(px, py, pz);

        let c: [number, number, number];
        if (playful) {
          c = getATColor(normalized);
        } else {
          c = getElevationColor(normalized, elev);
        }
        colors.push(c[0], c[1], c[2]);
      }
    }

    for (let iy = 0; iy < h - 1; iy++) {
      for (let ix = 0; ix < w - 1; ix++) {
        const a = iy * w + ix;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [terrain, playful]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors flatShading={playful} />
    </mesh>
  );
}

function AutoRotate({ dir }: { dir: [number, number] }) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    // Find the first group child to rotate
    scene.traverse((child) => {
      if (child.type === 'Group' && !groupRef.current && child.parent === scene) {
        groupRef.current = child as THREE.Group;
      }
    });
  }, [scene]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15 * dir[0];
    }
  });

  return null;
}

function RotatingAryq({ playful, rotationDir }: { playful: boolean; rotationDir: [number, number] }) {
  const { scene } = useGLTF('/models/aryq.glb');
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.25 * rotationDir[0];
    }
  });

  const clonedScene = useMemo(() => {
    const c = scene.clone();
    if (playful) {
      c.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color.setHSL(
            mat.color.getHSL({ h: 0, s: 0, l: 0 }).h,
            1.0,
            0.65
          );
          mat.flatShading = true;
          mesh.material = mat;
        }
      });
    }
    return c;
  }, [scene, playful]);

  return (
    <group ref={ref} scale={[5, playful ? 7 : 5, 5]} position={[0, -0.8, 0]}>
      <primitive object={clonedScene} />
      {playful && (
        <>
          {[[0.12, 0.25, 0.05], [-0.1, 0.22, -0.04], [0.06, 0.28, -0.07]].map((p, i) => (
            <mesh key={`drop-${i}`} position={p as [number, number, number]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color={AT_COLORS.water} emissive={AT_COLORS.water} emissiveIntensity={0.5} transparent opacity={0.8} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function QuadrantCanvas({ type, playful, rotationDir, label, terrain, onLabelClick }: {
  type: 'terrain' | 'aryq';
  playful: boolean;
  rotationDir: [number, number];
  label: string;
  terrain: TerrainData | null;
  onLabelClick: () => void;
}) {
  return (
    <div className="w-full h-full relative group">
      <div className="absolute inset-0 border border-border/20 z-10 pointer-events-none" />
      {/* Label overlay — clicking this enters the map */}
      <button
        onClick={onLabelClick}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[10px] tracking-[0.12em] uppercase font-mono px-3 py-1.5 bg-card/70 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300 cursor-pointer whitespace-nowrap"
      >
        {label} →
      </button>
      <Canvas camera={{ position: [3, 2.5, 3], fov: 45 }}>
        <ambientLight intensity={playful ? 0.8 : 0.5} />
        <directionalLight position={[5, 5, 5]} intensity={playful ? 1.2 : 0.8} />
        {playful && <color attach="background" args={['#0d1117']} />}
        <Suspense fallback={null}>
          {type === 'terrain' && terrain ? (
            <group>
              <DEMTerrain terrain={terrain} playful={playful} />
            </group>
          ) : type === 'aryq' ? (
            <RotatingAryq playful={playful} rotationDir={rotationDir} />
          ) : null}
          <Environment preset={playful ? 'sunset' : 'city'} />
        </Suspense>
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableRotate={true}
          autoRotate
          autoRotateSpeed={rotationDir[0] * 1.5}
          minDistance={1.5}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
}

export default function QuadrantView({ onSelectQuadrant, onBack }: QuadrantViewProps) {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);

  useEffect(() => {
    loadGeoTiff('/data/aral_region.tif').then(setTerrain).catch(console.error);
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex flex-col animate-fade-in">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Back button */}
        <div className="p-4">
          <button
            onClick={onBack}
            className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors"
          >
            ← Menu
          </button>
        </div>

        {/* Main grid area with axes */}
        <div className="flex-1 flex items-center justify-center px-12 pb-10">
          <div className="relative w-full max-w-5xl aspect-square max-h-[80vh]">
            
            {/* Y-axis label — left */}
            <div className="absolute -left-10 top-0 bottom-0 flex flex-col items-center justify-between py-4 z-20">
              <span className="text-sm tracking-[0.2em] uppercase text-foreground/70 font-light">
                Large Scale
              </span>
              <div className="flex-1 w-px bg-muted-foreground/30 my-3" />
              <span className="text-sm tracking-[0.2em] uppercase text-foreground/70 font-light">
                Small Scale
              </span>
            </div>

            {/* X-axis label — bottom */}
            <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-between px-4 z-20">
              <span className="text-sm tracking-[0.2em] uppercase text-foreground/70 font-light">
                Serious
              </span>
              <div className="flex-1 h-px bg-muted-foreground/30 mx-3" />
              <span className="text-sm tracking-[0.2em] uppercase text-foreground/70 font-light">
                Playful
              </span>
            </div>

            {/* Cross lines */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-muted-foreground/30" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/30" />
            </div>

            {/* 2x2 grid of 3D canvases */}
            <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
              {/* Top-left: Serious × Large Scale → DEM terrain normal */}
              <QuadrantCanvas
                type="terrain"
                playful={false}
                rotationDir={[1, 1]}
                label="Explore Terrain"
                terrain={terrain}
                onLabelClick={() => onSelectQuadrant('serious-large')}
              />
              {/* Top-right: Playful × Large Scale → DEM terrain adventure time */}
              <QuadrantCanvas
                type="terrain"
                playful={true}
                rotationDir={[-0.7, 1.3]}
                label="Adventure Mode"
                terrain={terrain}
                onLabelClick={() => onSelectQuadrant('playful-large')}
              />
              {/* Bottom-left: Serious × Small Scale → aryq normal */}
              <QuadrantCanvas
                type="aryq"
                playful={false}
                rotationDir={[0.8, -1]}
                label="Explore Aryq"
                terrain={terrain}
                onLabelClick={() => onSelectQuadrant('serious-small')}
              />
              {/* Bottom-right: Playful × Small Scale → aryq adventure time */}
              <QuadrantCanvas
                type="aryq"
                playful={true}
                rotationDir={[-1.2, 0.8]}
                label="Aryq Adventure"
                terrain={terrain}
                onLabelClick={() => onSelectQuadrant('playful-small')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
