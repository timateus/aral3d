import { useState } from 'react';
import { ArrowLeft, ExternalLink, Film, Navigation2, X } from 'lucide-react';
import { sfx } from '@/lib/ui-sfx';
import schoolFrontAsset from '@/assets/kegeyli-school-front.png.asset.json';
import classroomOneAsset from '@/assets/kegeyli-classroom-1.png.asset.json';
import classroomTwoAsset from '@/assets/kegeyli-classroom-2.png.asset.json';

interface Props {
  onExit: () => void;
  onPrev?: () => void;
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

const SchoolTwelveOverlay = ({
  onExit,
  onPrev,
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
            className="px-7 py-4 rounded-full border-4 border-pink-300 bg-gradient-to-r from-pink-400 via-amber-300 to-sky-400 text-white text-base font-bold tracking-wide shadow-[0_8px_0_rgba(0,0,0,0.25)] hover:scale-105 active:translate-y-1 active:shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all animate-pulse"
          >
            💬 talk to the student · press X
          </button>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gradient-to-br from-indigo-950/80 via-pink-900/60 to-amber-900/60 backdrop-blur-md p-6" data-hud onClick={() => onDialogOpen(false)}>
          <div
            className="w-[min(760px,94vw)] rounded-[36px] bg-gradient-to-br from-cream via-amber-50 to-pink-100 text-slate-900 shadow-[0_24px_0_rgba(0,0,0,0.25)] border-4 border-slate-900 overflow-hidden relative"
            style={{ backgroundColor: '#fffaf0' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Doodle border accents */}
            <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-pink-300 border-4 border-slate-900" />
            <div className="absolute -top-3 -right-6 w-12 h-12 rounded-full bg-amber-300 border-4 border-slate-900" />
            <div className="absolute -bottom-5 left-12 w-10 h-10 rounded-full bg-sky-300 border-4 border-slate-900" />
            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-emerald-300 border-4 border-slate-900" />

            <div className="grid md:grid-cols-[1.1fr_0.9fr] relative">
              <div className="p-7 md:p-9">
                <div className="inline-block px-3 py-1 rounded-full bg-pink-400 text-white text-[11px] font-black uppercase tracking-wider border-2 border-slate-900">
                  ✏️ school 12 · kegeyli
                </div>
                <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900 leading-tight">
                  Welcome to <span className="text-pink-500">our school!</span>
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  Hi! 🎨 Try worlds the kids built, or come back later for the film screening.
                </p>
                <div className="mt-6 space-y-3">
                  <a
                    href="https://qilqalicity.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-2xl border-[3px] border-slate-900 bg-sky-200 px-5 py-4 hover:bg-sky-300 transition-all hover:-translate-y-0.5 shadow-[0_5px_0_rgba(15,23,42,1)] hover:shadow-[0_7px_0_rgba(15,23,42,1)]"
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-sky-900">🎮 play game</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">Qilqali City</div>
                      <div className="text-xs text-slate-700">qilqalicity.lovable.app</div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-900 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <a
                    href="https://roar-and-guard.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-2xl border-[3px] border-slate-900 bg-amber-200 px-5 py-4 hover:bg-amber-300 transition-all hover:-translate-y-0.5 shadow-[0_5px_0_rgba(15,23,42,1)] hover:shadow-[0_7px_0_rgba(15,23,42,1)]"
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-900">🦁 play game</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-900">Roar &amp; Guard</div>
                      <div className="text-xs text-slate-700">roar-and-guard.lovable.app</div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-slate-900 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <div className="flex items-center justify-between rounded-2xl border-[3px] border-dashed border-slate-400 bg-white/60 px-5 py-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">🎬 film</div>
                      <div className="mt-1 text-xl font-extrabold text-slate-500">Watch the school film</div>
                      <div className="text-xs text-slate-400">coming soon ✨</div>
                    </div>
                    <Film className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-7 bg-gradient-to-br from-pink-100 to-amber-100 border-l-4 border-slate-900 border-dashed">
                <img
                  src={schoolFrontAsset.url}
                  alt="Students standing in front of School 12 in Kegeyli"
                  className="w-full aspect-[4/5] object-cover rounded-2xl border-[3px] border-slate-900 shadow-[0_6px_0_rgba(15,23,42,1)]"
                  loading="lazy"
                />
                <div className="mt-4 text-center text-[11px] font-black uppercase tracking-wider text-pink-600">
                  🌟 school 12 community 🌟
                </div>
                <button
                  onClick={() => onDialogOpen(false)}
                  className="mt-5 w-full rounded-full border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900 hover:bg-pink-200 transition-colors shadow-[0_4px_0_rgba(15,23,42,1)] hover:shadow-[0_6px_0_rgba(15,23,42,1)] hover:-translate-y-0.5"
                >
                  ✌️ bye!
                </button>
              </div>
            </div>
          </div>
        </div>
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
