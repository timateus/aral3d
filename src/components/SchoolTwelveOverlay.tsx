import { ArrowLeft, ExternalLink, Film, Navigation2 } from 'lucide-react';
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
              <div key={photo.src} className="space-y-1">
                <img src={photo.src} alt={photo.alt} className="aspect-square w-full object-cover border border-white/15" loading="lazy" />
                <div className="text-[8px] font-mono uppercase tracking-[0.22em] text-white/45 text-center">{photo.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {arrived && !dialogOpen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[80]" data-hud>
          <button
            onClick={() => { sfx.make(); onDialogOpen(true); }}
            className="px-6 py-4 border border-amber-300/45 bg-black/80 text-white backdrop-blur-md text-sm font-mono uppercase tracking-[0.3em] hover:bg-black"
          >
            talk to the student · X
          </button>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" data-hud onClick={() => onDialogOpen(false)}>
          <div
            className="w-[min(760px,92vw)] border border-white/15 bg-[#0a0d12] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid md:grid-cols-[1.15fr_0.85fr]">
              <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10">
                <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-amber-300/70">school 12 · kegeyli</div>
                <h2 className="mt-3 text-3xl font-light tracking-[0.04em]">Welcome to our school</h2>
                <p className="mt-4 text-sm leading-6 text-white/68 max-w-md">
                  Explore student-made worlds, or come back later for the film screening once it is uploaded.
                </p>
                <div className="mt-6 space-y-3">
                  <a
                    href="https://qilqalicity.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between border border-white/15 bg-white/5 px-4 py-4 hover:bg-white/10 hover:border-amber-300/40 transition-colors"
                  >
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-200/70">play game</div>
                      <div className="mt-1 text-lg font-light">Qilqali City</div>
                      <div className="text-xs text-white/45">qilqalicity.lovable.app</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                  <a
                    href="https://roar-and-guard.lovable.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between border border-white/15 bg-white/5 px-4 py-4 hover:bg-white/10 hover:border-amber-300/40 transition-colors"
                  >
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-200/70">play game</div>
                      <div className="mt-1 text-lg font-light">Roar &amp; Guard</div>
                      <div className="text-xs text-white/45">roar-and-guard.lovable.app</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                  <div className="flex items-center justify-between border border-white/10 bg-white/[0.03] px-4 py-4 opacity-70">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/45">film</div>
                      <div className="mt-1 text-lg font-light">Watch the school film</div>
                      <div className="text-xs text-white/40">coming soon</div>
                    </div>
                    <Film className="h-4 w-4 text-white/40" />
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 bg-white/[0.03]">
                <img
                  src={schoolFrontAsset.url}
                  alt="Students standing in front of School 12 in Kegeyli"
                  className="w-full aspect-[4/5] object-cover border border-white/10"
                  loading="lazy"
                />
                <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.35em] text-white/45">school 12 community</div>
                <button
                  onClick={() => onDialogOpen(false)}
                  className="mt-6 w-full border border-white/15 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.3em] text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                >
                  close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchoolTwelveOverlay;
