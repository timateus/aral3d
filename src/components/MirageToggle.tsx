import { useVisualMode } from '@/lib/visual-mode';
import { Sun, Moon, SlidersHorizontal } from 'lucide-react';

/**
 * Cycles between dark → mirage → designer → dark.
 */
const MirageToggle = () => {
  const [mode, setMode] = useVisualMode();
  const next = mode === 'dark' ? 'mirage' : mode === 'mirage' ? 'designer' : 'dark';
  const Icon = mode === 'dark' ? Sun : mode === 'mirage' ? SlidersHorizontal : Moon;
  const label = mode === 'dark' ? 'Mirage' : mode === 'mirage' ? 'Designer' : 'Dark';
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
