import { useVisualMode } from '@/lib/visual-mode';
import { Sun, Moon } from 'lucide-react';

/**
 * Tiny top-bar toggle that flips the global visual mode between the
 * default dark scientific theme and the bone-paper "mirage" theme.
 * Styling intentionally matches the existing Menu / Game Mode buttons.
 */
const MirageToggle = () => {
  const [mode, setMode] = useVisualMode();
  const isMirage = mode === 'mirage';
  return (
    <button
      onClick={() => setMode(isMirage ? 'dark' : 'mirage')}
      title={isMirage ? 'Switch to dark mode' : 'Switch to mirage (light) mode'}
      className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm flex items-center gap-1.5"
    >
      {isMirage ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      {isMirage ? 'Dark' : 'Mirage'}
    </button>
  );
};

export default MirageToggle;
