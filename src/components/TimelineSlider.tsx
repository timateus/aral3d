import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Eye, EyeOff } from 'lucide-react';

interface TimelineSliderProps {
  year: number;
  onYearChange: (year: number) => void;
  visible: boolean;
  onToggleVisible: (val: boolean) => void;
}

const MIN_YEAR = 1925;
const MAX_YEAR = 2024;

const TimelineSlider = ({ year, onYearChange, visible, onToggleVisible }: TimelineSliderProps) => {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (!visible) onToggleVisible(true);
    setPlaying(true);
    if (year >= MAX_YEAR) onYearChange(MIN_YEAR);
  }, [year, visible, onToggleVisible, onYearChange]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      onYearChange(year + 1);
    }, 150);
    return () => clearInterval(id);
  }, [playing, year, onYearChange]);

  useEffect(() => {
    if (playing && year >= MAX_YEAR) stop();
  }, [year, playing, stop]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-4 pt-8 bg-gradient-to-t from-background/80 to-transparent pointer-events-none">
      <div className="pointer-events-auto max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => playing ? stop() : play()}
            className="glass-panel p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <div className="flex-1 flex flex-col gap-1">
            <Slider
              value={[year]}
              onValueChange={(v) => { stop(); onYearChange(v[0]); if (!visible) onToggleVisible(true); }}
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-1">
              <span>{MIN_YEAR}</span>
              <span className="text-foreground font-semibold text-xs tabular-nums">{year}</span>
              <span>{MAX_YEAR}</span>
            </div>
          </div>

          <button
            onClick={() => onToggleVisible(!visible)}
            className="glass-panel p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            title={visible ? 'Hide water extent' : 'Show water extent'}
          >
            {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimelineSlider;
