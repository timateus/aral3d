import { ArrowLeft, Sparkles, Printer } from 'lucide-react';
import { applyRandomPreset, generateRandomRamp, setVisualMode } from '@/lib/visual-mode';

interface Props {
  onExit: () => void;
}

const SpectralEarthHUD = ({ onExit }: Props) => {
  const handleDesign = () => {
    // Ensure designer mode is on so palette propagates to rivers/borders/terrain.
    setVisualMode('designer');
    // 50/50 between curated preset and a freshly generated random ramp.
    if (Math.random() < 0.5) {
      applyRandomPreset();
    } else {
      generateRandomRamp();
    }
  };

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

  return (
    <>
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
        className="absolute top-5 left-5 z-40 flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.15em] uppercase bg-card/60 backdrop-blur-md border border-border/40 text-foreground hover:bg-card/90 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Menu
      </button>

      {/* Bottom action buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
        <button
          onClick={handleDesign}
          className="group flex items-center gap-3 px-8 py-4 bg-card/70 backdrop-blur-md border border-border/50 hover:border-primary/60 text-foreground text-sm tracking-[0.2em] uppercase font-medium transition-all hover:bg-card/90"
        >
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          Design your Earth
        </button>
        <button
          onClick={handlePrint}
          className="group flex items-center gap-3 px-6 py-4 bg-card/70 backdrop-blur-md border border-border/50 hover:border-primary/60 text-foreground text-sm tracking-[0.2em] uppercase font-medium transition-all hover:bg-card/90"
        >
          <Printer className="w-4 h-4" />
          Print your Earth
        </button>
      </div>
    </>
  );
};

export default SpectralEarthHUD;
