import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, TimerOff } from 'lucide-react';

const TOTAL_SECONDS = 120; // 2 minutes

export default function CountdownTimer() {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setSecondsLeft(TOTAL_SECONDS);
    setRunning(false);
    setBlinking(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const toggle = useCallback(() => {
    if (!visible) {
      setVisible(true);
      setRunning(true);
      setSecondsLeft(TOTAL_SECONDS);
      setBlinking(false);
    } else {
      setVisible(false);
      reset();
    }
  }, [visible, reset]);

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setRunning(false);
            setBlinking(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, secondsLeft]);

  // Stop blinking after 6 seconds
  useEffect(() => {
    if (!blinking) return;
    const t = setTimeout(() => setBlinking(false), 6000);
    return () => clearTimeout(t);
  }, [blinking]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft <= 10 && secondsLeft > 0;

  return (
    <>
      {/* Full-screen red blink overlay */}
      {blinking && (
        <div className="fixed inset-0 z-[9999] pointer-events-none animate-[blink-red_0.5s_ease-in-out_infinite]" />
      )}

      {/* Toggle button — always visible */}
      <button
        onClick={toggle}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur border border-border/50 text-foreground/80 hover:text-foreground hover:border-border transition-all text-xs font-medium shadow-md"
        title={visible ? 'Hide countdown' : 'Show countdown'}
      >
        {visible ? <TimerOff className="w-3.5 h-3.5" /> : <Timer className="w-3.5 h-3.5" />}
        {visible ? 'Hide Timer' : 'Timer'}
      </button>

      {/* Countdown display */}
      {visible && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div
            className={`
              px-6 py-2 rounded-lg backdrop-blur-lg border shadow-lg text-center font-mono tabular-nums
              ${urgent ? 'bg-destructive/20 border-destructive/50 text-destructive animate-pulse' : 'bg-card/90 border-border/50 text-foreground'}
              ${secondsLeft === 0 ? 'bg-destructive/30 border-destructive text-destructive' : ''}
            `}
          >
            <span className="text-2xl font-bold tracking-wider">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink-red {
          0%, 100% { background: transparent; }
          50% { background: rgba(239, 68, 68, 0.35); }
        }
      `}</style>
    </>
  );
}
