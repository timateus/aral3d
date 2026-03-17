import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

type QuadrantId = 'serious-large' | 'playful-large' | 'serious-small' | 'playful-small';

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

function RotatingTerrain({ playful, rotationDir }: { playful: boolean; rotationDir: [number, number] }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.3 * rotationDir[0];
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15 * rotationDir[1]) * 0.05;
    }
  });

  const terrainColor = playful ? AT_COLORS.grass : '#8B7355';
  const waterColor = playful ? AT_COLORS.water : '#1a4a6b';
  const exaggeration = playful ? 2.5 : 1;

  return (
    <group ref={ref}>
      {/* Base terrain plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[4, 4, 32, 32]} />
        <meshStandardMaterial color={waterColor} side={THREE.DoubleSide} />
      </mesh>
      {/* Mountains */}
      {[
        { pos: [-0.8, 0, -0.5] as [number, number, number], scale: 0.8 },
        { pos: [0.5, 0, 0.3] as [number, number, number], scale: 0.6 },
        { pos: [-0.3, 0, 0.7] as [number, number, number], scale: 0.5 },
        { pos: [1, 0, -0.8] as [number, number, number], scale: 0.4 },
        { pos: [0, 0, -1] as [number, number, number], scale: 0.7 },
      ].map((m, i) => (
        <mesh key={i} position={[m.pos[0], m.pos[1] - 0.2, m.pos[2]]}>
          <coneGeometry args={[m.scale * 0.6, m.scale * exaggeration, playful ? 5 : 8]} />
          <meshStandardMaterial
            color={playful ? (i % 2 === 0 ? AT_COLORS.pink : AT_COLORS.purple) : terrainColor}
            flatShading={playful}
          />
        </mesh>
      ))}
      {/* Playful extras */}
      {playful && (
        <>
          {/* Cartoon clouds */}
          {[[-1, 1.2, 0], [0.8, 1.4, -0.5], [0, 1, 0.8]].map((p, i) => (
            <group key={`cloud-${i}`} position={p as [number, number, number]}>
              <mesh><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="white" /></mesh>
              <mesh position={[0.15, 0.05, 0]}><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="white" /></mesh>
              <mesh position={[-0.12, 0.03, 0]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="white" /></mesh>
            </group>
          ))}
          {/* Stars */}
          {[[-0.5, 1.6, 0.3], [1, 1.7, -0.2], [-1.2, 1.5, -0.6]].map((p, i) => (
            <mesh key={`star-${i}`} position={p as [number, number, number]}>
              <octahedronGeometry args={[0.06]} />
              <meshStandardMaterial color={AT_COLORS.sand} emissive={AT_COLORS.sand} emissiveIntensity={0.8} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function RotatingAryq({ playful, rotationDir }: { playful: boolean; rotationDir: [number, number] }) {
  const { scene } = useGLTF('/models/aryq.glb');
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.25 * rotationDir[0];
    }
  });

  const clonedScene = scene.clone();

  if (playful) {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        // Saturate and brighten colors for Adventure Time style
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

  return (
    <group ref={ref} scale={[8, playful ? 12 : 8, 8]} position={[0, -1, 0]}>
      <primitive object={clonedScene} />
      {playful && (
        <>
          {/* Cartoon water drops */}
          {[[0.1, 0.2, 0.05], [-0.08, 0.18, -0.03], [0.05, 0.22, -0.06]].map((p, i) => (
            <mesh key={`drop-${i}`} position={p as [number, number, number]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshStandardMaterial color={AT_COLORS.water} emissive={AT_COLORS.water} emissiveIntensity={0.5} transparent opacity={0.8} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function QuadrantCanvas({ type, playful, rotationDir, onClick }: {
  type: 'terrain' | 'aryq';
  playful: boolean;
  rotationDir: [number, number];
  onClick: () => void;
}) {
  return (
    <div
      className="w-full h-full cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="absolute inset-0 border border-border/20 group-hover:border-primary/50 transition-colors duration-300 z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-transparent group-hover:bg-primary/5 transition-colors duration-300 z-10 pointer-events-none" />
      <Canvas camera={{ position: [2, 1.5, 2], fov: 40 }}>
        <ambientLight intensity={playful ? 0.8 : 0.5} />
        <directionalLight position={[5, 5, 5]} intensity={playful ? 1.2 : 0.8} />
        {playful && <color attach="background" args={['#1a1a2e']} />}
        <Suspense fallback={null}>
          {type === 'terrain' ? (
            <RotatingTerrain playful={playful} rotationDir={rotationDir} />
          ) : (
            <RotatingAryq playful={playful} rotationDir={rotationDir} />
          )}
          <Environment preset={playful ? 'sunset' : 'city'} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}

export default function QuadrantView({ onSelectQuadrant, onBack }: QuadrantViewProps) {
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
        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="relative w-full max-w-4xl aspect-square max-h-[80vh]">
            
            {/* Y-axis label — left */}
            <div className="absolute -left-6 top-0 bottom-0 flex flex-col items-center justify-between py-4 z-20">
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-mono rotate-0">
                Large Scale
              </span>
              <div className="flex-1 w-px bg-muted-foreground/20 my-2" />
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-mono rotate-0">
                Small Scale
              </span>
            </div>

            {/* X-axis label — bottom */}
            <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-between px-4 z-20">
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                Serious
              </span>
              <div className="flex-1 h-px bg-muted-foreground/20 mx-2" />
              <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
                Playful
              </span>
            </div>

            {/* Cross lines */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Horizontal */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-muted-foreground/30" />
              {/* Vertical */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/30" />
            </div>

            {/* Quadrant labels */}
            <div className="absolute top-2 left-2 z-20 text-[8px] tracking-[0.15em] uppercase text-muted-foreground/60 font-mono">
              Serious × Large
            </div>
            <div className="absolute top-2 right-2 z-20 text-[8px] tracking-[0.15em] uppercase text-muted-foreground/60 font-mono text-right">
              Playful × Large
            </div>
            <div className="absolute bottom-2 left-2 z-20 text-[8px] tracking-[0.15em] uppercase text-muted-foreground/60 font-mono">
              Serious × Small
            </div>
            <div className="absolute bottom-2 right-2 z-20 text-[8px] tracking-[0.15em] uppercase text-muted-foreground/60 font-mono text-right">
              Playful × Small
            </div>

            {/* 2x2 grid of 3D canvases */}
            <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
              {/* Top-left: Serious × Large Scale → terrain */}
              <QuadrantCanvas
                type="terrain"
                playful={false}
                rotationDir={[1, 1]}
                onClick={() => onSelectQuadrant('serious-large')}
              />
              {/* Top-right: Playful × Large Scale → terrain */}
              <QuadrantCanvas
                type="terrain"
                playful={true}
                rotationDir={[-0.7, 1.3]}
                onClick={() => onSelectQuadrant('playful-large')}
              />
              {/* Bottom-left: Serious × Small Scale → aryq */}
              <QuadrantCanvas
                type="aryq"
                playful={false}
                rotationDir={[0.8, -1]}
                onClick={() => onSelectQuadrant('serious-small')}
              />
              {/* Bottom-right: Playful × Small Scale → aryq */}
              <QuadrantCanvas
                type="aryq"
                playful={true}
                rotationDir={[-1.2, 0.8]}
                onClick={() => onSelectQuadrant('playful-small')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
