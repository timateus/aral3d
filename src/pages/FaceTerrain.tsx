import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// MediaPipe Selfie Segmentation loaded from CDN at runtime (keeps bundle slim).
// The webcam feed is segmented: person -> kept, background -> replaced with the
// same dark dotted grid used behind the terrain. A topographic gradient is
// then composited *onto* the person silhouette so the terrain appears to wrap
// the face/body.

declare global {
  interface Window {
    SelfieSegmentation?: any;
  }
}

const CDN_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Paint a dotted grid identical in spirit to the terrain backdrop.
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 160, 200, 0.35)';
  const step = 28;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // soft vignette
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// 6-stop topographic ramp sampled at any t in [0,1].
const RAMP: [number, [number, number, number]][] = [
  [0.00, [11, 59, 115]],   // deep water
  [0.22, [43, 108, 176]],  // water
  [0.42, [217, 195, 137]], // sand
  [0.62, [79, 107, 58]],   // grass / saxaul
  [0.82, [138, 130, 117]], // rock
  [1.00, [244, 244, 246]], // snow
];
function rampColor(t: number, out: [number, number, number]) {
  if (t <= 0) { const c = RAMP[0][1]; out[0]=c[0]; out[1]=c[1]; out[2]=c[2]; return; }
  if (t >= 1) { const c = RAMP[RAMP.length-1][1]; out[0]=c[0]; out[1]=c[1]; out[2]=c[2]; return; }
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const a = RAMP[i-1], b = RAMP[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      out[0] = a[1][0] + (b[1][0] - a[1][0]) * k;
      out[1] = a[1][1] + (b[1][1] - a[1][1]) * k;
      out[2] = a[1][2] + (b[1][2] - a[1][2]) * k;
      return;
    }
  }
}

const FaceTerrain = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState('booting…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        setStatus('loading mediapipe…');
        await loadScript(CDN_SCRIPT);
        if (!window.SelfieSegmentation) throw new Error('SelfieSegmentation unavailable');
        if (cancelled) return;

        setStatus('requesting camera…');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();

        const c = canvasRef.current!;
        const ctx = c.getContext('2d')!;
        const W = (c.width = v.videoWidth || 1280);
        const H = (c.height = v.videoHeight || 720);

        const composite = (results: any) => {
          // 1) grid background
          drawGrid(ctx, W, H);

          // 2) cut person from camera using the segmentation mask
          //    person canvas = video * mask
          const personCanvas = document.createElement('canvas');
          personCanvas.width = W;
          personCanvas.height = H;
          const pctx = personCanvas.getContext('2d')!;
          // mirror so it feels like a mirror
          pctx.save();
          pctx.translate(W, 0);
          pctx.scale(-1, 1);
          pctx.drawImage(results.image ?? v, 0, 0, W, H);
          pctx.restore();
          pctx.globalCompositeOperation = 'destination-in';
          pctx.save();
          pctx.translate(W, 0);
          pctx.scale(-1, 1);
          pctx.drawImage(results.segmentationMask, 0, 0, W, H);
          pctx.restore();

          // 3) draw the person on top of the grid
          ctx.drawImage(personCanvas, 0, 0);

          // 4) terrain gradient overlay — clipped to the person silhouette
          const overlay = document.createElement('canvas');
          overlay.width = W;
          overlay.height = H;
          const octx = overlay.getContext('2d')!;
          octx.drawImage(getTerrainGradient(H), 0, 0, W, H);
          octx.globalCompositeOperation = 'destination-in';
          octx.save();
          octx.translate(W, 0);
          octx.scale(-1, 1);
          octx.drawImage(results.segmentationMask, 0, 0, W, H);
          octx.restore();

          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.85;
          ctx.drawImage(overlay, 0, 0);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';

          // 5) subtle contour rings on top of the silhouette
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          const tNow = performance.now() / 1000;
          for (let i = 0; i < 14; i++) {
            const y = ((i / 14) * H + (tNow * 20) % (H / 14)) % H;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          }
          ctx.restore();
        };

        const seg = new window.SelfieSegmentation({
          locateFile: (file: string) => CDN_BASE + file,
        });
        seg.setOptions({ modelSelection: 1, selfieMode: true });
        seg.onResults(composite);
        segRef.current = seg;

        setStatus('live');

        const loop = async () => {
          if (cancelled) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              await seg.send({ image: videoRef.current });
            } catch {
              /* ignore intermittent send errors */
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try { segRef.current?.close?.(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#05070b] overflow-hidden text-white font-mono">
      {/* hidden source video — drawn into the canvas */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ imageRendering: 'auto' }}
      />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
        <span className="text-white/90 text-[11px] tracking-wider uppercase">
          Face Terrain · MediaPipe
        </span>
        <span className="text-white/40 text-[10px]">
          camera in · background grid · terrain painted onto you
        </span>
      </div>

      <Link
        to="/"
        className="absolute top-4 right-4 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-[11px] hover:bg-black/80"
      >
        Exit
      </Link>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/70 text-[11px]">
        {error ? <span className="text-red-300">⚠ {error} — allow camera access and reload</span> : <>status: {status}</>}
      </div>
    </div>
  );
};

export default FaceTerrain;
