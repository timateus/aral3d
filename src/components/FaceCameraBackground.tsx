import { useEffect, useRef, useState } from 'react';

// Level 7 — Face as Infrastructure (new pass).
// Camera feed is the BACKGROUND (full screen, mirrored). MediaPipe Hands runs
// on the feed and dispatches `face:gesture` CustomEvents that the in-Canvas
// FaceGestureController uses to orbit/zoom the terrain.

declare global { interface Window { Hands?: any } }

const CDN_SCRIPT = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/';

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

interface GestureDetail {
  azimuthDelta: number; // radians per frame
  polarDelta: number;   // radians per frame
  zoomDelta: number;    // distance delta per frame (positive = zoom out)
  pinch: number;        // 0..1 (0 = fully pinched)
  handX: number;        // 0..1 in viewport
  handY: number;        // 0..1 in viewport
  hasHand: boolean;
}

const FaceCameraBackground = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState('booting…');
  const [error, setError] = useState<string | null>(null);

  // Smoothed state for gesture conversion.
  const stateRef = useRef({
    lastX: 0.5,
    lastY: 0.5,
    lastPinch: 1,
    hasHand: false,
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        setStatus('loading mediapipe hands…');
        await loadScript(CDN_SCRIPT);
        if (!window.Hands) throw new Error('Hands unavailable');

        setStatus('requesting camera…');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();

        const hands = new window.Hands({
          locateFile: (file: string) => CDN_BASE + file,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
          selfieMode: true,
        });
        hands.onResults((results: any) => {
          const ov = overlayRef.current;
          if (!ov) return;
          const W = (ov.width = window.innerWidth);
          const H = (ov.height = window.innerHeight);
          const ctx = ov.getContext('2d')!;
          ctx.clearRect(0, 0, W, H);

          const lm = results.multiHandLandmarks?.[0];
          const st = stateRef.current;

          if (lm && lm.length > 0) {
            // landmarks: 0=wrist, 4=thumb tip, 8=index tip, 12=middle tip, 9=middle MCP
            const idx = lm[8], thumb = lm[4], wrist = lm[0];
            // Hand center ~ between wrist and middle MCP (lm[9])
            const cx = (wrist.x + lm[9].x) / 2;
            const cy = (wrist.y + lm[9].y) / 2;
            // Pinch: distance between thumb tip and index tip in normalized coords.
            const dx = idx.x - thumb.x;
            const dy = idx.y - thumb.y;
            const pinch = Math.min(1, Math.hypot(dx, dy) * 4);

            const newX = cx, newY = cy;
            const azimuthDelta = -(newX - st.lastX) * 4.0;   // hand right → orbit right
            const polarDelta = -(newY - st.lastY) * 4.0;     // hand up → orbit up
            // Zoom maps pinch absolutely so closing fist zooms in.
            const zoomTarget = (pinch - 0.5) * 30; // -15..+15 distance
            const zoomDelta = (zoomTarget - (st.lastPinch - 0.5) * 30) * 0.4;

            st.lastX = newX; st.lastY = newY; st.lastPinch = pinch; st.hasHand = true;

            const detail: GestureDetail = {
              azimuthDelta, polarDelta, zoomDelta, pinch,
              handX: newX, handY: newY, hasHand: true,
            };
            window.dispatchEvent(new CustomEvent('face:gesture', { detail }));

            // Mirror the X for drawing (overlay isn't mirrored vs the mirrored video).
            const px = (1 - cx) * W;
            const py = cy * H;
            // Hand crosshair
            ctx.strokeStyle = pinch < 0.35 ? '#ff5577' : '#5fffaf';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(px, py, 24, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10); ctx.stroke();
            // Pinch indicator
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(16, H - 36, 160, 20);
            ctx.fillStyle = pinch < 0.35 ? '#ff5577' : '#5fffaf';
            ctx.fillRect(18, H - 34, Math.max(2, pinch * 156), 16);
            ctx.fillStyle = '#fff';
            ctx.font = '11px ui-monospace, monospace';
            ctx.fillText(`pinch ${pinch.toFixed(2)}  →  zoom`, 22, H - 22);
          } else {
            st.hasHand = false;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(16, H - 36, 220, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '11px ui-monospace, monospace';
            ctx.fillText('raise one hand to control terrain', 22, H - 22);
          }
        });
        handsRef.current = hands;
        setStatus('live');

        const loop = async () => {
          if (cancelled) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try { await hands.send({ image: videoRef.current }); } catch {}
          }
          setTimeout(loop, 60);
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
      try { handsRef.current?.close?.(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <>
      {/* Background camera — full screen, mirrored, behind the R3F canvas */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="fixed inset-0 w-full h-full object-cover -scale-x-100"
        style={{ zIndex: 0 }}
      />
      {/* Soft vignette so the terrain reads on top */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 1, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }}
      />
      {/* Gesture HUD overlay (crosshair + pinch bar) — non-interactive */}
      <canvas
        ref={overlayRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 35 }}
      />
      <div
        data-hud
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-white/80 font-mono text-[11px]"
      >
        {error ? <span className="text-red-300">⚠ {error} — allow camera access</span> : <>gestures · {status}  ·  move hand to orbit  ·  pinch to zoom</>}
      </div>
    </>
  );
};

export default FaceCameraBackground;
