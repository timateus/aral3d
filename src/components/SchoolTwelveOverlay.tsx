import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Navigation2, X } from 'lucide-react';
import { sfx } from '@/lib/ui-sfx';
import { consumeGamepadButton } from '@/lib/gamepad-dedupe';
import schoolFrontAsset from '@/assets/kegeyli-school-front.png.asset.json';
import classroomOneAsset from '@/assets/kegeyli-classroom-1.png.asset.json';
import classroomTwoAsset from '@/assets/kegeyli-classroom-2.png.asset.json';
import studentsCraftAsset from '@/assets/kegeyli-students-craft.png.asset.json';

interface Props {
  onExit: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleAutoWalk: () => void;
  autoWalking: boolean;
  distanceMeters: number;
  arrived: boolean;
  dialogOpen: boolean;
  onDialogOpen: (open: boolean) => void;
}

const photos = [
  { src: schoolFrontAsset.url, alt: 'School 12 front facade in Kegeyli', label: 'school yard' },
  { src: classroomOneAsset.url, alt: 'Students gathered in a classroom at School 12', label: 'classroom' },
  { src: classroomTwoAsset.url, alt: 'Presentation taking place inside School 12', label: 'presentation' },
];

interface MenuItem {
  label: string;
  sub: string;
  href?: string;
  action?: 'close';
  disabled?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Qilqali City', sub: 'qilqalicity.lovable.app', href: 'https://qilqalicity.lovable.app' },
  { label: 'Roar & Guard', sub: 'roar-and-guard.lovable.app', href: 'https://roar-and-guard.lovable.app' },
  { label: 'Star Game', sub: 'buildwithstar.com', href: 'https://buildwithstar.com/games/9e3a5563-082f-4566-a994-1c64a89e91bb' },
  { label: 'Watch the school film', sub: 'coming soon', disabled: true },
  { label: 'Exit', sub: 'back to the map', action: 'close' },
];

const HEADING_FONT = '"Marker Felt", "Comic Sans MS", "Chalkboard SE", "Trebuchet MS", system-ui, sans-serif';
const BODY_FONT = '"Comic Sans MS", "Marker Felt", "Chalkboard SE", "Trebuchet MS", sans-serif';
const MENU_FONT = '"Comic Sans MS", "Marker Felt", "Chalkboard SE", system-ui, sans-serif';

// Bright candy palette for menu items — rotates across the list.
const ITEM_COLORS = [
  { bg: '#ff4fb8', border: '#ff4fb8', ink: '#fff7ff' }, // hot pink
  { bg: '#ffd23f', border: '#ffd23f', ink: '#2a1a00' }, // bright yellow
  { bg: '#3ee0a0', border: '#3ee0a0', ink: '#062a18' }, // mint
  { bg: '#9b6dff', border: '#9b6dff', ink: '#fffaff' }, // purple
];

const SchoolDialog = ({ onClose }: { onClose: () => void }) => {
  const [sel, setSel] = useState(0);
  const items = MENU_ITEMS;

  const activate = (i: number) => {
    const it = items[i];
    if (!it || it.disabled) return;
    if (it.action === 'close') { sfx.exit(); onClose(); return; }
    if (it.href) { sfx.make(); window.open(it.href, '_blank', 'noopener,noreferrer'); }
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSel((s) => {
          let n = s;
          for (let i = 0; i < items.length; i++) {
            n = (n + 1) % items.length;
            if (!items[n].disabled) break;
          }
          sfx.navNext();
          return n;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setSel((s) => {
          let n = s;
          for (let i = 0; i < items.length; i++) {
            n = (n - 1 + items.length) % items.length;
            if (!items[n].disabled) break;
          }
          sfx.navPrev();
          return n;
        });
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        activate(sel);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Gamepad navigation.
  useEffect(() => {
    let raf = 0;
    let axisCooldown = 0;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        // D-pad
        if (consumeGamepadButton('sd-up', !!pad.buttons[12]?.pressed, { cooldownMs: 220, ignoreBlock: true })) {
          setSel((s) => {
            let n = s;
            for (let i = 0; i < items.length; i++) {
              n = (n - 1 + items.length) % items.length;
              if (!items[n].disabled) break;
            }
            sfx.navPrev();
            return n;
          });
        }
        if (consumeGamepadButton('sd-down', !!pad.buttons[13]?.pressed, { cooldownMs: 220, ignoreBlock: true })) {
          setSel((s) => {
            let n = s;
            for (let i = 0; i < items.length; i++) {
              n = (n + 1) % items.length;
              if (!items[n].disabled) break;
            }
            sfx.navNext();
            return n;
          });
        }
        // Left stick Y as fallback
        const ly = pad.axes[1] ?? 0;
        if (axisCooldown > 0) axisCooldown--;
        if (axisCooldown === 0 && Math.abs(ly) > 0.55) {
          axisCooldown = 14;
          setSel((s) => {
            let n = s;
            const dir = ly > 0 ? 1 : -1;
            for (let i = 0; i < items.length; i++) {
              n = (n + dir + items.length) % items.length;
              if (!items[n].disabled) break;
            }
            sfx.navNext();
            return n;
          });
        }
        if (consumeGamepadButton('sd-a', !!pad.buttons[0]?.pressed, { cooldownMs: 350, ignoreBlock: true }) ||
            consumeGamepadButton('sd-x', !!pad.buttons[2]?.pressed, { cooldownMs: 350, ignoreBlock: true })) {
          activate(sel);
        }
        if (consumeGamepadButton('sd-b', !!pad.buttons[1]?.pressed, { cooldownMs: 350, ignoreBlock: true })) {
          sfx.exit();
          onClose();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-in fade-in duration-300"
      data-hud
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(255,79,184,0.35), transparent 55%),' +
          'radial-gradient(ellipse at 80% 80%, rgba(62,224,160,0.30), transparent 55%),' +
          'radial-gradient(ellipse at 70% 10%, rgba(255,210,63,0.25), transparent 55%),' +
          'rgba(8,12,28,0.55)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-[min(720px,92vw)] max-h-[92vh] overflow-y-auto rounded-3xl text-white relative"
        style={{
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '3px solid rgba(255,255,255,0.55)',
          boxShadow: '0 20px 80px rgba(255,79,184,0.35), 0 10px 40px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => { sfx.exit(); onClose(); }}
          aria-label="Close student menu"
          className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border-2 border-white/60 text-white hover:bg-black"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="p-5 md:p-6">
            <div
              className="text-[10px] uppercase tracking-[0.35em] mb-2"
              style={{ fontFamily: MENU_FONT, color: '#ffd23f' }}
            >
              ★ school 12 · kegeyli ★
            </div>
            <h2
              className="mb-3"
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 'clamp(24px,3.6vw,40px)',
                lineHeight: 0.95,
                color: '#fff7ff',
                textShadow:
                  '0 0 18px rgba(255,79,184,0.6), 2px 2px 0 #ff4fb8, 4px 4px 0 rgba(0,0,0,0.35)',
                transform: 'rotate(-1.5deg)',
                display: 'inline-block',
              }}
            >
              Play the games we made!
            </h2>
            <p
              className="leading-snug mb-4"
              style={{
                fontFamily: BODY_FONT,
                fontSize: 'clamp(12px,1.1vw,15px)',
                color: '#fffbea',
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              Worlds built by students of School 12 — pick one and explore!
            </p>

            <ul className="space-y-2">
              {items.map((it, i) => {
                const active = i === sel;
                const c = ITEM_COLORS[i % ITEM_COLORS.length];
                const tilt = (i % 2 === 0 ? -1 : 1) * (active ? 0 : 0.8);
                return (
                  <li key={it.label}>
                    <button
                      type="button"
                      disabled={it.disabled}
                      onMouseEnter={() => !it.disabled && setSel(i)}
                      onClick={() => activate(i)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-left transition-all duration-150 ${
                        it.disabled ? 'cursor-not-allowed' : 'hover:-translate-y-0.5'
                      }`}
                      style={
                        it.disabled
                          ? {
                              background: 'rgba(255,255,255,0.06)',
                              border: '2px dashed rgba(255,255,255,0.25)',
                              color: 'rgba(255,255,255,0.4)',
                              transform: `rotate(${tilt}deg)`,
                            }
                          : active
                            ? {
                                background: c.bg,
                                border: `2px solid ${c.border}`,
                                color: c.ink,
                                transform: 'scale(1.02) rotate(0deg)',
                                boxShadow: `0 6px 20px ${c.bg}66, 0 0 0 3px rgba(255,255,255,0.25)`,
                              }
                            : {
                                background: 'rgba(255,255,255,0.10)',
                                border: `2px solid ${c.border}`,
                                color: '#fff7ff',
                                transform: `rotate(${tilt}deg)`,
                                boxShadow: `0 4px 12px ${c.bg}33`,
                              }
                      }
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: MENU_FONT,
                            fontSize: 'clamp(14px,1.4vw,18px)',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                          }}
                        >
                          {it.label}
                        </div>
                        <div
                          className="text-[10px] mt-0.5 opacity-80"
                          style={{ fontFamily: MENU_FONT }}
                        >
                          {it.sub}
                        </div>
                      </div>
                      {it.action === 'close' ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div
              className="mt-4 flex items-center gap-2 text-[10px]"
              style={{ fontFamily: MENU_FONT, color: '#fffbea' }}
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-white/80">▲▼</span>
              <span>navigate</span>
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-white font-bold" style={{ background: '#3b82f6' }}>3</span>
              <span>select</span>
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-white font-bold" style={{ background: '#ef4444' }}>2</span>
              <span>exit</span>
            </div>
          </div>

          <div
            className="p-4 md:p-5 flex flex-col"
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderLeft: '2px dashed rgba(255,255,255,0.35)',
            }}
          >
            <img
              src={studentsCraftAsset.url}
              alt="School 12 students with their hand-painted water-wheel project"
              className="w-full aspect-[3/4] object-cover rounded-2xl"
              style={{
                border: '4px solid #ffd23f',
                boxShadow: '0 12px 40px rgba(255,210,63,0.4)',
                transform: 'rotate(1deg)',
              }}
              loading="lazy"
            />
            <div
              className="mt-4 text-center"
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 14,
                color: '#3ee0a0',
                textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                transform: 'rotate(-1deg)',
              }}
            >
              ✿ students of school 12 ✿
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const SchoolTwelveOverlay = ({
  onExit,
  onPrev,
  onNext,
  onToggleAutoWalk,
  autoWalking,
  distanceMeters,
  arrived,
  dialogOpen,
  onDialogOpen,
}: Props) => {
  const [lightbox, setLightbox] = useState<null | { src: string; alt: string }>(null);
  const [confirmNav, setConfirmNav] = useState<null | 'prev' | 'next'>(null);
  const confirmRef = useRef<null | 'prev' | 'next'>(null);
  useEffect(() => { confirmRef.current = confirmNav; }, [confirmNav]);
  const dialogRef = useRef(dialogOpen);
  useEffect(() => { dialogRef.current = dialogOpen; }, [dialogOpen]);

  // Gamepad LB/RB → request prev/next level (with confirmation).
  // Inside the confirmation: A = yes, B = cancel.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        const cn = confirmRef.current;
        if (cn) {
          // Y (button 3) confirms · X (button 2) cancels
          if (consumeGamepadButton('st-conf-y', !!pad.buttons[3]?.pressed, { cooldownMs: 400, ignoreBlock: true })) {
            sfx[cn === 'prev' ? 'navPrev' : 'navNext']?.();
            setConfirmNav(null);
            if (cn === 'prev') onPrev?.(); else onNext?.();
          }
          if (consumeGamepadButton('st-conf-x', !!pad.buttons[2]?.pressed, { cooldownMs: 400, ignoreBlock: true })) {
            sfx.exit?.();
            setConfirmNav(null);
          }
        } else if (!dialogRef.current) {
          if (consumeGamepadButton('st-lb', !!pad.buttons[4]?.pressed, { cooldownMs: 400, ignoreBlock: true }) && onPrev) {
            sfx.click?.(); setConfirmNav('prev');
          }
          if (consumeGamepadButton('st-rb', !!pad.buttons[5]?.pressed, { cooldownMs: 400, ignoreBlock: true }) && onNext) {
            sfx.click?.(); setConfirmNav('next');
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onPrev, onNext]);

  return (
    <>
      <div className="absolute top-5 left-5 z-[80] flex gap-2" data-hud>
        <button
          onClick={() => { sfx.exit(); onExit(); }}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/75 border border-white/15 text-white hover:bg-black/90 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> exit
        </button>
        {onPrev && (
          <button
            onClick={() => { sfx.navPrev(); onPrev(); }}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/75 border border-white/15 text-white hover:bg-black/90 transition-colors"
          >
            ← prev · LB
          </button>
        )}
        {onNext && (
          <button
            onClick={() => { sfx.navNext(); onNext(); }}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/75 border border-white/15 text-white hover:bg-black/90 transition-colors"
          >
            next · RB →
          </button>
        )}
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[80] text-center pointer-events-none" data-hud>
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">level 6</div>
        <h1 className="text-2xl font-extralight tracking-[0.3em] uppercase text-white/95">Kegeyli School 12</h1>
        <div className="text-[9px] font-mono text-white/40 mt-1">59.583295, 42.748792</div>
      </div>

      <div className="absolute right-5 top-5 z-[80] w-[300px] space-y-3" data-hud>
        <div className="border border-white/15 bg-black/70 backdrop-blur-md p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/45">guided visit</div>
              <div className="mt-2 text-xl font-light tracking-[0.08em]">Reach the highlighted school</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center border border-amber-300/50 bg-amber-300/10 text-amber-200">
              <Navigation2 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/45">distance</div>
              <div className="text-3xl font-light text-white">{Math.max(0, Math.round(distanceMeters))} m</div>
            </div>
            <button
              onClick={() => { sfx.make(); onToggleAutoWalk(); }}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-[0.28em] border transition-colors ${
                autoWalking
                  ? 'bg-amber-300 text-black border-amber-200'
                  : 'bg-white/5 text-white border-white/20 hover:bg-white/10'
              }`}
            >
              {autoWalking ? 'auto-walking' : 'auto-walk · Y'}
            </button>
          </div>
          <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.25em] text-white/40">
            WASD / left stick · right stick to look
          </div>
        </div>

        <div className="border border-white/15 bg-black/70 backdrop-blur-md p-3">
          <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.35em] text-white/45">school photos</div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.src}
                type="button"
                onClick={() => { sfx.make(); setLightbox({ src: photo.src, alt: photo.alt }); }}
                className="group space-y-1 text-left"
              >
                <img src={photo.src} alt={photo.alt} className="aspect-square w-full object-cover border border-white/15 transition-transform group-hover:scale-[1.02] group-hover:border-amber-300/45" loading="lazy" />
                <div className="text-[8px] font-mono uppercase tracking-[0.22em] text-white/45 text-center group-hover:text-white/80">{photo.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {arrived && !dialogOpen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[80]" data-hud>
          <button
            onClick={() => { sfx.make(); onDialogOpen(true); }}
            className="inline-flex items-center gap-4 px-7 py-4 border-2 border-white/60 bg-black/80 hover:bg-black text-white text-sm font-mono uppercase tracking-[0.4em] rounded-sm"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 text-sm font-mono font-bold rounded-full border-2 border-white">X</span>
            talk to the student
          </button>
        </div>
      )}

      {dialogOpen && (
        <SchoolDialog onClose={() => onDialogOpen(false)} />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
          data-hud
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center border border-white/20 bg-black/70 text-white hover:bg-black"
            aria-label="Close photo"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[90vh] max-w-[92vw] object-contain border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {confirmNav && (
        <div
          data-hud
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 backdrop-blur-[3px] animate-in fade-in"
          onClick={() => setConfirmNav(null)}
        >
          <div
            className="px-8 py-7 border border-white/30 bg-slate-800/85 backdrop-blur-md text-white font-mono text-center max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.4em] text-white/65 mb-3">leave this level?</div>
            <div className="text-xl mb-6">Go to {confirmNav === 'prev' ? 'previous' : 'next'} level?</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  const dir = confirmNav;
                  sfx[dir === 'prev' ? 'navPrev' : 'navNext']?.();
                  setConfirmNav(null);
                  if (dir === 'prev') onPrev?.(); else onNext?.();
                }}
                className="px-5 py-2 text-[11px] uppercase tracking-[0.3em] bg-white text-black hover:brightness-110"
              >
                Y · Yes
              </button>
              <button
                onClick={() => { sfx.exit?.(); setConfirmNav(null); }}
                className="px-5 py-2 text-[11px] uppercase tracking-[0.3em] border border-white/40 hover:bg-white/10"
              >
                X · Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchoolTwelveOverlay;
