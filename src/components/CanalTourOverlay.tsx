import { useEffect } from 'react';
import { CANAL_TOUR_STEPS, getEthnicityColor, getUniqueEthnicities } from '@/lib/canal-tour-steps';
import { ChevronLeft, ChevronRight, X, Droplets, MapPin } from 'lucide-react';

interface CanalTourOverlayProps {
  step: number;
  onStepChange: (step: number) => void;
  onExit: () => void;
}

const CanalTourOverlay = ({ step, onStepChange, onExit }: CanalTourOverlayProps) => {
  const current = CANAL_TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === CANAL_TOUR_STEPS.length - 1;

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

  const ethnicities = getUniqueEthnicities(current.canals);

  return (
    <div className="absolute top-4 left-4 z-50 animate-fade-in w-[340px]">
      <div className="glass-panel px-5 py-4 space-y-3">
        {/* Skip button */}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {CANAL_TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-primary'
                  : i < step
                  ? 'bg-primary/50'
                  : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary shrink-0" />
            {current.title}
          </h2>
          <p className="text-xs text-primary/80 font-semibold tracking-wide uppercase mt-1">
            {current.subtitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {current.description}
        </p>

        {/* Ethnicity badges */}
        <div className="flex gap-1.5 flex-wrap">
          {ethnicities.map(e => (
            <span
              key={e}
              className="px-2 py-1 rounded-full text-[11px] font-semibold"
              style={{
                backgroundColor: getEthnicityColor(e) + '22',
                color: getEthnicityColor(e),
                border: `1px solid ${getEthnicityColor(e)}44`,
              }}
            >
              {e}
            </span>
          ))}
        </div>

        {/* Canal list */}
        <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-thin">
          {current.canals.map((c, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/30 transition-colors">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: getEthnicityColor(c.ethnicity) }} />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {c.canal}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">— {c.geography}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => onStepChange(step - 1)}
            disabled={isFirst}
            className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-[11px] text-muted-foreground font-mono">
            {step + 1}/{CANAL_TOUR_STEPS.length}
          </span>
          {isLast ? (
            <button
              onClick={onExit}
              className="px-3.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Explore →
            </button>
          ) : (
            <button
              onClick={() => onStepChange(step + 1)}
              className="px-3.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanalTourOverlay;
