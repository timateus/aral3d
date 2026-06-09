import { useEffect, useState } from 'react';
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
  { label: 'Watch the school film', sub: 'coming soon', disabled: true },
  { label: 'Exit', sub: 'back to the map', action: 'close' },
];

const HEADING_FONT = '"Trebuchet MS", "Comic Sans MS", "Inter", system-ui, sans-serif';
const BODY_FONT = '"Georgia", "Trebuchet MS", serif';

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
      style={{ background: '#06080e' }}
      onClick={onClose}
    >
      <div
        className="w-[min(900px,94vw)] border-2 border-white/50 bg-white/5 rounded-sm overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 md:p-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.5em] text-white/55 mb-4">
              level 6 · school 12 · kegeyli
            </div>
            <h2
              className="font-black tracking-[0.06em] uppercase text-white mb-5"
              style={{ fontFamily: HEADING_FONT, fontSize: 'clamp(36px,5.2vw,64px)', lineHeight: 0.95, textShadow: '0 10px 40px rgba(0,0,0,0.6)' }}
            >
              Play the games we made!
            </h2>
            <p
              className="italic text-white/90 leading-snug mb-7"
              style={{ fontFamily: BODY_FONT, fontSize: 'clamp(16px,1.5vw,22px)' }}
            >
              Worlds built by students of School 12 — pick one and explore.
            </p>

            <ul className="space-y-2">
              {items.map((it, i) => {
                const active = i === sel;
                return (
                  <li key={it.label}>
                    <button
                      type="button"
                      disabled={it.disabled}
                      onMouseEnter={() => !it.disabled && setSel(i)}
                      onClick={() => activate(i)}
                      className={`w-full flex items-center justify-between px-5 py-4 border-2 rounded-sm text-left transition-colors ${
                        it.disabled
                          ? 'border-white/15 bg-white/[0.02] text-white/35 cursor-not-allowed'
                          : active
                            ? 'text-white'
                            : 'text-white hover:bg-white/10'
                      }`}
                      style={
                        it.disabled
                          ? undefined
                          : active
                            ? { background: '#3b82f6', borderColor: '#3b82f6' }
                            : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.4)' }
                      }
                    >
                      <div>
                        <div
                          className="font-black uppercase tracking-[0.05em]"
                          style={{ fontFamily: HEADING_FONT, fontSize: 'clamp(18px,1.8vw,24px)' }}
                        >
                          {it.label}
                        </div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.3em] opacity-75 mt-1">
                          {it.sub}
                        </div>
                      </div>
                      {it.action === 'close' ? (
                        <X className="w-5 h-5" />
                      ) : (
                        <ExternalLink className="w-5 h-5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.35em] text-white/70">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white/70">▲▼</span>
              <span>navigate</span>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white text-white" style={{ background: '#3b82f6' }}>3</span>
              <span>select</span>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white text-white" style={{ background: '#ef4444' }}>2</span>
              <span>exit</span>
            </div>
          </div>

          <div className="p-6 md:p-8 border-l border-white/15 bg-black/40">
            <img
              src={studentsCraftAsset.url}
              alt="School 12 students with their hand-painted water-wheel project"
              className="w-full aspect-[3/4] object-cover border-2 border-white/30 rounded-sm"
              loading="lazy"
            />
            <div
              className="mt-4 text-[10px] font-mono uppercase tracking-[0.4em] text-center text-white/60"
            >
              students of school 12
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
    </>
  );
};

export default SchoolTwelveOverlay;
