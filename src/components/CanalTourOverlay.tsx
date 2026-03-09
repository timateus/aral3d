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
    <div className="absolute top-4 left-4 z-50 animate-fade-in w-72">
      <div className="glass-panel px-4 py-3 space-y-2">
        {/* Skip button */}
        <button
          onClick={onExit}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {CANAL_TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
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
          <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-primary shrink-0" />
            {current.title}
          </h2>
          <p className="text-[10px] text-primary/80 font-medium tracking-wide uppercase mt-0.5">
            {current.subtitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {current.description}
        </p>

        {/* Ethnicity badges */}
        <div className="flex gap-1 flex-wrap">
          {ethnicities.map(e => (
            <span
              key={e}
              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
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
        <div className="max-h-24 overflow-y-auto space-y-0.5 scrollbar-thin">
          {current.canals.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5 px-1 py-0.5 rounded hover:bg-muted/30 transition-colors">
              <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: getEthnicityColor(c.ethnicity) }} />
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-foreground leading-tight">
                  {c.canal}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">— {c.geography}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => onStepChange(step - 1)}
            disabled={isFirst}
            className="px-2 py-1 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5"
          >
            <ChevronLeft className="w-3 h-3" /> Back
          </button>
          <span className="text-[9px] text-muted-foreground font-mono">
            {step + 1}/{CANAL_TOUR_STEPS.length}
          </span>
          {isLast ? (
            <button
              onClick={onExit}
              className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition-opacity"
            >
              Explore →
            </button>
          ) : (
            <button
              onClick={() => onStepChange(step + 1)}
              className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition-opacity flex items-center gap-0.5"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanalTourOverlay;
