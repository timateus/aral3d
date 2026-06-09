import { useEffect, useMemo, useState } from 'react';
import { useDesignerScheme } from '@/lib/visual-mode';

// Level 7 phrase overlay — Level-1 styled, ONE phrase at a time.
//   - Words colourised from the active terrain stops (like SpectralEarthHUD)
//   - Randomised font family / weight / italic / case / size per phrase
//   - Centered on screen, fades in & out

const FONT_FAMILIES = [
  '"Times New Roman", serif',
  '"Georgia", serif',
  '"Courier New", monospace',
  '"Impact", sans-serif',
  '"Helvetica Neue", Arial, sans-serif',
  '"Brush Script MT", cursive',
  '"Trebuchet MS", sans-serif',
  '"Palatino", serif',
  '"Verdana", sans-serif',
  '"Lucida Console", monospace',
];
const WEIGHTS = ['300', '400', '700', '900'];
const STYLES = ['normal', 'italic'] as const;
const CASES = ['uppercase', 'lowercase', 'none'] as const;

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(Math.abs(Math.sin(seed * 9301 + 49297)) * arr.length) % arr.length];
}

interface PhraseDetail { text: string }
interface ShownPhrase {
  id: number;
  text: string;
  font: string;
  weight: string;
  style: typeof STYLES[number];
  textCase: typeof CASES[number];
  sizePx: number;
  tracking: number;
}

// Data-layer card shown while ☝ index-finger gesture is held.
const LAYERS = [
  { name: 'Canals',           desc: 'Soviet-era irrigation channels that bled the Aral Sea dry — over 40,000 km cut through cotton fields.' },
  { name: 'Demographics',     desc: 'Karakalpakstan holds ~1.9M people; out-migration from the shore rose sharply after the 1990s collapse.' },
  { name: 'Schools (TDS)',    desc: 'Schools colour-coded by Total Dissolved Solids. Green = safe; red = above WHO salinity limits.' },
  { name: 'Groundwater',      desc: 'Pillar height = depth to water table. Salinity follows the receding sea — the aquifer is now brackish.' },
  { name: 'Salinity',         desc: 'Soil salinity along the former seabed. Wind lifts the salt into dust storms reaching 500 km inland.' },
  { name: 'Population Density', desc: 'Hex-binned counts. Density clusters along the Amu Darya; the desiccated north is nearly empty.' },
  { name: 'Landcover',        desc: 'Cropland, bare soil, sparse vegetation. The Aralkum is the youngest desert on Earth — born 1960–2010.' },
  { name: 'Rivers & Waterways', desc: 'Stream thickness scales with order and inflow. The Amu Darya rarely reaches the sea anymore.' },
  { name: 'Historical Basins', desc: '13th, 19th, and 21st century shorelines. The sea has retreated and advanced — but never this fast.' },
  { name: 'Maternal Mortality', desc: 'Per 100k live births. Elevated rates linked to salinity, anemia, and contaminated water.' },
  { name: 'Sewage Coverage',  desc: 'Share of households connected to sanitation. Coverage drops sharply outside Nukus.' },
  { name: 'Migration',        desc: 'Net arrivals vs. emigrants. The Aral shore has lost more than 100,000 residents since 1991.' },
];

export const FacePhraseLayer = () => {
  const [scheme] = useDesignerScheme();
  const stops = useMemo(() => (
    scheme.terrainStops && scheme.terrainStops.length > 1
      ? scheme.terrainStops
      : [scheme.water, scheme.land, scheme.vegetation, scheme.alert]
  ), [scheme]);

  const [phrase, setPhrase] = useState<ShownPhrase | null>(null);
  const [layer, setLayer] = useState<{ name: string; desc: string } | null>(null);

  useEffect(() => {
    let idCounter = 0;
    let hideTimer: number | undefined;

    const onPhrase = (e: Event) => {
      const { text } = (e as CustomEvent<PhraseDetail>).detail;
      if (!text) return;
      const s = Date.now() + (++idCounter);
      const p: ShownPhrase = {
        id: idCounter,
        text,
        font: pick(FONT_FAMILIES, s + 1),
        weight: pick(WEIGHTS, s + 2),
        style: pick(STYLES, s + 3),
        textCase: pick(CASES, s + 4),
        sizePx: 36 + Math.abs(Math.sin(s * 1.7)) * 56, // 36-92
        tracking: Math.abs(Math.sin(s * 3.1)) * 0.04,
      };
      setPhrase(p);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setPhrase(null), 3200);
    };
    const onFingerUp = (e: Event) => {
      const { active } = (e as CustomEvent).detail;
      if (active) setLayer(LAYERS[Math.floor(Math.random() * LAYERS.length)]);
      else setLayer(null);
    };
    window.addEventListener('face:phrase', onPhrase);
    window.addEventListener('face:fingerup', onFingerUp);
    return () => {
      window.removeEventListener('face:phrase', onPhrase);
      window.removeEventListener('face:fingerup', onFingerUp);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  const renderColorized = (text: string, offset: number) =>
    text.split(/(\s+)/).map((tok, i) => {
      if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
      const c = stops[(i + offset) % stops.length];
      return <span key={i} style={{ color: c, textShadow: '0 2px 18px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)' }}>{tok}</span>;
    });

  return (
    <>
      {phrase && (
        <div
          key={phrase.id}
          className="fixed inset-0 z-[45] pointer-events-none flex items-center justify-center animate-fade-in"
        >
          <div
            className="w-[92vw] text-center px-6"
            style={{
              fontFamily: phrase.font,
              fontWeight: phrase.weight as any,
              fontStyle: phrase.style,
              textTransform: phrase.textCase as any,
              letterSpacing: `${phrase.tracking}em`,
              fontSize: `clamp(28px, ${phrase.sizePx / 14}vw, ${Math.round(phrase.sizePx * 1.1)}px)`,
              lineHeight: 1.05,
            }}
          >
            {renderColorized(phrase.text, phrase.id)}
          </div>
        </div>
      )}

      {layer && (
        <div
          className="fixed left-1/2 top-1/2 z-[44] -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-scale-in"
          style={{ maxWidth: 'min(560px, 80vw)' }}
        >
          <div className="px-6 py-5 rounded-md bg-black/75 backdrop-blur-md border border-white/20">
            <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/60 mb-2">☝ data layer</div>
            <div className="text-3xl font-bold text-white mb-3" style={{ fontFamily: '"Impact", sans-serif', letterSpacing: '0.02em' }}>
              {layer.name}
            </div>
            <div className="text-sm text-white/85 leading-relaxed" style={{ fontFamily: '"Georgia", serif' }}>
              {layer.desc}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FacePhraseLayer;
