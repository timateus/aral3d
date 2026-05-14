import { useEffect, useState } from 'react';
import { Play, Pause, StepForward, RotateCcw, Sparkles, Zap, X } from 'lucide-react';
import { emitLifeEvent, onLifeStats, LifeStats, LifeColorMode, getLifeSettings } from '@/lib/life-simulation';

interface Props {
  active: boolean;
  onExit: () => void;
}

export default function LifeHUD({ active, onExit }: Props) {
  const initialSettings = getLifeSettings();
  const [stats, setStats] = useState<LifeStats>({ generation: 0, population: 0, running: true, speed: 8 });
  const [speed, setSpeed] = useState(8);
  const [cellSize, setCellSize] = useState(initialSettings.cellSize);
  const [colorMode, setColorMode] = useState<LifeColorMode>(initialSettings.colorMode);

  useEffect(() => onLifeStats((next) => {
    setStats(next);
    if (next.cellSize !== undefined) setCellSize(next.cellSize);
    if (next.colorMode) setColorMode(next.colorMode);
    setSpeed(next.speed);
  }), []);

  if (!active) return null;

  return (
    <>
      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass-panel px-4 py-2 pointer-events-none">
        <p className="text-xs text-foreground tracking-[0.15em] uppercase">
          <span className="text-primary font-semibold">Game of Life</span>
          <span className="text-muted-foreground ml-3 font-mono">
            gen {stats.generation} · pop {stats.population}
            {stats.gridWidth && stats.gridHeight ? ` · ${stats.gridWidth}×${stats.gridHeight}` : ''}
          </span>
        </p>
      </div>

      {/* Controls bottom-left */}
      <div className="absolute bottom-6 left-6 z-30 glass-panel p-3 flex flex-col gap-3 w-72 pointer-events-auto">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">Conway · cyclic grid</span>
          <button onClick={onExit} className="text-muted-foreground hover:text-primary transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => emitLifeEvent({ type: 'toggle' })}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-3 py-2 border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          >
            {stats.running ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Play</>}
          </button>
          <button
            onClick={() => emitLifeEvent({ type: 'step' })}
            className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-3 py-2 border border-border/60 bg-card/40 text-foreground hover:border-primary/40 transition-all"
          >
            <StepForward className="w-3 h-3" /> Step
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Speed</span>
            <span className="font-mono text-foreground">{speed.toFixed(1)} gen/s</span>
          </div>
          <input
            type="range" min={0.5} max={30} step={0.5}
            value={speed}
            onChange={(e) => { const v = parseFloat(e.target.value); setSpeed(v); emitLifeEvent({ type: 'speed', value: v }); }}
            className="w-full accent-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Cell size</span>
            <span className="font-mono text-foreground">{cellSize.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.04} max={1.0} step={0.01}
            value={cellSize}
            onChange={(e) => { const v = parseFloat(e.target.value); setCellSize(v); emitLifeEvent({ type: 'cell-size', value: v }); }}
            className="w-full accent-primary"
          />
        </div>

        <div className="h-px bg-border/40" />

        {/* Color mode */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">Color mode</span>
          <div className="grid grid-cols-3 gap-1">
            {([
              { id: 'age', label: 'Age' },
              { id: 'surface', label: 'Surface' },
              { id: 'bright', label: 'Bright' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => { setColorMode(opt.id); emitLifeEvent({ type: 'color-mode', mode: opt.id }); }}
                className={`text-[10px] uppercase tracking-wider px-1.5 py-1.5 border transition-all ${
                  colorMode === opt.id
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/60 bg-card/40 text-foreground hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => emitLifeEvent({ type: 'seed-random' })}
            className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-2 border border-border/60 bg-card/40 text-foreground hover:border-primary/40 transition-all"
          >
            <Sparkles className="w-3 h-3" /> Random
          </button>
          <button
            onClick={() => emitLifeEvent({ type: 'seed-pattern', kind: 'gliders' })}
            className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-2 border border-border/60 bg-card/40 text-foreground hover:border-primary/40 transition-all"
          >
            <Zap className="w-3 h-3" /> Gliders
          </button>
          <button
            onClick={() => emitLifeEvent({ type: 'seed-pattern', kind: 'pulsar' })}
            className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-2 border border-border/60 bg-card/40 text-foreground hover:border-primary/40 transition-all"
          >
            ✦ Pulsar
          </button>
          <button
            onClick={() => emitLifeEvent({ type: 'seed-qaraqalpaq' })}
            className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-2 border border-border/60 bg-card/40 text-foreground hover:border-primary/40 transition-all"
          >
            ◇ Qaraqalpaq
          </button>
          <button
            onClick={() => emitLifeEvent({ type: 'clear' })}
            className="col-span-2 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider px-2 py-2 border border-border/60 bg-card/40 text-foreground hover:border-destructive/60 hover:text-destructive transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Clear all
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          Click any cell to toggle. Seeds add to existing cells; topology wraps at the edges.
        </p>
      </div>
    </>
  );
}
