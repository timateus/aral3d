import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import {
  createSandbox,
  stepSandbox,
  paintElement,
  SandboxState,
  ElementType,
  ELEMENT_RGB,
} from '@/lib/sandbox-simulation';

const SIM_WIDTH = 200;
const SIM_HEIGHT = 200;

interface Sandbox3DProps {
  terrain: TerrainData;
  exaggeration: number;
  active: boolean;
  selectedElement: ElementType;
  brushSize: number;
  paused: boolean;
  onStateReady?: (state: SandboxState) => void;
}

/**
 * 3D sandbox simulation rendered as instanced spheres on the terrain.
 * Runs the cellular automata and maps each non-empty cell to a position on the terrain mesh.
 */
export function Sandbox3D({ terrain, exaggeration, active, selectedElement, brushSize, paused, onStateReady }: Sandbox3DProps) {
  const stateRef = useRef<SandboxState | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const isPainting = useRef(false);
  const lastPaintPos = useRef<{ x: number; y: number } | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Max particles we can render
  const MAX_INSTANCES = 8000;

  // Initialize simulation
  useEffect(() => {
    if (!active) return;
    stateRef.current = createSandbox(
      SIM_WIDTH, SIM_HEIGHT,
      terrain.elevations, terrain.width, terrain.height
    );
  }, [active, terrain]);

  // Convert sim grid (x, y) to terrain mesh 3D position
  const simToWorld = useCallback((sx: number, sy: number): [number, number, number] => {
    const { width: tw, height: th, elevations, minElevation, maxElevation, noDataValue } = terrain;
    const maxHeight = 10 * (exaggeration / 100);
    const elevRange = maxElevation - minElevation || 1;

    // Map sim x -> terrain col, sim y -> terrain row
    const col = Math.floor((sx / SIM_WIDTH) * tw);
    const row = Math.floor((sy / SIM_HEIGHT) * th);
    const tIdx = row * tw + Math.min(col, tw - 1);
    let elev = elevations[tIdx];
    if (isNaN(elev) || (noDataValue !== null && elev === noDataValue) || elev <= -9999) {
      elev = minElevation;
    }
    const normalized = (elev - minElevation) / elevRange;

    // Match TerrainMesh coordinate system
    const meshX = (col / (tw - 1) - 0.5) * 10;
    const meshZ = -(0.5 - row / (th - 1)) * 10 * (th / tw); // negative because rotation
    const meshY = normalized * maxHeight + 0.05; // slightly above terrain

    return [meshX, meshY, meshZ];
  }, [terrain, exaggeration]);

  // Handle raycasting for painting
  const handlePointerDown = useCallback((e: any) => {
    if (!active || !stateRef.current) return;
    e.stopPropagation();
    isPainting.current = true;

    const { uv } = e;
    if (!uv) return;
    const sx = Math.floor(uv.x * SIM_WIDTH);
    const sy = Math.floor((1 - uv.y) * SIM_HEIGHT);
    paintElement(stateRef.current, sx, sy, selectedElement, brushSize);
    lastPaintPos.current = { x: sx, y: sy };
  }, [active, selectedElement, brushSize]);

  const handlePointerMove = useCallback((e: any) => {
    if (!active || !isPainting.current || !stateRef.current) return;
    e.stopPropagation();

    const { uv } = e;
    if (!uv) return;
    const sx = Math.floor(uv.x * SIM_WIDTH);
    const sy = Math.floor((1 - uv.y) * SIM_HEIGHT);
    paintElement(stateRef.current, sx, sy, selectedElement, brushSize);
    lastPaintPos.current = { x: sx, y: sy };
  }, [active, selectedElement, brushSize]);

  const handlePointerUp = useCallback(() => {
    isPainting.current = false;
    lastPaintPos.current = null;
  }, []);

  // Animation loop: step simulation + update instances
  useFrame(() => {
    if (!active || !stateRef.current || !meshRef.current) return;

    const state = stateRef.current;
    if (!paused) {
      stepSandbox(state);
    }

    const mesh = meshRef.current;
    const { grid, width, height } = state;
    let count = 0;
    const colorAttr = mesh.instanceColor!;

    for (let i = 0; i < grid.length && count < MAX_INSTANCES; i++) {
      const cell = grid[i];
      if (cell.type === 'empty' || cell.type === 'wall') continue;

      const sx = i % width;
      const sy = Math.floor(i / width);
      const [wx, wy, wz] = simToWorld(sx, sy);

      dummy.position.set(wx, wy, wz);
      dummy.scale.setScalar(0.025);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);

      const rgb = ELEMENT_RGB[cell.type];
      colorAttr.setXYZ(count, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);

      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (colorAttr) (colorAttr as THREE.InstancedBufferAttribute).needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_INSTANCES]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial vertexColors roughness={0.6} metalness={0.1} />
    </instancedMesh>
  );
}

// ─── HUD Panel (rendered in DOM, not in 3D) ───

const ELEMENTS: { type: ElementType; label: string }[] = [
  { type: 'sand', label: 'Sand' },
  { type: 'water', label: 'Water' },
  { type: 'stone', label: 'Stone' },
  { type: 'plant', label: 'Plant' },
  { type: 'seed', label: 'Seed' },
  { type: 'fire', label: 'Fire' },
  { type: 'gas', label: 'Gas' },
  { type: 'wind', label: 'Wind' },
  { type: 'dust', label: 'Dust' },
  { type: 'ice', label: 'Ice' },
  { type: 'oil', label: 'Oil' },
  { type: 'lava', label: 'Lava' },
  { type: 'empty', label: 'Erase' },
];

const BRUSH_SIZES = [1, 3, 5, 8, 12];

import { ELEMENT_COLORS } from '@/lib/sandbox-simulation';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface SandboxHUDProps {
  active: boolean;
  selectedElement: ElementType;
  onSelectElement: (e: ElementType) => void;
  brushSize: number;
  onBrushSize: (s: number) => void;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  onExit: () => void;
}

export function SandboxHUD({
  active, selectedElement, onSelectElement, brushSize, onBrushSize,
  paused, onTogglePause, onReset, onExit,
}: SandboxHUDProps) {
  if (!active) return null;

  return (
    <>
      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={onExit}
          className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm"
        >
          ← Back to menu
        </button>
      </div>

      {/* Right panel */}
      <div className="absolute top-4 right-4 z-20 w-48 bg-card/80 backdrop-blur-md border border-border/50 p-3 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="text-xs font-semibold text-foreground tracking-wide">Sandbox</div>

        {/* Controls */}
        <div className="flex gap-1">
          <button
            onClick={onTogglePause}
            className="flex items-center justify-center w-8 h-8 rounded bg-muted hover:bg-muted/80 transition-colors"
            title={paused ? 'Play' : 'Pause'}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={onReset}
            className="flex items-center justify-center w-8 h-8 rounded bg-muted hover:bg-muted/80 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Brush size */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Brush</div>
          <div className="flex gap-1">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                onClick={() => onBrushSize(size)}
                className={`flex items-center justify-center w-7 h-7 rounded text-xs transition-colors ${
                  brushSize === size
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{
                    width: `${4 + size * 1.5}px`,
                    height: `${4 + size * 1.5}px`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Elements */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Elements</div>
          <div className="grid grid-cols-2 gap-1">
            {ELEMENTS.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => onSelectElement(type)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                  selectedElement === type
                    ? 'ring-2 ring-primary bg-primary/10 text-foreground'
                    : 'bg-muted/60 hover:bg-muted text-foreground/80'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm border border-border/40 flex-shrink-0"
                  style={{
                    backgroundColor: type === 'empty' ? '#F0E8DC' : ELEMENT_COLORS[type],
                  }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="text-[9px] text-muted-foreground leading-relaxed">
          <p>Click & drag on the terrain to place elements. They interact with each other!</p>
        </div>
      </div>
    </>
  );
}

export default Sandbox3D;
