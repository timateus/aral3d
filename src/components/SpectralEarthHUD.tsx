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

const SpectralEarthHUD = ({ onExit, onRandomize, onNext, randomSeed = 0 }: Props) => {
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

    // Composite the manifesto text ON TOP of the map image, baked into a single PNG.
    const W = canvas.width;
    const H = canvas.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);

    // helper: draw colorized words centered, returns next y
    const drawColorized = (
      text: string,
      offset: number,
      y: number,
      fontPx: number,
      fontFamily: string,
      weight: string,
      italic: string,
      transform: string,
      tracking: number,
    ) => {
      const display = transform === 'uppercase' ? text.toUpperCase()
        : transform === 'lowercase' ? text.toLowerCase()
        : text;
      ctx.font = `${italic === 'italic' ? 'italic ' : ''}${weight} ${fontPx}px ${fontFamily}`;
      ctx.textBaseline = 'top';
      const tokens = display.split(/(\s+)/);
      // measure total width including tracking
      const trackPx = tracking * fontPx;
      let total = 0;
      for (const tok of tokens) {
        if (!tok) continue;
        total += ctx.measureText(tok).width + trackPx * tok.length;
      }
      let x = (W - total) / 2;
      let idx = 0;
      for (const tok of tokens) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) {
          x += ctx.measureText(tok).width + trackPx * tok.length;
          continue;
        }
        const c = stops[(idx + offset) % stops.length];
        ctx.fillStyle = c;
        // soft shadow for readability over any terrain
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = Math.max(4, fontPx * 0.12);
        ctx.fillText(tok, x, y);
        ctx.shadowBlur = 0;
        x += ctx.measureText(tok).width + trackPx * tok.length;
        idx++;
      }
      return y + fontPx * 1.15;
    };

    // Vertically centered manifesto, scaled to image width.
    const f1 = Math.round(W * 0.045);
    const f2 = Math.round(W * 0.024);
    const blockH = f1 * 1.15 + f2 * 1.15 + f1 * 0.5;
    let y = (H - blockH) / 2;
    y = drawColorized(line1, 0, y, f1, style.font1, style.weight1, style.style1, style.case1, style.tracking1);
    y += f1 * 0.35;
    drawColorized(line2, 3, y, f2, style.font2, style.weight2, style.style2, style.case2, style.tracking2);

    // Footer baked into image: Aral School 2026
    const footPx = Math.round(W * 0.014);
    ctx.font = `${footPx}px "Courier New", monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 6;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ARAL SCHOOL 2026', Math.round(W * 0.03), H - Math.round(W * 0.02));
    const rightLabel = 'SPECTRAL EARTH';
    const rw = ctx.measureText(rightLabel).width;
    ctx.fillText(rightLabel, W - Math.round(W * 0.03) - rw, H - Math.round(W * 0.02));
    // swatches
    const sw = Math.round(W * 0.014);
    const swY = H - Math.round(W * 0.02) - sw + 2;
    const swStartX = Math.round(W / 2 - (stops.length * (sw + 4)) / 2);
    stops.forEach((c, i) => {
      ctx.shadowBlur = 0;
      ctx.fillStyle = c;
      ctx.fillRect(swStartX + i * (sw + 4), swY, sw, sw);
    });
    ctx.shadowBlur = 0;

    const url = out.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!doctype html><html><head><title>Spectral Earth — Aral School 2026</title>
      <style>
        @page { size: auto; margin: 8mm; }
        html,body { margin:0; padding:0; background:#fff; }
        img { display:block; width:100%; height:auto; }
      </style></head>
      <body>
        <img src="${url}" onload="setTimeout(()=>window.print(),300)" />
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
