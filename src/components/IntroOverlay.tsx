import { useState } from 'react';

interface IntroOverlayProps {
  onStart: () => void;
}

const IntroOverlay = ({ onStart }: IntroOverlayProps) => {
  const [step, setStep] = useState(0);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="glass-panel p-8 max-w-md text-center space-y-6 animate-fade-in">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Aral Sea Terrain Viewer
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Explore the Aral Sea region in 3D. This interactive visualization shows
              elevation data, river networks, and country borders — letting you see how
              the landscape has shaped one of the world's greatest environmental changes.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Rotate, pan, and zoom with your mouse. Adjust water level and exaggeration
              using the control panel.
            </p>
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Next →
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              What You'll See
            </h2>
            <ul className="text-sm text-muted-foreground text-left space-y-2">
              <li className="flex items-start gap-2">
                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm shrink-0" style={{ background: 'linear-gradient(to top, hsl(120,40%,35%), hsl(30,50%,45%))' }} />
                <span><strong className="text-foreground">Terrain</strong> — 30m resolution elevation data with hypsometric coloring</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm shrink-0" style={{ background: '#5b9bd5' }} />
                <span><strong className="text-foreground">Amu Darya</strong> — River network with thickness by stream order</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm bg-white/30 border border-white/50 shrink-0" />
                <span><strong className="text-foreground">Borders</strong> — Uzbekistan country boundary</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-block w-3 h-3 mt-0.5 rounded-full shrink-0 bg-primary" style={{ background: 'hsl(200,60%,55%)' }} />
                <span><strong className="text-foreground">Water Level</strong> — Adjustable to simulate sea extent</span>
              </li>
            </ul>
            <button
              onClick={onStart}
              className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Explore →
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default IntroOverlay;
