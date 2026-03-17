import { useEffect } from 'react';
import { AGMAR_TOUR_STEPS } from '@/lib/agmar-tour-steps';
import { ChevronLeft, ChevronRight, X, Droplets } from 'lucide-react';

interface AgmarTourOverlayProps {
  step: number;
  onStepChange: (step: number) => void;
  onExit: () => void;
}

const AgmarTourOverlay = ({ step, onStepChange, onExit }: AgmarTourOverlayProps) => {
  const current = AGMAR_TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === AGMAR_TOUR_STEPS.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.key === 'ArrowRight' && !isLast) onStepChange(step + 1);
      if (e.key === 'ArrowLeft' && !isFirst) onStepChange(step - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, isFirst, isLast, onStepChange, onExit]);

  if (!current) return null;

  return (
    <>
      {/* Top-left badge */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-2">
        <Droplets className="w-5 h-5 text-emerald-400" />
        <span className="text-sm tracking-[0.2em] uppercase font-medium text-emerald-400">
          Ag-MAR Technology
        </span>
        <button
          onClick={onExit}
          className="ml-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Exit presentation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom presentation strip */}
      <div className="absolute bottom-0 left-0 right-0 z-50 animate-fade-in">
        <div className="bg-background/70 backdrop-blur-md border-t border-emerald-500/20">
          <div className="max-w-5xl mx-auto px-8 py-5 flex items-center gap-8">
            {/* Step number */}
            <div className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-emerald-500/40 flex items-center justify-center">
              <span className="text-2xl font-bold text-emerald-400">{step + 1}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  {current.title}
                </h2>
                <span className="text-sm text-emerald-400/80 font-medium tracking-wide">
                  {current.subtitle}
                </span>
              </div>
              <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
                {current.text}
              </p>
            </div>

            {/* Proposal sites on last step */}
            {current.proposalSites && (
              <div className="flex-shrink-0 flex flex-col gap-2">
                {current.proposalSites.map(site => (
                  <div key={site.name} className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-sm font-semibold text-emerald-400">{site.name}</p>
                    <p className="text-xs text-muted-foreground">{site.lat.toFixed(1)}°N, {site.lon.toFixed(1)}°E</p>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <button
                onClick={() => onStepChange(step - 1)}
                disabled={isFirst}
                className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-20 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Step dots */}
              <div className="flex gap-1.5 mx-2">
                {AGMAR_TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === step
                        ? 'bg-emerald-400 scale-125'
                        : i < step
                        ? 'bg-emerald-400/50'
                        : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              {isLast ? (
                <button
                  onClick={onExit}
                  className="h-10 px-5 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
                >
                  Explore →
                </button>
              ) : (
                <button
                  onClick={() => onStepChange(step + 1)}
                  className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white hover:bg-emerald-500 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AgmarTourOverlay;
