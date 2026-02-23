interface IntroOverlayProps {
  onStart: () => void;
  onGuidedTour: () => void;
}

const IntroOverlay = ({ onStart, onGuidedTour }: IntroOverlayProps) => {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="glass-panel px-8 py-5 text-center space-y-3 max-w-sm">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          The Aral Sea
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Once the world's fourth-largest lake — now a stark reminder of environmental change.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onGuidedTour}
            className="px-5 py-1.5 rounded-md border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
          >
            Guided Tour
          </button>
          <button
            onClick={onStart}
            className="px-5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Explore →
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
