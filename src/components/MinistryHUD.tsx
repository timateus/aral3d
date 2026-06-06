import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useDesignerScheme, applyDesignerScheme, getDesignerScheme } from '@/lib/visual-mode';

export interface MinistryAnnual {
  year: number;
  seaLevel?: number;
  surfaceArea?: number;
  volume?: number;
  salinity?: number;
}

interface Props {
  waterLevel: number;
  onWaterLevelChange: (v: number) => void;
  onExit: () => void;
  onPrev?: () => void;
  annualData?: MinistryAnnual[];
}

// Slider bounds (meters absolute sea level)
const MIN = -10;
const MAX = 100;

// How fast the slider drifts down after the user sets it (m/sec).
const DRIFT_PER_SEC = 0.8;

// Slider tick labels — water level milestones.
const TICKS: { v: number; label: string }[] = [
  { v: 100, label: '100m' },
  { v: 75, label: '75m' },
  { v: 53, label: '53m  pre-collapse' },
  { v: 40, label: '40m' },
  { v: 29, label: '29m  modern' },
  { v: 15, label: '15m' },
  { v: 0, label: '0m  sea level' },
  { v: -10, label: '-10m' },
];

// Pick a color far from the current terrain palette (max hue distance).
function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function pickContrastingWater(stops: string[]): string {
  const hues = stops.map((c) => hexToHsl(c)[0]);
  // try 36 candidate hues, pick one with max min-distance to all stops
  let best = 0, bestDist = -1;
  for (let i = 0; i < 36; i++) {
    const cand = i * 10;
    let minD = 360;
    for (const h of hues) {
      const d = Math.min(Math.abs(cand - h), 360 - Math.abs(cand - h));
      if (d < minD) minD = d;
    }
    if (minD > bestDist) { bestDist = minD; best = cand; }
  }
  // high-saturation, mid-light
  return `hsl(${best} 100% 55%)`;
}

const MinistryHUD = ({ waterLevel, onWaterLevelChange, onExit, onPrev, annualData = [] }: Props) => {
  const [scheme] = useDesignerScheme();

  // On mount: override water with a contrasting color. Restore on exit.
  const originalWaterRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = getDesignerScheme();
    originalWaterRef.current = cur.water;
    const stops = cur.terrainStops && cur.terrainStops.length
      ? cur.terrainStops
      : [cur.water, cur.land, cur.vegetation, cur.alert];
    const contrast = pickContrastingWater(stops);
    applyDesignerScheme({ ...cur, water: contrast });
    return () => {
      const now = getDesignerScheme();
      if (originalWaterRef.current) {
        applyDesignerScheme({ ...now, water: originalWaterRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waterColor = scheme.water;

  // Activate drift only after first user interaction.
  const interactedRef = useRef(false);
  const waterRef = useRef(waterLevel);
  useEffect(() => { waterRef.current = waterLevel; }, [waterLevel]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (interactedRef.current) {
        const next = waterRef.current - DRIFT_PER_SEC * dt;
        if (next > MIN) {
          onWaterLevelChange(Number(next.toFixed(2)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onWaterLevelChange]);

  const nearest = useMemo(() => {
    if (!annualData.length) return null;
    let best = annualData[0];
    let bestDist = Infinity;
    for (const r of annualData) {
      if (r.seaLevel == null) continue;
      const d = Math.abs(r.seaLevel - waterLevel);
      if (d < bestDist) { bestDist = d; best = r; }
    }
    return best;
  }, [annualData, waterLevel]);

  const chartData = useMemo(
    () => annualData.filter((r) => r.year != null),
    [annualData],
  );

  return (
    <>
      {/* Top-left controls */}
      <div className="absolute top-5 left-5 z-40 flex items-center gap-2">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/80 bg-black/70 border border-white/20 hover:bg-black/90 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> exit
        </button>
        {onPrev && (
          <button
            onClick={onPrev}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/80 bg-black/70 border border-white/20 hover:bg-black/90 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> level 1
          </button>
        )}
      </div>

      {/* Level title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">level 2</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/90">
          Great Water Level
        </h1>
      </div>

      {/* Vertical slider with labels */}
      <div className="fixed right-10 top-1/2 -translate-y-1/2 z-40 select-none flex items-stretch gap-4">
        {/* tick labels */}
        <div className="relative h-[72vh] w-32 text-right">
          {TICKS.map((t) => {
            const pct = 1 - (t.v - MIN) / (MAX - MIN);
            return (
              <div
                key={t.v}
                className="absolute right-0 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/55 whitespace-nowrap"
                style={{ top: `${pct * 100}%` }}
              >
                <span className="inline-block w-3 border-t border-white/30 align-middle mr-2" />
                {t.label}
              </div>
            );
          })}
        </div>
        <div className="relative h-[72vh] w-10 flex items-center justify-center">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/15" />
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={0.01}
            value={waterLevel}
            onPointerDown={() => { interactedRef.current = true; }}
            onChange={(e) => {
              interactedRef.current = true;
              onWaterLevelChange(Number(e.target.value));
            }}
            aria-label="value"
            className="ministry-slider"
            style={{
              writingMode: 'vertical-lr' as any,
              WebkitAppearance: 'slider-vertical' as any,
              height: '72vh',
              width: 24,
              direction: 'rtl',
              cursor: 'ns-resize',
              accentColor: waterColor,
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {/* Numeric readouts + small graph — bottom-left */}
      <div className="fixed bottom-6 left-6 z-40 w-[420px] bg-black/75 border border-white/15 backdrop-blur-md p-4 text-white font-mono">
        <div className="grid grid-cols-4 gap-3 text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
          <div>Year</div>
          <div>Volume</div>
          <div>Area</div>
          <div>Salinity</div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-base mb-3">
          <div>{nearest?.year ?? '—'}</div>
          <div>{nearest?.volume != null ? `${nearest.volume} km³` : '—'}</div>
          <div>{nearest?.surfaceArea != null ? `${nearest.surfaceArea} km²` : '—'}</div>
          <div>{nearest?.salinity != null ? `${nearest.salinity} g/L` : '—'}</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
          value: {waterLevel.toFixed(2)} m
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: '#ffffff80', fontSize: 9 }} axisLine={{ stroke: '#ffffff30' }} tickLine={false} />
              <YAxis yAxisId="vol" tick={{ fill: '#ffffff80', fontSize: 9 }} axisLine={{ stroke: '#ffffff30' }} tickLine={false} width={28} />
              <YAxis yAxisId="sal" orientation="right" tick={{ fill: '#ffffff80', fontSize: 9 }} axisLine={{ stroke: '#ffffff30' }} tickLine={false} width={24} />
              <Tooltip contentStyle={{ background: '#000', border: '1px solid #ffffff30', fontSize: 10, color: '#fff' }} labelStyle={{ color: '#fff' }} />
              <Line yAxisId="vol" type="monotone" dataKey="volume" stroke="#ffffff" strokeWidth={1} dot={false} isAnimationActive={false} name="Volume" />
              <Line yAxisId="vol" type="monotone" dataKey="surfaceArea" stroke="#9ca3af" strokeWidth={1} dot={false} isAnimationActive={false} name="Area" />
              <Line yAxisId="sal" type="monotone" dataKey="salinity" stroke={waterColor} strokeWidth={1} dot={false} isAnimationActive={false} name="Salinity" />
              {nearest?.year != null && (
                <ReferenceLine yAxisId="vol" x={nearest.year} stroke="#ffffff" strokeDasharray="2 2" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default MinistryHUD;
