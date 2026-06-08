import { ArrowLeft, ArrowRight, Sparkles, Printer, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { useDesignerScheme } from '@/lib/visual-mode';
import { sfx } from '@/lib/ui-sfx';
import { useGamepad } from '@/hooks/useGamepad';
import { consumeGamepadButton } from '@/lib/gamepad-dedupe';


function bgIsLight(hex: string): boolean {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 0.55;
}

function PadHint({ label, color, bg }: { label: string; color: string; bg: string }) {
  const ink = bgIsLight(bg) ? '#0a0a0a' : '#ffffff';
  return (
    <span
      className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold leading-none rounded"
      style={{
        border: `1.5px solid ${ink}`,
        color: ink,
        background: bg,
        minWidth: 18,
      }}
    >
      {label}
    </span>
  );
}


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
  const bgColor = scheme.sceneBackground ?? scheme.background ?? '#000000';
  const inkColor = bgIsLight(bgColor) ? '#0a0a0a' : '#ffffff';

  const { stateRef } = useGamepad();



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
      size2: 20 + (Math.abs(Math.sin(s * 2.3)) * 10), // 20-30px
      tracking1: Math.abs(Math.sin(s * 3.1)) * 0.035,
      tracking2: Math.abs(Math.sin(s * 4.7)) * 0.03,
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

  const handlePrint = async () => {
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
      ctx.textBaseline = 'top';
      const tokens = display.split(/(\s+)/);
      const measure = (px: number) => {
        ctx.font = `${italic === 'italic' ? 'italic ' : ''}${weight} ${px}px ${fontFamily}`;
        const track = tracking * px;
        return tokens.reduce((sum, tok) => sum + (tok ? ctx.measureText(tok).width + track * tok.length : 0), 0);
      };
      const maxWidth = W * 0.88;
      let actualPx = fontPx;
      let total = measure(actualPx);
      if (total > maxWidth) {
        actualPx = Math.max(14, Math.floor(actualPx * (maxWidth / total)));
        total = measure(actualPx);
      }
      const trackPx = tracking * actualPx;
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
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = Math.max(4, actualPx * 0.12);
        ctx.fillText(tok, x, y);
        ctx.shadowBlur = 0;
        x += ctx.measureText(tok).width + trackPx * tok.length;
        idx++;
      }
      return y + actualPx * 1.15;
    };

    const f1 = Math.round(W * 0.036);
    const f2 = Math.round(W * 0.021);
    const blockH = f1 * 1.15 + f2 * 1.15 + f1 * 0.5;
    let y = (H - blockH) / 2;
    y = drawColorized(line1, 0, y, f1, style.font1, style.weight1, style.style1, style.case1, style.tracking1);
    y += f1 * 0.35;
    drawColorized(line2, 3, y, f2, style.font2, style.weight2, style.style2, style.case2, style.tracking2);

    // Footer
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

    // --- Upload to shared-cards bucket + build /share/:id URL + QR ---
    let shareUrl = '';
    let qrDataUrl = '';
    try {
      const id = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const blob = await (await fetch(url)).blob();
      const { error } = await supabase.storage
        .from('shared-cards')
        .upload(`${id}.png`, blob, { contentType: 'image/png', upsert: false });
      if (!error) {
        shareUrl = `${window.location.origin}/share/${id}`;
        qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
      }
    } catch (e) {
      console.warn('[print] share upload failed', e);
    }

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!doctype html><html><head><title>Spectral Earth — Aral School 2026</title>
      <style>
        @page { size: landscape; margin: 6mm; }
        html,body { margin:0; padding:0; background:#fff; font-family: "Courier New", monospace; }
        .page { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
        .map { display:block; width:100%; height:100%; object-fit: contain; }
        .share {
          position: absolute; right: 4mm; bottom: 4mm;
          background: #fff; padding: 6px 8px;
          border: 1.5px solid #000; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 1px 0 #000;
        }
        .share img { width: 96px; height: 96px; display: block; }
        .share .meta { font-size: 9px; line-height: 1.3; max-width: 110px; }
        .share .meta b { display: block; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
        .share .meta a { color: #000; text-decoration: none; word-break: break-all; }
      </style></head>
      <body>
        <div class="page">
          <img class="map" src="${url}" onload="setTimeout(()=>window.print(),400)" />
          ${qrDataUrl ? `
            <div class="share">
              <img src="${qrDataUrl}" alt="QR" />
              <div class="meta">
                <b>Share to Instagram</b>
                Scan, then tap Share on your phone.
                <a href="${shareUrl}">${shareUrl.replace(/^https?:\/\//, '')}</a>
              </div>
            </div>
          ` : ''}
        </div>
      </body></html>
    `);
    w.document.close();
  };


  // Gamepad: X = make it misbehave, LB = prev level, RB = next level.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = stateRef.current;
      if (s.connected) {
        if (consumeGamepadButton('x', s.buttons.x)) { sfx.make(); onRandomize(); }
        if (consumeGamepadButton('rb', s.buttons.rb) && onNext) { sfx.navNext(); onNext(); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRandomize, onNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') {
        e.preventDefault(); sfx.make(); onRandomize();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault(); sfx.navNext(); onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRandomize, onNext]);

  return (

    <>
      {/* Centered manifesto, terrain-colored, no animation */}
      <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
        <div className="w-[92vw] text-center px-6">
          <div
            style={{
              fontFamily: style.font1,
              fontWeight: style.weight1,
              fontStyle: style.style1,
              textTransform: style.case1,
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
              fontWeight: style.weight2,
              fontStyle: style.style2,
              textTransform: style.case2,
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
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-foreground/50">level 1</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-foreground/90 drop-shadow">
          Spectral Earth
        </h1>
        <div className="mt-2 h-px w-16 mx-auto bg-foreground/30" />
      </div>

      {/* Back button — uses map bg color */}
      <button
        onClick={() => { sfx.exit(); onExit(); }}
        className="absolute top-5 left-5 z-40 flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-colors hover:brightness-110"
        style={{
          border: `2px solid ${stops[1 % stops.length]}`,
          background: bgColor,
          color: inkColor,
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" style={{ color: stops[1 % stops.length] }} /> Menu
      </button>

      {/* Bottom action buttons — bg = map background */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-end gap-4">
        <button
          onClick={() => { sfx.make(); onRandomize(); }}
          className="group flex items-center gap-4 px-12 py-6 text-2xl md:text-3xl font-extrabold font-mono uppercase tracking-[0.2em] backdrop-blur-md transition-all hover:brightness-110 hover:scale-105"
          style={{
            border: `4px solid ${stops[2 % stops.length]}`,
            background: bgColor,
            color: inkColor,
            boxShadow: `0 0 36px ${stops[1 % stops.length]}88`,
          }}
        >
          <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" style={{ color: stops[2 % stops.length] }} />
          Make it misbehave
          <PadHint label="X" color={stops[2 % stops.length]} bg={bgColor} />
        </button>
        <button
          onClick={() => { sfx.make(); handlePrint(); }}
          className="group flex items-center gap-2 px-3 py-2 text-[11px] font-medium font-mono uppercase tracking-[0.18em] backdrop-blur-md transition-all hover:brightness-110"
          style={{
            border: `1px solid ${stops[0]}`,
            background: bgColor,
            color: inkColor,
          }}
          title="Print this map"
        >
          <Printer className="w-3 h-3" style={{ color: stops[0] }} />
          Print Earth
        </button>
      </div>

      {/* Edge right nav — same bare style as Level 2 */}
      {onNext && (() => {
        // pick brightest-contrast stop vs page bg (level 1 page is light/cream by default,
        // but we approximate by simply taking the most saturated/dark stop)
        const arrowColor = stops[2 % stops.length] || stops[0];
        return (
          <button
            onClick={() => { sfx.navNext(); onNext(); }}
            aria-label="next level"
            className="fixed right-2 top-1/2 -translate-y-1/2 z-[70] flex flex-col items-center justify-center bg-transparent hover:opacity-70 transition-opacity"
            style={{ color: arrowColor, filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.45))' }}
          >
            <ChevronRight style={{ width: 112, height: 112 }} strokeWidth={2} />
            <PadHint label="RB" color={arrowColor} bg={bgColor} />
          </button>
        );
      })()}
    </>
  );
};

export default SpectralEarthHUD;
