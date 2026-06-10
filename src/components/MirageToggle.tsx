import { useVisualMode } from '@/lib/visual-mode';
import { Sun, Moon, SlidersHorizontal } from 'lucide-react';

/**
 * Cycles between dark → mirage → designer → dark.
 */
const MirageToggle = () => {
  const [mode, setMode] = useVisualMode();
  // Designer mode hidden from Explore — toggle now just flips dark ⇄ mirage.
  const current = mode === 'designer' ? 'dark' : mode;
  const next = current === 'dark' ? 'mirage' : 'dark';
  const Icon = current === 'dark' ? Sun : Moon;
  const label = current === 'dark' ? 'Mirage' : 'Dark';
  return (
    <button
      onClick={() => setMode(next)}
      title={`Switch to ${next} mode`}
      className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm flex items-center gap-1.5"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
};

export default MirageToggle;
