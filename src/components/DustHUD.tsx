import { Pause, Play, RotateCcw, Wind, Sparkles } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface DustHUDProps {
  active: boolean;
  windDir: number;       // radians
  onWindDir: (v: number) => void;
  windSpeed: number;
  onWindSpeed: (v: number) => void;
  turbulence: number;
  onTurbulence: (v: number) => void;
  particleLife: number;
  onParticleLife: (v: number) => void;
  spawnRate: number;
  onSpawnRate: (v: number) => void;
  paused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  onSeedAralkum: () => void;
  onClearEmitters: () => void;
  onExit: () => void;
  particleCount: number;
  emitterCount: number;
}

const radToCompass = (rad: number) => {
  // 0 rad = +X (east). Convert to compass bearing.
  let deg = (90 - (rad * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${dirs[Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
};

export function DustHUD({
  active, windDir, onWindDir, windSpeed, onWindSpeed,
  turbulence, onTurbulence, particleLife, onParticleLife,
  spawnRate, onSpawnRate, paused, onTogglePause, onReset,
  onSeedAralkum, onClearEmitters, onExit, particleCount, emitterCount,
}: DustHUDProps) {
  if (!active) return null;

  return (
    <>
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={onExit}
          className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm"
        >
          ← Back to menu
        </button>
      </div>

      <div className="absolute top-4 right-4 z-20 w-60 bg-card/80 backdrop-blur-md border border-border/50 p-3 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-amber-500" />
          <div className="text-xs font-semibold text-foreground tracking-wide">Dust Storm</div>
        </div>

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
            title="Clear particles"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={onSeedAralkum}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 transition-colors"
          >
            <Sparkles className="w-3 h-3" /> Seed Aralkum seabed
          </button>
          <button
            onClick={onClearEmitters}
            className="px-2 py-1.5 text-[10px] uppercase tracking-wider bg-muted/60 hover:bg-muted text-foreground/80 transition-colors"
          >
            Clear emitters
          </button>
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Wind direction: {radToCompass(windDir)}
          </div>
          <Slider
            value={[windDir]}
            onValueChange={([v]) => onWindDir(v)}
            min={0}
            max={Math.PI * 2}
            step={Math.PI / 36}
          />
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Wind speed: {windSpeed.toFixed(1)}
          </div>
          <Slider
            value={[windSpeed]}
            onValueChange={([v]) => onWindSpeed(v)}
            min={0}
            max={5}
            step={0.1}
          />
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Turbulence: {turbulence.toFixed(2)}
          </div>
          <Slider
            value={[turbulence]}
            onValueChange={([v]) => onTurbulence(v)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Particle life: {particleLife.toFixed(1)}s
          </div>
          <Slider
            value={[particleLife]}
            onValueChange={([v]) => onParticleLife(v)}
            min={1}
            max={20}
            step={0.5}
          />
        </div>

        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Spawn rate: {spawnRate}%
          </div>
          <Slider
            value={[spawnRate]}
            onValueChange={([v]) => onSpawnRate(v)}
            min={10}
            max={400}
            step={10}
          />
        </div>

        <div className="text-[9px] text-muted-foreground border-t border-border/40 pt-2 leading-relaxed">
          Particles: {particleCount.toLocaleString()}<br />
          Emitters: {emitterCount.toLocaleString()}<br />
          <span className="opacity-70">Click the terrain to add an emitter, or seed the dry seabed.</span>
        </div>
      </div>
    </>
  );
}
