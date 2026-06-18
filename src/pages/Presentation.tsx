import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, FileText, ArrowLeft, Maximize2 } from 'lucide-react';

const TOTAL = 17;
const slides = Array.from({ length: TOTAL }, (_, i) =>
  `/presentation/slide-${String(i + 1).padStart(2, '0')}.jpg`
);

const PresentationPage = () => {
  const [i, setI] = useState(0);
  const [fs, setFs] = useState(false);

  const next = useCallback(() => setI((v) => Math.min(TOTAL - 1, v + 1)), []);
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') setFs(false);
      else if (e.key === 'f' || e.key === 'F') setFs((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  return (
    <div className="min-h-screen bg-white text-[#111418] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/10">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-black/60 hover:text-black">
            <ArrowLeft className="w-3 h-3" /> back
          </Link>
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-[#0F766E]">
            Aral3D — Presentation
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/aral3d-presentation.pdf"
            download
            className="flex items-center gap-2 px-3 py-2 border border-black/20 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-black/5 transition-colors"
          >
            <FileText className="w-3 h-3" /> PDF
          </a>
          <a
            href="/aral3d-presentation.pptx"
            download
            className="flex items-center gap-2 px-3 py-2 border border-black/20 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-black/5 transition-colors"
          >
            <Download className="w-3 h-3" /> PPTX
          </a>
          <button
            onClick={() => setFs((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 border border-black/20 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-black/5 transition-colors"
            title="Fullscreen (F)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8 relative bg-[#F5F5F2]">
        <button
          onClick={prev}
          disabled={i === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 border border-black/20 bg-white hover:bg-black/5 disabled:opacity-20 transition"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="w-full max-w-6xl aspect-[16/9] bg-white border border-black/10 shadow-2xl overflow-hidden">
          <img src={slides[i]} alt={`Slide ${i + 1}`} className="w-full h-full object-contain" />
        </div>

        <button
          onClick={next}
          disabled={i === TOTAL - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 border border-black/20 bg-white hover:bg-black/5 disabled:opacity-20 transition"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </main>

      <footer className="border-t border-black/10 px-6 py-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/50">
            {String(i + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-black/30 hidden sm:block">
            ← → to navigate · F fullscreen
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {slides.map((src, idx) => (
            <button
              key={src}
              onClick={() => setI(idx)}
              className={`shrink-0 w-20 aspect-[16/9] border transition ${
                idx === i ? 'border-[#0F766E]' : 'border-black/10 hover:border-black/40 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </footer>

      {/* Fullscreen overlay */}
      {fs && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setFs(false)}
        >
          <img src={slides[i]} alt={`Slide ${i + 1}`} className="max-w-full max-h-full object-contain" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
            {String(i + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')} · esc to close
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationPage;
