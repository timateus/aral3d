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
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="glass-panel px-8 py-6 max-w-lg text-center space-y-4 border border-emerald-500/20">
        {/* Skip button */}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header badge */}
        <div className="flex items-center justify-center gap-1.5 text-emerald-400">
          <Droplets className="w-3.5 h-3.5" />
          <span className="text-[10px] tracking-[0.15em] uppercase font-medium">Ag-MAR Technology</span>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5">
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

        {/* Content */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {current.title}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {current.text}
          </p>
        </div>

        {/* Proposal sites callout on last step */}
        {current.proposalSites && (
          <div className="flex gap-3 justify-center">
            {current.proposalSites.map(site => (
              <div key={site.name} className="px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[11px] font-medium text-emerald-400">{site.name}</p>
                <p className="text-[9px] text-muted-foreground">{site.lat.toFixed(1)}°N, {site.lon.toFixed(1)}°E</p>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => onStepChange(step - 1)}
            disabled={isFirst}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Back
          </button>
          <span className="text-[10px] text-muted-foreground font-mono">
            {step + 1} / {AGMAR_TOUR_STEPS.length}
          </span>
          {isLast ? (
            <button
              onClick={onExit}
              className="px-4 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Explore Freely →
            </button>
          ) : (
            <button
              onClick={() => onStepChange(step + 1)}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgmarTourOverlay;
