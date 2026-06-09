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
        // Internal processing resolution (downscaled for speed).
        const PW = 480;
        const PH = Math.round((PW * H) / W);
        const procPerson = document.createElement('canvas');
        procPerson.width = PW; procPerson.height = PH;
        const ppctx = procPerson.getContext('2d')!;
        const procMask = document.createElement('canvas');
        procMask.width = PW; procMask.height = PH;
        const pmctx = procMask.getContext('2d')!;
        const terrainOut = document.createElement('canvas');
        terrainOut.width = PW; terrainOut.height = PH;
        const toctx = terrainOut.getContext('2d')!;
        const terrainImage = toctx.createImageData(PW, PH);

        const composite = (results: any) => {
          // 1) grid background (full res)
          drawGrid(ctx, W, H);

          // 2) Render mirrored video + mirrored mask into small proc canvases.
          ppctx.save(); ppctx.translate(PW, 0); ppctx.scale(-1, 1);
          ppctx.drawImage(results.image ?? v, 0, 0, PW, PH);
          ppctx.restore();
          pmctx.clearRect(0, 0, PW, PH);
          pmctx.save(); pmctx.translate(PW, 0); pmctx.scale(-1, 1);
          pmctx.drawImage(results.segmentationMask, 0, 0, PW, PH);
          pmctx.restore();

          const personPx = ppctx.getImageData(0, 0, PW, PH).data;
          const maskPx = pmctx.getImageData(0, 0, PW, PH).data;
          const out = terrainImage.data;

          // 3) Build terrain pixels from luminance heightmap.
          //    height = blurred luminance of person; alpha = segmentation mask.
          //    Contour lines drawn every 1/12 of the height range.
          const lum = new Float32Array(PW * PH);
          for (let i = 0; i < PW * PH; i++) {
            const r = personPx[i * 4], g = personPx[i * 4 + 1], b = personPx[i * 4 + 2];
            lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          }
          const rgb: [number, number, number] = [0, 0, 0];
          const CONTOURS = 12;
          for (let y = 0; y < PH; y++) {
            for (let x = 0; x < PW; x++) {
              const i = y * PW + x;
              const a = maskPx[i * 4 + 3]; // mask alpha
              if (a < 24) {
                out[i * 4] = 0; out[i * 4 + 1] = 0; out[i * 4 + 2] = 0; out[i * 4 + 3] = 0;
                continue;
              }
              const h = lum[i];
              rampColor(h, rgb);

              // simple hillshade from x-derivative
              const xl = x > 0 ? lum[i - 1] : h;
              const xr = x < PW - 1 ? lum[i + 1] : h;
              const slope = (xr - xl) * 2.2; // -1..1ish
              const shade = 1 + slope * 0.55;

              // hard contour bands every 1/CONTOURS
              const band = h * CONTOURS;
              const frac = band - Math.floor(band);
              const isContour = frac < 0.06 || frac > 0.94;
              const cmul = isContour ? 0.35 : 1.0;

              out[i * 4]     = Math.max(0, Math.min(255, rgb[0] * shade * cmul));
              out[i * 4 + 1] = Math.max(0, Math.min(255, rgb[1] * shade * cmul));
              out[i * 4 + 2] = Math.max(0, Math.min(255, rgb[2] * shade * cmul));
              out[i * 4 + 3] = a;
            }
          }
          toctx.putImageData(terrainImage, 0, 0);

          // 4) Stamp the terrain person onto the grid at full res (opaque).
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(terrainOut, 0, 0, W, H);

          // 5) Outline ring around silhouette so the body reads against the grid.
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 8;
          ctx.drawImage(terrainOut, 0, 0, W, H); // re-draw to bake shadow halo
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
