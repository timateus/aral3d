import { useEffect } from 'react';
import { NARRATIVE_STEPS } from '@/lib/narrative-steps';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface NarrativeOverlayProps {
  step: number;
  onStepChange: (step: number) => void;
  onExit: () => void;
}

const NarrativeOverlay = ({ step, onStepChange, onExit }: NarrativeOverlayProps) => {
  const current = NARRATIVE_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === NARRATIVE_STEPS.length - 1;

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
      <div className="glass-panel px-8 py-6 max-w-lg text-center space-y-4">
        {/* Skip button */}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5">
          {NARRATIVE_STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-primary scale-125'
                  : i < step
                  ? 'bg-primary/50'
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
            {step + 1} / {NARRATIVE_STEPS.length}
          </span>
          {isLast ? (
            <button
              onClick={onExit}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Explore Freely →
            </button>
          ) : (
            <button
              onClick={() => onStepChange(step + 1)}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NarrativeOverlay;
