import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  waterLevel: number;
  onWaterLevelChange: (v: number) => void;
  onExit: () => void;
}

// Slider range tuned to the project's water level (-10..100m).
const MIN = -10;
const MAX = 100;

// Intermediate labels positioned at fractional values (0 = bottom/MAX-land, 1 = top/MIN-water).
// Note: visually slider is vertical with sea at top, land at bottom.
const LABELS: { t: number; text: string }[] = [
  { t: 0.0, text: 'LET THERE BE SEA' },
  { t: 0.15, text: 'planet soup' },
  { t: 0.3, text: 'actual sea' },
  { t: 0.45, text: 'sea cosplay' },
  { t: 0.6, text: 'former sea' },
  { t: 0.78, text: 'puddle' },
  { t: 0.9, text: 'dust' },
  { t: 1.0, text: 'MAKE IT LAND' },
];

const MESSAGES = [
  'Congratulations. You have solved water politics with a slider.',
  'Adding 4 billion cubic meters of confidence…',
  'Please wait while the desert reconsiders.',
  'Hydrology has left the chat.',
  'Local fish are confused but optimistic.',
  'Removing sea. This has happened before.',
  'Careful. The map is getting thirsty.',
  'Congratulations, you invented a port without water.',
  'A committee has been formed to study the slider.',
  'Evaporation has been outsourced to a subcontractor.',
  'The cartographers are filing a complaint.',
  'Minor flooding reported in the legend.',
  'Sea levels adjusted. Reality, pending.',
  'Memo: please stop moving the sea during meetings.',
];

const MinistryHUD = ({ waterLevel, onWaterLevelChange, onExit }: Props) => {
  // Slider is vertical, top = high water (MAX) -> bottom = low water (MIN).
  // We bind a horizontal range input and rotate via CSS for browser compatibility.
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKey, setMsgKey] = useState(0);
  const lastChangeRef = useRef<number>(0);

  // Show a random absurd message when slider value changes (debounced).
  useEffect(() => {
    const now = Date.now();
    lastChangeRef.current = now;
    const handle = window.setTimeout(() => {
      if (lastChangeRef.current !== now) return;
      const m = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      setMsg(m);
      setMsgKey((k) => k + 1);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [waterLevel]);

  // Auto-clear the message after a few seconds.
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [msgKey, msg]);

  return (
    <>
      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <h1 className="text-2xl font-extralight tracking-[0.35em] uppercase text-white drop-shadow">
          Ministry of Sea Adjustment
        </h1>
        <div className="mt-2 h-px w-20 mx-auto bg-white/30" />
        <p className="mt-2 text-[10px] font-mono tracking-[0.25em] uppercase text-white/60">
          Department of Hydrological Vibes
        </p>
      </div>

      {/* Back button */}
      <button
        onClick={onExit}
        className="absolute top-5 left-5 z-40 flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] text-white backdrop-blur-md bg-black/65 border-2 border-white/40 hover:bg-black/80 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Menu
      </button>

      {/* Vertical slider — fixed right side */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40 flex items-stretch gap-4 select-none">
        {/* Label column */}
        <div className="relative w-44 h-[70vh] pointer-events-none">
          {LABELS.map((l) => {
            const isMajor = l.text === 'LET THERE BE SEA' || l.text === 'MAKE IT LAND';
            return (
              <div
                key={l.text}
                className="absolute right-0 -translate-y-1/2 text-right whitespace-nowrap"
                style={{ top: `${l.t * 100}%` }}
              >
                {isMajor ? (
                  <span className="text-white text-sm font-mono font-bold tracking-[0.25em] uppercase drop-shadow">
                    {l.text}
                  </span>
                ) : (
                  <span className="text-white/70 text-[11px] font-mono tracking-[0.2em] lowercase">
                    {l.text}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Slider column */}
        <div className="relative h-[70vh] w-12 flex items-center justify-center">
          {/* Tick marks */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/20" />
          {LABELS.map((l) => (
            <div
              key={`tick-${l.text}`}
              className="absolute left-1/2 -translate-x-1/2 h-px bg-white/50"
              style={{ top: `${l.t * 100}%`, width: l.t === 0 || l.t === 1 ? 28 : 16 }}
            />
          ))}

          {/* Rotated range input — visually vertical, top = sea (MAX), bottom = land (MIN). */}
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={waterLevel}
            onChange={(e) => onWaterLevelChange(Number(e.target.value))}
            aria-label="Sea level"
            className="ministry-slider"
            style={{
              // Rotate so input length becomes the vertical extent.
              writingMode: 'vertical-lr' as any,
              WebkitAppearance: 'slider-vertical' as any,
              height: '70vh',
              width: 28,
              direction: 'rtl',
              cursor: 'ns-resize',
              accentColor: '#7dd3fc',
            }}
          />
        </div>

        {/* Current value readout */}
        <div className="self-start mt-1 text-white/80 font-mono text-[11px] tracking-[0.2em] uppercase">
          <div className="text-white/40">level</div>
          <div className="text-base text-white">{waterLevel} m</div>
        </div>
      </div>

      {/* Absurd system message */}
      {msg && (
        <div
          key={msgKey}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 max-w-[80vw] px-6 py-3 bg-black/80 border border-white/30 backdrop-blur-md text-white font-mono text-sm tracking-wide text-center shadow-2xl"
          style={{ animation: 'ministryFade 3.2s ease-out forwards' }}
        >
          <span className="text-white/40 mr-2">SYSTEM:</span>
          {msg}
        </div>
      )}

      <style>{`
        @keyframes ministryFade {
          0% { opacity: 0; transform: translate(-50%, 8px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -4px); }
        }
      `}</style>
    </>
  );
};

export default MinistryHUD;
