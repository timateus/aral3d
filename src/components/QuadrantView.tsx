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
  if (normalized < 0.15) return [0, 0.75, 1];
  if (normalized < 0.25) return [0.49, 0.99, 0];
  if (normalized < 0.4) return [1, 0.84, 0];
  if (normalized < 0.55) return [1, 0.41, 0.71];
  if (normalized < 0.7) return [0.61, 0.35, 0.71];
  if (normalized < 0.85) return [0.4, 0.8, 1];
  return [1, 1, 1];
}

function getPaleColor(normalized: number): [number, number, number] {
  if (normalized < 0.15) return [0.75, 0.85, 0.9];
  if (normalized < 0.3) return [0.85, 0.88, 0.82];
  if (normalized < 0.5) return [0.9, 0.87, 0.78];
  if (normalized < 0.7) return [0.88, 0.83, 0.76];
  if (normalized < 0.85) return [0.82, 0.8, 0.78];
  return [0.92, 0.92, 0.92];
}

function getNaturalColor(normalized: number): [number, number, number] {
  if (normalized < 0.15) return [0.2, 0.5, 0.7];   // blue water
  if (normalized < 0.25) return [0.3, 0.6, 0.35];   // green lowlands
  if (normalized < 0.4) return [0.55, 0.7, 0.3];    // light green
  if (normalized < 0.55) return [0.78, 0.72, 0.4];   // yellow-brown
  if (normalized < 0.7) return [0.72, 0.6, 0.35];    // brown
  if (normalized < 0.85) return [0.65, 0.55, 0.4];   // darker brown
  return [0.9, 0.88, 0.82];                          // pale peaks
}

// DEM terrain mesh generated from actual data
function DEMTerrain({ terrain, colorFn }: { terrain: TerrainData; colorFn: (n: number) => [number, number, number] }) {
  const geo = useMemo(() => {
    const { width, height, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const step = Math.max(1, Math.floor(Math.max(width, height) / 128));
    const w = Math.floor(width / step);
    const h = Math.floor(height / step);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const scale = 4;
    const elevScale = 0.8;

    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const si = (iy * step) * width + (ix * step);
        let elev = elevations[si];
        const isNoData = noDataValue !== null && elev === noDataValue;
        if (isNoData) elev = minElevation;

        const normalized = (elev - minElevation) / (maxElevation - minElevation + 0.001);
        const px = (ix / w - 0.5) * scale;
        const pz = (iy / h - 0.5) * scale;
        const py = normalized * elevScale - 0.5;

        positions.push(px, py, pz);
        const c = colorFn(normalized);
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
  }, [terrain, colorFn]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors />
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

function RotatingModel({ modelPath, playful, rotationDir, scaleBase, brightLight, positionY }: { modelPath: string; playful: boolean; rotationDir: [number, number]; scaleBase?: number; brightLight?: boolean; positionY?: number }) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);
  const s = scaleBase ?? 3;

  // Center the model on its own bounding box so it rotates around its center
  const clonedScene = useMemo(() => {
    const c = scene.clone();
    const box = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    c.position.sub(center);
    return c;
  }, [scene]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.25 * rotationDir[0];
    }
  });

  return (
    <group ref={ref} scale={[s, s, s]} position={[0, positionY ?? -0.5, 0]}>
      {brightLight && <pointLight position={[0, 2, 0]} intensity={3} />}
      <primitive object={clonedScene} />
    </group>
  );
}

function QuadrantCanvas({ type, rotationDir, label, terrain, onLabelClick, modelPath, modelScale, colorFn, cameraPos, brightLight, modelPosY }: {
  type: 'terrain' | 'model';
  rotationDir: [number, number];
  label: string;
  terrain: TerrainData | null;
  onLabelClick: () => void;
  modelPath?: string;
  modelScale?: number;
  colorFn?: (n: number) => [number, number, number];
  cameraPos?: [number, number, number];
  brightLight?: boolean;
  modelPosY?: number;
}) {
  const camPos = cameraPos ?? (type === 'model' ? [4, 3.5, 4] : [3, 2.5, 3]);
  return (
    <div className="w-full h-full relative group">
      <div className="absolute inset-0 border border-border/20 z-10 pointer-events-none" />
      <button
        onClick={onLabelClick}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[10px] tracking-[0.12em] uppercase font-mono px-3 py-1.5 bg-card/70 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300 cursor-pointer whitespace-nowrap"
      >
        {label} →
      </button>
      <Canvas camera={{ position: camPos as [number, number, number], fov: type === 'model' ? 40 : 45 }}>
        <ambientLight intensity={brightLight ? 1.2 : 0.6} />
        <directionalLight position={[5, 5, 5]} intensity={brightLight ? 1.5 : 0.9} />
        <Suspense fallback={null}>
          {type === 'terrain' && terrain ? (
            <group>
              <DEMTerrain terrain={terrain} colorFn={colorFn ?? getPaleColor} />
            </group>
          ) : type === 'model' && modelPath ? (
            <RotatingModel modelPath={modelPath} playful={false} rotationDir={rotationDir} scaleBase={modelScale} brightLight={brightLight} positionY={modelPosY} />
          ) : null}
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableRotate={true}
          autoRotate
          autoRotateSpeed={rotationDir[0] * 1.5}
          minDistance={1.5}
          maxDistance={12}
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
              {/* Top-left: Serious × Large Scale — natural terrain */}
              <QuadrantCanvas
                type="terrain"
                rotationDir={[1, 1]}
                label="ag (MAR): Water Hide-and-seek"
                terrain={terrain}
                colorFn={getNaturalColor}
                onLabelClick={() => onSelectQuadrant('serious-large')}
              />
              {/* Top-right: Playful × Large Scale — Noah's Arc */}
              <QuadrantCanvas
                type="model"
                rotationDir={[-0.7, 1.3]}
                label="Canal thinking?"
                terrain={terrain}
                modelPath="/models/noahs-arc.glb"
                modelScale={2}
                cameraPos={[3, 2.5, 3]}
                onLabelClick={() => onSelectQuadrant('playful-large')}
              />
              {/* Bottom-left: Serious × Small Scale — Aryq */}
              <QuadrantCanvas
                type="model"
                rotationDir={[0.8, -1]}
                label="Bodies of Water"
                terrain={terrain}
                modelPath="/models/aryq.glb"
                modelScale={3}
                onLabelClick={() => onSelectQuadrant('serious-small')}
              />
              {/* Bottom-right: Playful × Small Scale — Soap */}
              <QuadrantCanvas
                type="model"
                rotationDir={[-1.2, 0.8]}
                label="Soap Opera"
                terrain={terrain}
                modelPath="/models/soap-khorezm.glb"
                modelScale={5}
                cameraPos={[2.5, 2, 2.5]}
                onLabelClick={() => onSelectQuadrant('playful-small')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
