import { useRef, useEffect, useState, useCallback } from 'react';
import {
  createSandbox,
  stepSandbox,
  paintElement,
  renderToImageData,
  SandboxState,
  ElementType,
  ELEMENT_COLORS,
} from '@/lib/sandbox-simulation';
import { TerrainData } from '@/lib/geotiff-loader';
import { Pause, Play, RotateCcw } from 'lucide-react';

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

const SIM_WIDTH = 200;
const SIM_HEIGHT = 200;

interface SandboxModeProps {
  active: boolean;
  terrain: TerrainData | null;
  onExit: () => void;
}

export default function SandboxMode({ active, terrain, onExit }: SandboxModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SandboxState | null>(null);
  const animRef = useRef<number | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const [paused, setPaused] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementType>('sand');
  const [brushSize, setBrushSize] = useState(3);
  const [fps, setFps] = useState(0);
  const isPainting = useRef(false);
  const lastFpsTime = useRef(0);
  const frameCount = useRef(0);

  // Initialize simulation
  const initSim = useCallback(() => {
    const t = terrain;
    stateRef.current = createSandbox(
      SIM_WIDTH, SIM_HEIGHT,
      t?.elevations, t?.width, t?.height
    );
  }, [terrain]);

  useEffect(() => {
    if (!active) return;
    initSim();
  }, [active, initSim]);

  // Animation loop
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = SIM_WIDTH;
    canvas.height = SIM_HEIGHT;
    imageDataRef.current = ctx.createImageData(SIM_WIDTH, SIM_HEIGHT);

    const loop = () => {
      const state = stateRef.current;
      if (!state) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      if (!paused) {
        stepSandbox(state);
      }

      renderToImageData(state, imageDataRef.current!);
      ctx.putImageData(imageDataRef.current!, 0, 0);

      // FPS counter
      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsTime.current > 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = now;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, paused]);

  const getSimCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIM_WIDTH);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIM_HEIGHT);
    return { x, y };
  }, []);

  const paint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSimCoords(e);
    if (!coords || !stateRef.current) return;
    paintElement(stateRef.current, coords.x, coords.y, selectedElement, brushSize);
  }, [getSimCoords, selectedElement, brushSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isPainting.current = true;
    paint(e);
  }, [paint]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting.current) return;
    paint(e);
  }, [paint]);

  const handleMouseUp = useCallback(() => {
    isPainting.current = false;
  }, []);

  const handleReset = useCallback(() => {
    initSim();
  }, [initSim]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/95">
        <button
          onClick={onExit}
          className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to compare
        </button>
        <span className="text-xs text-muted-foreground font-mono">Sandbox · FPS: {fps}</span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-[#F0E8DC]">
          <canvas
            ref={canvasRef}
            className="border border-border/30 shadow-lg cursor-crosshair"
            style={{
              width: '100%',
              maxWidth: 'min(80vh, 100%)',
              aspectRatio: '1',
              imageRendering: 'pixelated',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Right panel */}
        <div className="w-48 border-l border-border/50 bg-background/95 p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Controls */}
          <div className="flex gap-1">
            <button
              onClick={() => setPaused(!paused)}
              className="flex items-center justify-center w-8 h-8 rounded bg-muted hover:bg-muted/80 transition-colors"
              title={paused ? 'Play' : 'Pause'}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReset}
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
                  onClick={() => setBrushSize(size)}
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
                  onClick={() => setSelectedElement(type)}
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
          <div className="mt-auto text-[9px] text-muted-foreground leading-relaxed">
            <p>Click & drag to place elements. They interact with each other and the terrain!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
