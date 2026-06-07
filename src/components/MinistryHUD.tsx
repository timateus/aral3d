import { ChevronLeft, ChevronRight, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { sfx } from '@/lib/ui-sfx';
import { useGamepad } from '@/hooks/useGamepad';

function PadHint({ label, color = '#ffffff' }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold leading-none rounded"
      style={{
        border: `1.5px solid ${color}`,
        color,
        background: 'rgba(0,0,0,0.55)',
        minWidth: 18,
      }}
    >
      {label}
    </span>
  );
}


export interface MinistryAnnual {
  year: number;
  seaLevel?: number;
  surfaceArea?: number;
  volume?: number;
  salinity?: number;
  riverInflow?: number;
  cottonHarvest?: number;
  irrigatedArea?: number;
  tempAnomaly?: number;
}

interface Props {
  waterLevel: number;
  onWaterLevelChange: (v: number) => void;
  onExit: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  annualData?: MinistryAnnual[];
}

const MIN = -10;
const MAX = 100;

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
  return `hsl(${best} 100% 55%)`;
}

type SeriesKey = 'seaLevel' | 'volume' | 'surfaceArea' | 'salinity' | 'riverInflow' | 'cottonHarvest' | 'irrigatedArea' | 'tempAnomaly';

const SERIES: { key: SeriesKey; label: string; axis: 'left' | 'right'; color: string }[] = [
  { key: 'seaLevel',      label: 'Sea Level (m)',     axis: 'left',  color: '#7dd3fc' },
  { key: 'volume',        label: 'Volume (km³)',      axis: 'left',  color: '#ffffff' },
  { key: 'surfaceArea',   label: 'Area (km²)',        axis: 'left',  color: '#9ca3af' },
  { key: 'riverInflow',   label: 'River Inflow',      axis: 'left',  color: '#34d399' },
  { key: 'salinity',      label: 'Salinity (g/L)',    axis: 'right', color: '#f472b6' },
  { key: 'cottonHarvest', label: 'Cotton Harvest',    axis: 'right', color: '#fde047' },
  { key: 'irrigatedArea', label: 'Irrigated Area',    axis: 'right', color: '#fb923c' },
  { key: 'tempAnomaly',   label: 'Temp Anomaly',      axis: 'right', color: '#ef4444' },
];

const MinistryHUD = ({ waterLevel, onWaterLevelChange, onExit, onPrev, onNext, annualData = [] }: Props) => {
  const [scheme] = useDesignerScheme();

  // Override water with a contrasting color, restore on exit.
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
  const bgColor = scheme.sceneBackground ?? scheme.background;
  const stops = (scheme.terrainStops && scheme.terrainStops.length > 1)
    ? scheme.terrainStops
    : [scheme.water, scheme.land, scheme.vegetation, scheme.alert];
  // pick contrast: if bg is dark use white-ish, else black-ish
  const bgLum = (() => {
    const [, , l] = hexToHsl(bgColor.startsWith('#') ? bgColor : '#000000');
    return l;
  })();
  const contrastColor = bgLum < 0.5 ? '#f5f5f5' : '#111111';
  // pick the brightest-contrast terrain stop for the arrows
  const arrowColor = useMemo(() => {
    let best = stops[0];
    let bestD = -1;
    for (const c of stops) {
      const [, , l] = hexToHsl(c);
      const d = Math.abs(l - bgLum);
      if (d > bestD) { bestD = d; best = c; }
    }
    return best;
  }, [stops, bgLum]);

  // Big-number overlay while dragging
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const flashBig = () => {
    setDragging(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setDragging(false), 900);
  };

  // Compute "year for this level" with future / — rules
  const latest = useMemo(() => {
    const ys = annualData.filter(r => r.seaLevel != null);
    return ys.length ? ys.reduce((a, b) => (a.year > b.year ? a : b)) : null;
  }, [annualData]);

  const bigLabel = useMemo(() => {
    if (waterLevel > 53.0) return '—';                       // above the pre-1960 baseline
    if (latest && latest.seaLevel != null && waterLevel < latest.seaLevel - 0.05) return 'future?';
    if (!annualData.length) return '—';
    let best = annualData[0];
    let bestDist = Infinity;
    for (const r of annualData) {
      if (r.seaLevel == null) continue;
      const d = Math.abs(r.seaLevel - waterLevel);
      if (d < bestDist) { bestDist = d; best = r; }
    }
    return String(best.year);
  }, [waterLevel, annualData, latest]);

  // Series visibility toggles
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    seaLevel: true,
    volume: true,
    surfaceArea: false,
    salinity: true,
    riverInflow: true,
    cottonHarvest: false,
    irrigatedArea: false,
    tempAnomaly: false,
  });
  const [panelOpen, setPanelOpen] = useState(true);

  // Gamepad controls — right stick Y adjusts water level; LB/RB navigate levels.
  // No exit binding, no panel-toggle binding, no d-pad / vertical camera.
  const { stateRef } = useGamepad();
  const waterLevelRef = useRef(waterLevel);
  useEffect(() => { waterLevelRef.current = waterLevel; }, [waterLevel]);
  useEffect(() => {
    let raf = 0;
    let prev = { lb: false, rb: false };
    let lastT = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const s = stateRef.current;
      if (s.connected) {
        // right stick Y = slider (up = higher water)
        const axis = -s.rightStick.y;
        if (Math.abs(axis) > 0.05) {
          const next = Math.max(MIN, Math.min(MAX, waterLevelRef.current + axis * 25 * dt));
          if (Math.abs(next - waterLevelRef.current) > 0.001) {
            waterLevelRef.current = next;
            onWaterLevelChange(next);
            flashBig();
            sfx.slider();
          }
        }
        // edge-triggered level nav
        if (s.buttons.rb && !prev.rb && onNext) { sfx.navNext(); onNext(); }
        if (s.buttons.lb && !prev.lb && onPrev) { sfx.navPrev(); onPrev(); }
        prev = { lb: s.buttons.lb, rb: s.buttons.rb };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNext, onPrev]);


  const chartData = useMemo(
    () => annualData.filter((r) => r.year != null),
    [annualData],
  );

  const nearestYear = useMemo(() => {
    if (!annualData.length) return null;
    let best = annualData[0];
    let bestDist = Infinity;
    for (const r of annualData) {
      if (r.seaLevel == null) continue;
      const d = Math.abs(r.seaLevel - waterLevel);
      if (d < bestDist) { bestDist = d; best = r; }
    }
    return best.year;
  }, [annualData, waterLevel]);

  return (
    <>
      {/* Exit (top-left) */}
      <div className="absolute top-5 left-5 z-40">
        <button
          onClick={() => { sfx.exit(); onExit(); }}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/80 bg-black/70 border border-white/20 hover:bg-black/90 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> exit
        </button>
      </div>

      {/* Level 2 manifesto headline — terrain-colored, top */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[92vw] text-center pointer-events-none px-6">
        <div
          style={{
            fontFamily: '"Georgia", "Times New Roman", serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(22px, 3.2vw, 44px)',
            lineHeight: 1.15,
            letterSpacing: '0.01em',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          {(() => {
            const text = 'How should ecological data be communicated… or experienced?';
            return text.split(/(\s+)/).map((tok, i) => {
              if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
              const c = stops[i % stops.length];
              return <span key={i} style={{ color: c }}>{tok}</span>;
            });
          })()}
        </div>
      </div>

      {/* Level title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">level 2</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/90">
          Great Water Level
        </h1>
      </div>

      {/* Large naked arrows — bright terrain stop color */}
      {onPrev && (
        <button
          onClick={() => { sfx.navPrev(); onPrev(); }}
          aria-label="previous level"
          className="fixed left-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity"
          style={{ color: arrowColor, filter: `drop-shadow(0 0 10px ${bgColor})` }}
        >
          <ChevronLeft style={{ width: 140, height: 140 }} strokeWidth={4} />
          <PadHint label="LB" color={arrowColor} />
        </button>
      )}
      <button
        onClick={() => { if (onNext) { sfx.navNext(); onNext(); } }}
        disabled={!onNext}
        aria-label="next level"
        className="fixed right-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
        style={{ color: arrowColor, filter: `drop-shadow(0 0 10px ${bgColor})` }}
      >
        <ChevronRight style={{ width: 140, height: 140 }} strokeWidth={4} />
        <PadHint label="RB" color={arrowColor} />
      </button>


      {/* Big year number overlay while dragging */}
      {dragging && (
        <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/50 mb-2">year</div>
            <div
              className="font-mono font-extralight leading-none"
              style={{
                fontSize: 'clamp(96px, 16vw, 220px)',
                color: waterColor,
                textShadow: '0 0 60px rgba(0,0,0,0.7)',
              }}
            >
              {bigLabel}
            </div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-white/60 mt-3">
              {waterLevel.toFixed(2)} m
            </div>
          </div>
        </div>
      )}


      {/* Vertical slider with labels */}
      <div className="fixed right-[180px] top-1/2 -translate-y-1/2 z-40 select-none flex items-stretch gap-4">
        <div className="relative h-[72vh] w-32 text-right pointer-events-none">
          {TICKS.map((t) => {
            const pct = 1 - (t.v - MIN) / (MAX - MIN);
            return (
              <div
                key={t.v}
                className="absolute right-0 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.15em] whitespace-nowrap"
                style={{ top: `${pct * 100}%`, color: waterColor }}
              >
                <span className="inline-block w-3 border-t align-middle mr-2" style={{ borderColor: waterColor, opacity: 0.5 }} />
                {t.label}
              </div>
            );
          })}
        </div>
        <div className="relative h-[72vh] w-16 flex items-center justify-center">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <PadHint label="R-stick Y" color={waterColor} />
          </div>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/15 pointer-events-none" />
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={0.01}
            value={waterLevel}
            onPointerDown={flashBig}
            onPointerUp={flashBig}
            onChange={(e) => {
              flashBig();
              sfx.slider();
              onWaterLevelChange(Number(e.target.value));
            }}
            aria-label="value"
            className="ministry-slider"
            style={{
              writingMode: 'vertical-lr' as any,
              WebkitAppearance: 'slider-vertical' as any,
              height: '72vh',
              width: 56,
              direction: 'rtl',
              cursor: 'ns-resize',
              accentColor: waterColor,
              background: 'transparent',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>
      </div>

      {/* Graph panel (bottom-left) — matches map bg; text is its opposite */}
      <div
        className="fixed bottom-6 left-6 z-40 w-[460px] backdrop-blur-md"
        style={{
          background: bgColor,
          color: contrastColor,
          border: `1px solid ${contrastColor}26`,
          fontFamily: '"Georgia", "Times New Roman", serif',
        }}
      >
        <div className="flex items-baseline justify-between px-5 py-3" style={{ borderBottom: panelOpen ? `1px solid ${contrastColor}1f` : 'none' }}>
          <div className="text-base italic tracking-wide" style={{ color: contrastColor }}>Historical Data</div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] tracking-wide" style={{ fontFamily: '"Courier New", monospace', color: contrastColor, opacity: 0.6 }}>
              {nearestYear ?? '—'} · {waterLevel.toFixed(1)} m
            </div>
            <button
              onClick={() => { sfx.toggle(); setPanelOpen((o) => !o); }}
              aria-label={panelOpen ? 'minimize' : 'expand'}
              className="p-1 hover:opacity-70 transition-opacity"
              style={{ color: contrastColor }}
            >
              {panelOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {panelOpen && (
          <>
            {/* Toggle chips */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-3">
              {SERIES.map((s) => {
                const on = visible[s.key];
                return (
                  <button
                    key={s.key}
                    onClick={() => { sfx.toggle(); setVisible((v) => ({ ...v, [s.key]: !v[s.key] })); }}
                    className="flex items-center gap-1.5 py-0.5 text-[12px] italic transition-opacity"
                    style={{
                      color: on ? s.color : `${contrastColor}66`,
                      fontFamily: '"Georgia", serif',
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: on ? s.color : 'transparent', border: `1px solid ${on ? s.color : `${contrastColor}55`}` }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="h-44 px-2 pb-3 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fill: contrastColor, fontSize: 9, opacity: 0.7 }} axisLine={{ stroke: contrastColor, opacity: 0.2 }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: contrastColor, fontSize: 9, opacity: 0.7 }} axisLine={{ stroke: contrastColor, opacity: 0.2 }} tickLine={false} width={28} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: contrastColor, fontSize: 9, opacity: 0.7 }} axisLine={{ stroke: contrastColor, opacity: 0.2 }} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: bgColor, border: `1px solid ${contrastColor}30`, fontSize: 10, color: contrastColor }} labelStyle={{ color: contrastColor }} />
                  {SERIES.filter((s) => visible[s.key]).map((s) => (
                    <Line
                      key={s.key}
                      yAxisId={s.axis}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={1.2}
                      dot={false}
                      isAnimationActive={false}
                      name={s.label}
                    />
                  ))}
                  {nearestYear != null && (
                    <ReferenceLine yAxisId="left" x={nearestYear} stroke={contrastColor} strokeDasharray="2 2" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

    </>
  );
};

export default MinistryHUD;
