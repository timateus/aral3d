import { ArrowLeft, ArrowRight, Sparkles, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDesignerScheme } from '@/lib/visual-mode';

interface Props {
  onExit: () => void;
  onRandomize: () => void;
  onNext?: () => void;
  randomSeed?: number;
}

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
const STYLES = ['normal', 'italic'];
const CASES = ['uppercase', 'lowercase', 'none'] as const;

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(Math.abs(Math.sin(seed * 9301 + 49297)) * arr.length) % arr.length];
}

const SpectralEarthHUD = ({ onExit, onRandomize, randomSeed = 0 }: Props) => {
  const [scheme] = useDesignerScheme();
  const stops = scheme.terrainStops && scheme.terrainStops.length > 1
    ? scheme.terrainStops
    : [scheme.water, scheme.land, scheme.vegetation, scheme.alert];

  // Re-randomize fonts/sizes only when randomSeed changes
  const style = useMemo(() => {
    const s = randomSeed || Date.now();
    return {
      font1: pick(FONT_FAMILIES, s + 1),
      font2: pick(FONT_FAMILIES, s + 2),
      weight1: pick(WEIGHTS, s + 3),
      weight2: pick(WEIGHTS, s + 4),
      style1: pick(STYLES, s + 5),
      style2: pick(STYLES, s + 6),
      case1: pick(CASES, s + 7),
      case2: pick(CASES, s + 8),
      size1: 36 + (Math.abs(Math.sin(s * 1.7)) * 56), // 36-92px
      size2: 18 + (Math.abs(Math.sin(s * 2.3)) * 26), // 18-44px
      tracking1: -0.02 + Math.abs(Math.sin(s * 3.1)) * 0.12,
      tracking2: -0.01 + Math.abs(Math.sin(s * 4.7)) * 0.1,
    };
  }, [randomSeed]);

  const line1 = 'maps are not neutral, fixed, or purely scientific';
  const line2 = 'make it strange, unstable, playful, open to interpretation';

  // Color each word from terrain stops
  const colorize = (text: string, offset: number) =>
    text.split(/(\s+)/).map((tok, i) => {
      if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
      const c = stops[(i + offset) % stops.length];
      return <span key={i} style={{ color: c }}>{tok}</span>;
    });

  const handlePrint = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) return;
    const swatches = stops
      .map((c) => `<span style="display:inline-block;width:14px;height:14px;background:${c};margin:0 2px;vertical-align:middle;"></span>`)
      .join('');
    const wordsHtml = (text: string, offset: number) =>
      text
        .split(/(\s+)/)
        .map((tok, i) => {
          if (/^\s+$/.test(tok)) return tok;
          const c = stops[(i + offset) % stops.length];
          return `<span style="color:${c}">${tok}</span>`;
        })
        .join('');
    w.document.write(`
      <!doctype html><html><head><title>Spectral Earth — Aral School 2026</title>
      <style>
        @page { size: auto; margin: 12mm; }
        html,body { margin:0; padding:0; background:#fff; color:#111; font-family: ${style.font1}; }
        .wrap { padding: 8mm; }
        img { display:block; width:100%; height:auto; margin: 6mm 0; }
        .l1 {
          font-family: ${style.font1};
          font-weight: ${style.weight1};
          font-style: ${style.style1};
          text-transform: ${style.case1};
          font-size: ${Math.round(style.size1 * 0.55)}pt;
          letter-spacing: ${style.tracking1}em;
          line-height: 1;
          margin: 0 0 6mm 0;
        }
        .l2 {
          font-family: ${style.font2};
          font-weight: ${style.weight2};
          font-style: ${style.style2};
          text-transform: ${style.case2};
          font-size: ${Math.round(style.size2 * 0.55)}pt;
          letter-spacing: ${style.tracking2}em;
          line-height: 1.2;
          margin: 0 0 4mm 0;
        }
        .foot {
          margin-top: 8mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: "Courier New", monospace;
          font-size: 9pt;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          border-top: 1px solid #111;
          padding-top: 3mm;
        }
      </style></head>
      <body>
        <div class="wrap">
          <div class="l1">${wordsHtml(line1, 0)}</div>
          <div class="l2">${wordsHtml(line2, 3)}</div>
          <img src="${url}" onload="setTimeout(()=>window.print(),300)" />
          <div class="foot">
            <span>Aral School 2026</span>
            <span>${swatches}</span>
            <span>Spectral Earth</span>
          </div>
        </div>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <>
      {/* Centered manifesto, terrain-colored, no animation */}
      <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
        <div className="w-[92vw] text-center px-6">
          <div
            style={{
              fontFamily: style.font1,
              fontWeight: style.weight1 as any,
              fontStyle: style.style1,
              textTransform: style.case1 as any,
              fontSize: `clamp(28px, ${style.size1 / 14}vw, ${Math.round(style.size1 * 1.1)}px)`,
              letterSpacing: `${style.tracking1}em`,
              lineHeight: 0.95,
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {colorize(line1, 0)}
          </div>
          <div
            className="mt-6"
            style={{
              fontFamily: style.font2,
              fontWeight: style.weight2 as any,
              fontStyle: style.style2,
              textTransform: style.case2 as any,
              fontSize: `clamp(16px, ${style.size2 / 14}vw, ${Math.round(style.size2 * 1.1)}px)`,
              letterSpacing: `${style.tracking2}em`,
              lineHeight: 1.2,
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {colorize(line2, 3)}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-foreground/90 drop-shadow">
          Spectral Earth
        </h1>
        <div className="mt-2 h-px w-16 mx-auto bg-foreground/30" />
      </div>

      {/* Back button — constant font, readable on black */}
      <button
        onClick={onExit}
        className="absolute top-5 left-5 z-40 flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:brightness-110"
        style={{
          border: `2px solid ${stops[1 % stops.length]}`,
          background: 'rgba(0,0,0,0.65)',
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" style={{ color: stops[1 % stops.length] }} /> Menu
      </button>

      {/* Bottom action buttons — constant font/size, readable on black */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
        <button
          onClick={onRandomize}
          className="group flex items-center gap-3 px-8 py-4 text-base font-semibold font-mono uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
          style={{
            border: `3px solid ${stops[2 % stops.length]}`,
            background: 'rgba(0,0,0,0.7)',
            boxShadow: `0 0 24px ${stops[1 % stops.length]}55`,
          }}
        >
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" style={{ color: stops[2 % stops.length] }} />
          Make it misbehave
        </button>
        <button
          onClick={handlePrint}
          className="group flex items-center gap-3 px-6 py-4 text-sm font-semibold font-mono uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
          style={{
            border: `3px solid ${stops[0]}`,
            background: 'rgba(0,0,0,0.7)',
            boxShadow: `0 0 24px ${stops[0]}55`,
          }}
        >
          <Printer className="w-4 h-4" style={{ color: stops[0] }} />
          Own it
        </button>
      </div>
    </>
  );
};

export default SpectralEarthHUD;
