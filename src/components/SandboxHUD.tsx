import { Pause, Play, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SANDBOX_ELEMENTS, type SandboxElement } from '@/lib/sandbox-simulation';

interface SandboxHUDProps {
  active: boolean;
  selectedElement: SandboxElement;
  onSelectElement: (e: SandboxElement) => void;
  brushSize: number;
  onBrushSize: (s: number) => void;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  onExit: () => void;
  activePixels?: number;
  speed: number;
  onSpeedChange: (s: number) => void;
}

export function SandboxHUD({
  active, selectedElement, onSelectElement, brushSize, onBrushSize,
  paused, onTogglePause, onReset, onExit, activePixels = 0,
  speed, onSpeedChange,
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

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="text-sm font-semibold text-foreground tracking-wider bg-card/60 backdrop-blur-sm border border-border/50 px-4 py-1.5">
          ARALSPIEL
        </div>
      </div>

      {/* Right panel */}
      <div className="absolute top-4 right-4 z-20 w-56 bg-card/80 backdrop-blur-md border border-border/50 p-3 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Paint with elements</div>

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

        {/* Speed */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Speed: {speed}x</div>
          <Slider
            value={[speed]}
            onValueChange={([v]) => onSpeedChange(v)}
            min={1}
            max={20}
            step={1}
          />
        </div>

        {/* Brush size */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Brush: {brushSize}px</div>
          <Slider
            value={[brushSize]}
            onValueChange={([v]) => onBrushSize(v)}
            min={1}
            max={20}
            step={1}
          />
        </div>

        {/* Elements */}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Elements</div>
          <div className="flex flex-col gap-1">
            {SANDBOX_ELEMENTS.map(({ type, label, color, desc }) => (
              <button
                key={type}
                onClick={() => onSelectElement(type)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all text-left ${
                  selectedElement === type
                    ? 'ring-2 ring-primary bg-primary/10 text-foreground'
                    : 'bg-muted/60 hover:bg-muted text-foreground/80'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm border border-border/40 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="text-[8px] text-muted-foreground leading-tight">{desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="text-[9px] text-muted-foreground border-t border-border/30 pt-2">
          <p>Active pixels: {activePixels.toLocaleString()}</p>
          <p className="mt-1 italic">Click & drag on terrain to paint.</p>
        </div>
      </div>
    </>
  );
}
