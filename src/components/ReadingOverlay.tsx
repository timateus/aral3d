import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { READING_PASSAGES } from '@/lib/reading-passages';

interface ReadingOverlayProps {
  step: number;
  onStepChange: (step: number) => void;
  onExit: () => void;
}

/**
 * Scroll-driven literary overlay. The 3D map below stays fully visible;
 * scrolling advances passages, each of which moves the camera and the year
 * via the existing NARRATIVE_STEPS pipeline (the parent maps step ->
 * passage.stepIndex).
 *
 * Style: Sebaldian — bone paper, long serif, almost no chrome. The text
 * floats in a quiet column on the lower-left and never covers the centre
 * of the map.
 */
const ReadingOverlay = ({ step, onStepChange, onExit }: ReadingOverlayProps) => {
  const passage = READING_PASSAGES[step];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(step);
  const [progress, setProgress] = useState(0); // 0..1 within the page

  // Scroll handler — each passage occupies one viewport-height block.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const sectionH = el.clientHeight;
      const idx = Math.min(
        READING_PASSAGES.length - 1,
        Math.max(0, Math.round(el.scrollTop / sectionH))
      );
      const local = (el.scrollTop % sectionH) / sectionH;
      setProgress(local);
      if (idx !== lastStep.current) {
        lastStep.current = idx;
        onStepChange(idx);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onStepChange]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        scrollerRef.current?.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        scrollerRef.current?.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  if (!passage) return null;

  // Bone-paper palette — used only inside the text card, not over the whole map
  const ink = 'hsl(30 18% 18%)';
  const inkSoft = 'hsl(30 18% 38%)';
  const inkFaint = 'hsl(30 18% 50%)';
  const paper = 'hsla(36, 28%, 94%, 0.94)';

  // Slight crossfade — text settles when between passages
  const cardOpacity = 1 - Math.min(0.85, Math.abs(progress - 0.5) * 0.3);

  return (
    <>
      {/* Scroll surface — invisible, full-screen, captures wheel events */}
      <div
        ref={scrollerRef}
        className="absolute inset-0 z-40 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
        aria-label="Reading"
      >
        {READING_PASSAGES.map((_, i) => (
          <div
            key={i}
            className="w-full"
            style={{ height: '100vh', scrollSnapAlign: 'start' }}
          />
        ))}
        {/* tail so the last passage can rest */}
        <div style={{ height: '40vh' }} />
      </div>

      {/* The text card — the only thing the reader actually reads */}
      <article
        className="absolute z-50 left-6 md:left-10 bottom-10 max-w-[420px] md:max-w-[460px] pointer-events-none"
        style={{
          opacity: cardOpacity,
          transition: 'opacity 240ms ease-out',
        }}
      >
        <div
          className="px-7 py-7 pointer-events-auto"
          style={{
            background: paper,
            color: ink,
            backdropFilter: 'blur(2px)',
            border: '1px solid hsla(30, 18%, 18%, 0.14)',
            boxShadow: '0 1px 0 hsla(30,18%,18%,0.04), 0 12px 40px -20px hsla(30,18%,18%,0.35)',
          }}
        >
          <div
            className="font-serif italic text-[12px] tracking-wide mb-2"
            style={{ color: inkFaint }}
          >
            {passage.marker}
          </div>
          <h2
            className="font-serif italic text-[20px] leading-tight mb-4"
            style={{ color: inkSoft }}
          >
            {passage.title}
          </h2>

          <p
            key={step /* re-mount for fade-in on passage change */}
            className="font-serif text-[15.5px] leading-[1.8] animate-fade-in"
            style={{ color: ink }}
          >
            {passage.body}
          </p>

          {passage.margin && (
            <div
              className="mt-5 pt-3 font-serif italic text-[11.5px] leading-[1.55] whitespace-pre-line"
              style={{
                color: inkFaint,
                borderTop: '1px solid hsla(30,18%,18%,0.18)',
              }}
            >
              {passage.margin}
            </div>
          )}

          {/* footer row */}
          <div
            className="mt-6 flex items-center justify-between font-serif italic text-[11px]"
            style={{ color: inkFaint }}
          >
            <span>
              {step + 1} / {READING_PASSAGES.length}
            </span>
            <span className="hidden md:inline">scroll to continue ↓</span>
          </div>
        </div>
      </article>

      {/* Exit — quiet, top-right */}
      <button
        onClick={onExit}
        className="absolute z-50 top-5 right-5 flex items-center gap-2 px-3 py-1.5 pointer-events-auto"
        style={{
          background: paper,
          color: ink,
          border: '1px solid hsla(30, 18%, 18%, 0.18)',
        }}
        aria-label="Close reading"
      >
        <X className="w-3.5 h-3.5" />
        <span className="font-serif italic text-[12px]">close</span>
      </button>

      {/* Progress dots — top-left, very small */}
      <div className="absolute z-50 top-5 left-5 flex gap-1.5 pointer-events-none">
        {READING_PASSAGES.map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i === step ? ink : 'hsla(30,18%,18%,0.25)',
              transform: i === step ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </>
  );
};

export default ReadingOverlay;
