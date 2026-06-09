import { useEffect, useRef, useState } from 'react';

// Level 7 — Face as Infrastructure.
// Renders on top of the existing 3D terrain scene. The webcam feed is
// segmented (MediaPipe Selfie Segmentation, loaded from CDN) and the live
// terrain pixels from the R3F canvas are clipped to the person silhouette.
// Everything outside the silhouette is replaced with the same dotted grid
// backdrop used elsewhere. Gamepad still controls the underlying terrain
// camera, so the projection moves as the terrain moves.

declare global {
  interface Window { SelfieSegmentation?: any }
}

const CDN_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120, 160, 200, 0.32)';
  const step = 28;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) ctx.fillRect(x, y, 1, 1);
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Locate the live R3F canvas — it's the only <canvas> in the page other than
// ours. We mark ours with data-face-overlay so it's easy to exclude.
function findSceneCanvas(self: HTMLCanvasElement | null): HTMLCanvasElement | null {
  const all = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
  for (const c of all) {
    if (c === self) continue;
    if (c.dataset.faceOverlay === '1') continue;
    if (c.width > 0 && c.height > 0) return c;
  }
  return null;
}

const FaceProjectionOverlay = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const segRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastMaskRef = useRef<HTMLCanvasElement | null>(null);
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

        setStatus('requesting camera…');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();

        const seg = new window.SelfieSegmentation({
          locateFile: (file: string) => CDN_BASE + file,
        });
        seg.setOptions({ modelSelection: 1, selfieMode: true });

        // Mask buffer kept at video resolution. We sample its alpha later.
        const VW = v.videoWidth || 640;
        const VH = v.videoHeight || 480;
        const maskBuf = document.createElement('canvas');
        maskBuf.width = VW; maskBuf.height = VH;
        const mctx = maskBuf.getContext('2d')!;
        maskRef.current = maskBuf;

        seg.onResults((results: any) => {
          mctx.clearRect(0, 0, VW, VH);
          // mirror so it feels like a mirror
          mctx.save();
          mctx.translate(VW, 0);
          mctx.scale(-1, 1);
          mctx.drawImage(results.segmentationMask, 0, 0, VW, VH);
          mctx.restore();
          lastMaskRef.current = maskBuf;
        });
        segRef.current = seg;

        setStatus('live');

        const segLoop = async () => {
          if (cancelled) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try { await seg.send({ image: videoRef.current }); } catch {}
          }
          setTimeout(segLoop, 50);
        };
        segLoop();
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
        setStatus('error');
      }
    })();

    // Render loop: composites grid + (terrain ∩ silhouette) every frame.
    const render = () => {
      if (cancelled) return;
      const overlay = overlayRef.current;
      if (overlay) {
        // Match viewport.
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (overlay.width !== W) overlay.width = W;
        if (overlay.height !== H) overlay.height = H;
        const ctx = overlay.getContext('2d')!;

        // 1) Grid background.
        drawGrid(ctx, W, H);

        // 2) Live terrain pixels — find R3F canvas and copy its content.
        const scene = findSceneCanvas(overlay);
        const mask = lastMaskRef.current;
        if (scene && mask) {
          // Build a silhouette-clipped copy of the scene canvas at viewport size.
          // Step A: draw scene -> tmp
          const tmp = document.createElement('canvas');
          tmp.width = W; tmp.height = H;
          const tctx = tmp.getContext('2d')!;
          try {
            tctx.drawImage(scene, 0, 0, W, H);
          } catch {
            /* tainted canvas — skip */
          }
          // Step B: aspect-fit (cover) the segmentation mask over the viewport,
          // centered, so the person appears at the same scale they'd see in a webcam.
          tctx.globalCompositeOperation = 'destination-in';
          const mw = mask.width;
          const mh = mask.height;
          const scale = Math.max(W / mw, H / mh);
          const dw = mw * scale;
          const dh = mh * scale;
          const dx = (W - dw) / 2;
          const dy = (H - dh) / 2;
          tctx.drawImage(mask, dx, dy, dw, dh);
          tctx.globalCompositeOperation = 'source-over';

          // 3) Stamp masked terrain on top of grid.
          ctx.drawImage(tmp, 0, 0);

          // 4) Outline halo so the silhouette pops against the grid.
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 12;
          ctx.drawImage(tmp, 0, 0);
          ctx.restore();
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try { segRef.current?.close?.(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <>
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas
        ref={overlayRef}
        data-face-overlay="1"
        className="fixed inset-0 w-full h-full pointer-events-none z-30"
      />
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-white/80 font-mono text-[11px] pointer-events-auto">
        {error ? <span className="text-red-300">⚠ {error} — allow camera access</span> : <>face projection · {status}</>}
      </div>
    </>
  );
};

export default FaceProjectionOverlay;
