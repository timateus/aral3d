import { useDesignerScheme, DEFAULT_SCHEME, DesignerScheme, PALETTE_PRESETS, applyPreset, applyRandomPreset, generateRandomRamp } from '@/lib/visual-mode';
import { Download, RotateCcw, X, Shuffle, Wand2 } from 'lucide-react';

interface DesignerPanelProps {
  onClose: () => void;
}

const COLOR_FIELDS: { key: keyof DesignerScheme; label: string; group: 'ui' | 'map' }[] = [
  { key: 'background', label: 'background', group: 'ui' },
  { key: 'foreground', label: 'foreground (ink)', group: 'ui' },
  { key: 'muted', label: 'secondary text', group: 'ui' },
  { key: 'panel', label: 'panel', group: 'ui' },
  { key: 'border', label: 'border', group: 'ui' },
  { key: 'accent', label: 'accent', group: 'ui' },
  { key: 'water', label: 'water', group: 'map' },
  { key: 'land', label: 'land', group: 'map' },
  { key: 'vegetation', label: 'vegetation', group: 'map' },
  { key: 'alert', label: 'alert', group: 'map' },
];

const NUMERIC_FIELDS: { key: keyof DesignerScheme; label: string; min: number; max: number; step: number }[] = [
  { key: 'borderWidth',   label: 'border width (px)',  min: 0.25, max: 3,    step: 0.25 },
  { key: 'svgStroke',     label: 'svg stroke (px)',    min: 0.25, max: 3,    step: 0.25 },
  { key: 'gridSpacing',   label: 'grid spacing (px)',  min: 16,   max: 120,  step: 4 },
  { key: 'gridOpacity',   label: 'grid opacity',       min: 0,    max: 0.2,  step: 0.005 },
  { key: 'fontWeight',    label: 'font weight',        min: 100,  max: 600,  step: 50 },
  { key: 'baseFontSize',  label: 'base font (px)',     min: 9,    max: 16,   step: 1 },
  { key: 'labelFontSize', label: 'map label (px)',     min: 7,    max: 16,   step: 1 },
  { key: 'radius',        label: 'corner radius (px)', min: 0,    max: 16,   step: 1 },
];

const DesignerPanel = ({ onClose }: DesignerPanelProps) => {
  const [scheme, setScheme] = useDesignerScheme();

  const update = (k: keyof DesignerScheme, v: any) => setScheme({ ...scheme, [k]: v });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(scheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aral-scheme-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => setScheme(DEFAULT_SCHEME);

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass-panel pointer-events-auto"
      style={{ width: 320, maxHeight: 'calc(100vh - 5rem)', overflowY: 'auto' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <span className="text-[10px] uppercase tracking-[0.2em]">Designer</span>
        <div className="flex items-center gap-1">
          <button onClick={reset} title="Reset" className="p-1 hover:opacity-60"><RotateCcw className="w-3 h-3" /></button>
          <button onClick={exportJson} title="Export JSON" className="p-1 hover:opacity-60"><Download className="w-3 h-3" /></button>
          <button onClick={onClose} title="Close" className="p-1 hover:opacity-60"><X className="w-3 h-3" /></button>
        </div>
      </div>

      <div className="px-3 py-3 space-y-4">
        <section className="space-y-1.5">
          <div className="text-[9px] uppercase tracking-[0.18em] opacity-50">Palette</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={generateRandomRamp}
              className="flex-1 flex items-center justify-center gap-1 border border-border/40 px-2 py-1.5 text-[10px] hover:bg-foreground/5 transition-colors"
              title="Generate a fresh color ramp from a random seed hue"
            >
              <Wand2 className="w-3 h-3" /> Generate ramp
            </button>
            <button
              onClick={() => applyRandomPreset()}
              className="flex-1 flex items-center justify-center gap-1 border border-border/40 px-2 py-1.5 text-[10px] hover:bg-foreground/5 transition-colors"
              title="Pick a random preset palette"
            >
              <Shuffle className="w-3 h-3" /> Random preset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            {PALETTE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="flex items-center gap-1.5 border border-border/30 px-1.5 py-1 text-[10px] hover:bg-foreground/5 transition-colors"
                title={p.label}
              >
                <span className="flex h-3 w-10 overflow-hidden border border-border/20">
                  {(p.scheme.terrainStops ?? [p.scheme.water, p.scheme.land, p.scheme.vegetation, p.scheme.alert]).map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </section>

        {(['ui', 'map'] as const).map(group => (
          <section key={group} className="space-y-1.5">
            <div className="text-[9px] uppercase tracking-[0.18em] opacity-50">
              {group === 'ui' ? 'Interface' : 'Map / terrain'}
            </div>
            {COLOR_FIELDS.filter(f => f.group === group).map(f => (
              <label key={String(f.key)} className="flex items-center justify-between gap-2 text-[10px]">
                <span>{f.label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={scheme[f.key] as string}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-[68px] bg-transparent border border-border/30 px-1 py-0.5 text-[9px] font-mono"
                  />
                  <input
                    type="color"
                    value={scheme[f.key] as string}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-5 h-5 border border-border/30 cursor-pointer p-0"
                    style={{ background: 'transparent' }}
                  />
                </span>
              </label>
            ))}
          </section>
        ))}

        <section className="space-y-2 pt-1 border-t border-border/30">
          <div className="text-[9px] uppercase tracking-[0.18em] opacity-50">Geometry</div>
          {NUMERIC_FIELDS.map(f => (
            <label key={String(f.key)} className="block space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span>{f.label}</span>
                <span className="font-mono opacity-70 tabular-nums">{Number(scheme[f.key]).toFixed(f.step < 1 ? (f.step < 0.05 ? 3 : 2) : 0)}</span>
              </div>
              <input
                type="range"
                min={f.min} max={f.max} step={f.step}
                value={scheme[f.key] as number}
                onChange={(e) => update(f.key, parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: 'currentColor' }}
              />
            </label>
          ))}
        </section>
      </div>
    </div>
  );
};

export default DesignerPanel;
