import { ArrowLeft, Sparkles, Printer } from 'lucide-react';

interface Props {
  onExit: () => void;
  onRandomize: () => void;
}

const SpectralEarthHUD = ({ onExit, onRandomize }: Props) => {
  const handlePrint = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!doctype html><html><head><title>Spectral Earth</title>
      <style>
        @page { size: auto; margin: 12mm; }
        html,body { margin:0; padding:0; background:#fff; }
        img { display:block; width:100%; height:auto; }
      </style></head>
      <body><img src="${url}" onload="setTimeout(()=>window.print(),200)" /></body></html>
    `);
    w.document.close();
  };

  const line1 = 'maps are not neutral, fixed, or purely scientific';
  const line2 = 'make it strange, unstable, playful, open to interpretation';

  return (
    <>
      <style>{`
        @keyframes spectral-glitch-anim-1 {
          0%,100% { clip-path: inset(0 0 85% 0); transform: translate(0,0); }
          20% { clip-path: inset(20% 0 60% 0); transform: translate(-4px,2px); }
          40% { clip-path: inset(50% 0 30% 0); transform: translate(3px,-2px); }
          60% { clip-path: inset(70% 0 10% 0); transform: translate(-2px,3px); }
          80% { clip-path: inset(10% 0 75% 0); transform: translate(5px,-3px); }
        }
        @keyframes spectral-glitch-anim-2 {
          0%,100% { clip-path: inset(70% 0 10% 0); transform: translate(0,0); }
          25% { clip-path: inset(10% 0 70% 0); transform: translate(4px,-2px); }
          50% { clip-path: inset(40% 0 40% 0); transform: translate(-5px,2px); }
          75% { clip-path: inset(80% 0 5% 0); transform: translate(3px,3px); }
        }
        @keyframes spectral-shake {
          0%,100% { transform: translate(-50%, 0) skewX(0deg); }
          25% { transform: translate(-50%, 0) skewX(-2deg); }
          50% { transform: translate(-50%, 0) skewX(1.5deg); }
          75% { transform: translate(-50%, 0) skewX(-1deg); }
        }
        @keyframes spectral-flicker {
          0%,100% { opacity: 1; }
          43% { opacity: 0.85; }
          45% { opacity: 0.3; }
          47% { opacity: 1; }
          83% { opacity: 0.6; }
          85% { opacity: 1; }
        }
        .spectral-glitch {
          position: relative;
          display: inline-block;
          color: hsl(var(--foreground));
          animation: spectral-flicker 4s infinite;
          text-shadow: 2px 0 0 rgba(255,0,120,0.7), -2px 0 0 rgba(0,200,255,0.7);
        }
        .spectral-glitch::before,
        .spectral-glitch::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          background: transparent;
          pointer-events: none;
        }
        .spectral-glitch::before {
          color: #ff007a;
          animation: spectral-glitch-anim-1 2.5s infinite linear alternate-reverse;
          mix-blend-mode: screen;
        }
        .spectral-glitch::after {
          color: #00e5ff;
          animation: spectral-glitch-anim-2 3s infinite linear alternate-reverse;
          mix-blend-mode: screen;
        }
      `}</style>

      {/* Giant glitchy manifesto */}
      <div
        className="fixed top-1/2 left-1/2 z-30 pointer-events-none w-[92vw] text-center -translate-x-1/2 -translate-y-1/2"
        style={{ animation: 'spectral-shake 6s infinite' }}
      >
        <div
          className="font-black uppercase leading-[0.95] tracking-tight"
          style={{ fontSize: 'clamp(28px, 5.2vw, 86px)' }}
        >
          <span className="spectral-glitch" data-text={line1}>{line1}</span>
        </div>
        <div
          className="mt-6 font-light italic lowercase leading-tight"
          style={{ fontSize: 'clamp(16px, 2.4vw, 36px)' }}
        >
          <span className="spectral-glitch" data-text={line2}>{line2}</span>
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none">
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-foreground/90 drop-shadow">
          Spectral Earth
        </h1>
        <div className="mt-2 h-px w-16 mx-auto bg-foreground/30" />
      </div>

      {/* Back button */}
      <button
        onClick={onExit}
        className="absolute top-5 left-5 z-40 flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.15em] uppercase bg-card/80 backdrop-blur-md border border-border/50 text-foreground hover:bg-card transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Menu
      </button>

      {/* Bottom action buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
        <button
          onClick={onRandomize}
          className="group flex items-center gap-3 px-8 py-4 bg-card/80 backdrop-blur-md border border-border/60 hover:border-foreground/60 text-foreground text-sm tracking-[0.2em] uppercase font-medium transition-all hover:bg-card"
        >
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          Make it misbehave
        </button>
        <button
          onClick={handlePrint}
          className="group flex items-center gap-3 px-6 py-4 bg-card/80 backdrop-blur-md border border-border/60 hover:border-foreground/60 text-foreground text-sm tracking-[0.2em] uppercase font-medium transition-all hover:bg-card"
        >
          <Printer className="w-4 h-4" />
          Own it
        </button>
      </div>
    </>
  );
};

export default SpectralEarthHUD;
