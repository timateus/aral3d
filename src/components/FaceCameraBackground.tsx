import { useEffect, useRef, useState } from 'react';
import { FACE_PHRASES } from '@/lib/face-phrases';
import { faceModeBridge } from '@/lib/face-mode-bridge';

// Level 7 — Face as Infrastructure.
// Camera = background. MediaPipe Hands runs and dispatches `face:gesture`
// events consumed by FaceGestureController inside the R3F canvas.
//
// Gestures (continuous while held):
//   • open palm LEFT/RIGHT/TOP/BOTTOM    → keep rotating in that direction
//   • two hands close together (🙏 pray) → keep zooming IN
//   • two hands apart (spread)           → keep zooming OUT
//   • index finger ☝ up                  → reveal a random data-layer card
//
// Significant mode changes trigger a `face:phrase` event with a phrase
// from the curated water-logy manifesto (rendered Level-1 style).

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
  azimuthDelta: number;
  polarDelta: number;
  zoomDelta: number;
  handCount: number;
}

// Cycle through manifesto phrases sequentially (random start)
let phraseCursor = Math.floor(Math.random() * FACE_PHRASES.length);
let lastPhraseAt = 0;
function emitPhrase(minGapMs = 1200) {
  const now = performance.now();
  if (now - lastPhraseAt < minGapMs) return;
  lastPhraseAt = now;
  phraseCursor = (phraseCursor + 1) % FACE_PHRASES.length;
  window.dispatchEvent(new CustomEvent('face:phrase', { detail: { text: FACE_PHRASES[phraseCursor] } }));
}

// --- Hand-shape detectors --------------------------------------------------
function isFingerExt(lm: any[], tip: number, pip: number) {
  return lm[tip].y < lm[pip].y - 0.015;
}
function isFingerFold(lm: any[], tip: number, pip: number) {
  return lm[tip].y > lm[pip].y - 0.005;
}
function isOpenPalm(lm: any[]): boolean {
  if (!lm || lm.length < 21) return false;
  // Relaxed: at least 3 of 4 non-thumb fingers extended. MediaPipe drops a
  // finger or two when the hand is near the edge of the frame, which used
  // to make orbit "get stuck" mid-rotation.
  let ext = 0;
  if (isFingerExt(lm, 8, 6))  ext++;
  if (isFingerExt(lm, 12, 10)) ext++;
  if (isFingerExt(lm, 16, 14)) ext++;
  if (isFingerExt(lm, 20, 18)) ext++;
  return ext >= 3;
}
function isOneFingerUp(lm: any[]): boolean {
  if (!lm || lm.length < 21) return false;
  return (
    isFingerExt(lm, 8, 6) &&
    isFingerFold(lm, 12, 10) &&
    isFingerFold(lm, 16, 14) &&
    isFingerFold(lm, 20, 18)
  );
}

type PalmDir = 'left' | 'right' | 'top' | 'bottom' | null;
function palmDirection(cx: number, cy: number): PalmDir {
  // cx, cy in [0,1]. Small deadzone, and bias HORIZONTAL: if the hand is
  // clearly to the left/right of center, lock to L/R even if it drifts up
  // or down a little (otherwise rotation flapped to top/bottom and stuck).
  const dx = cx - 0.5;
  const dy = cy - 0.5;
  const DZ = 0.08;
  const H_BIAS = 0.10; // |dx| above this → always horizontal
  if (Math.abs(dx) < DZ && Math.abs(dy) < DZ) return null;
  if (Math.abs(dx) >= H_BIAS) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'top' : 'bottom';
  return dx < 0 ? 'left' : 'right';
}

const FaceCameraBackground = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const [status, setStatus] = useState('booting…');
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef({
    lastHandCount: 0,
    palmDir: null as PalmDir,
    palmDirAt: 0,           // ms timestamp of last positive palmDir
    twoHandMode: null as null | 'in' | 'out',
    fingerUpActive: false,
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

        const hands = new window.Hands({ locateFile: (f: string) => CDN_BASE + f });
        hands.setOptions({
          maxNumHands: 2,
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

          const handLms = (results.multiHandLandmarks ?? []) as any[][];
          const st = stateRef.current;
          const count = handLms.length;

          // Per-second rates written into the bridge — the gesture controller
          // applies them every frame so motion is smooth & truly continuous.
          let azRate = 0, polRate = 0, zoomRate = 0;

          // ---- TWO HANDS: pray vs spread → continuous zoom ----
          if (count >= 2) {
            const c0 = { x: (handLms[0][0].x + handLms[0][9].x) / 2, y: (handLms[0][0].y + handLms[0][9].y) / 2 };
            const c1 = { x: (handLms[1][0].x + handLms[1][9].x) / 2, y: (handLms[1][0].y + handLms[1][9].y) / 2 };
            const spread = Math.hypot(c1.x - c0.x, c1.y - c0.y);
            const NEAR = 0.22, FAR = 0.34;
            let mode: 'in' | 'out' | null = null;
            if (spread < NEAR) mode = 'in';
            else if (spread > FAR) mode = 'out';

            if (mode !== st.twoHandMode) {
              if (mode) emitPhrase();
              st.twoHandMode = mode;
            }
            // Continuous zoom rates (units / second)
            if (mode === 'in')  zoomRate = -14;
            if (mode === 'out') zoomRate =  14;

            st.palmDir = null;
            if (st.fingerUpActive) {
              st.fingerUpActive = false;
              window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: false } }));
            }

            const p0 = { x: (1 - c0.x) * W, y: c0.y * H };
            const p1 = { x: (1 - c1.x) * W, y: c1.y * H };
            ctx.strokeStyle = mode === 'in' ? '#5fffaf' : (mode === 'out' ? '#ff5577' : '#ffd166');
            ctx.lineWidth = 3;
            ctx.setLineDash(mode ? [] : [6, 6]);
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
            ctx.setLineDash([]);
            [p0, p1].forEach((p) => {
              ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
            });
          }
          // ---- ONE HAND: open palm → continuous orbit ----
          else if (count === 1) {
            const lm = handLms[0];
            const cx = (lm[0].x + lm[9].x) / 2;
            const cy = (lm[0].y + lm[9].y) / 2;

            st.twoHandMode = null;

            const palmOK = isOpenPalm(lm);
            const oneUp = isOneFingerUp(lm);
            // Treat hand-as-palm if it's NOT clearly an index-up gesture —
            // MediaPipe sometimes drops 1-2 finger landmarks and we don't
            // want orbit to flicker off mid-gesture.
            const treatAsPalm = palmOK || (!oneUp && (performance.now() - st.palmDirAt) < 600 && st.palmDir != null);

            if (treatAsPalm) {
              const dir = palmDirection(cx, cy);
              const effDir = dir ?? st.palmDir; // grace: reuse last dir inside deadzone
              if (effDir !== st.palmDir) {
                if (effDir) emitPhrase();
                st.palmDir = effDir;
              }
              if (effDir) st.palmDirAt = performance.now();
              // Continuous orbit rates (radians / second)
              const SPEED = 1.1;
              if (effDir === 'left')   azRate  = +SPEED;
              if (effDir === 'right')  azRate  = -SPEED;
              if (effDir === 'top')    polRate = +SPEED;
              if (effDir === 'bottom') polRate = -SPEED;

              const hx = (1 - cx) * W, hy = cy * H;
              ctx.strokeStyle = '#5fffaf';
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(hx, hy, 36, 0, Math.PI * 2); ctx.stroke();
              if (effDir) {
                ctx.fillStyle = '#5fffaf';
                ctx.font = 'bold 28px ui-monospace, monospace';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const glyph = effDir === 'left' ? '←' : effDir === 'right' ? '→' : effDir === 'top' ? '↑' : '↓';
                ctx.fillText(glyph, hx, hy);
              }
            } else {
              st.palmDir = null;

              const fingerUp = isOneFingerUp(lm);
              if (fingerUp && !st.fingerUpActive) {
                st.fingerUpActive = true;
                emitPhrase();
                window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: true } }));
              } else if (!fingerUp && st.fingerUpActive) {
                st.fingerUpActive = false;
                window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: false } }));
              }

              if (fingerUp) {
                const tip = lm[8];
                const tx = (1 - tip.x) * W, ty = tip.y * H;
                ctx.strokeStyle = '#ff5577';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(tx, ty, 30, 0, Math.PI * 2); ctx.stroke();
              } else {
                const hx = (1 - cx) * W, hy = cy * H;
                ctx.strokeStyle = '#5bc0ff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(hx, hy, 22, 0, Math.PI * 2); ctx.stroke();
              }
            }
          }
          // ---- NO HANDS ----
          else {
            // MediaPipe can briefly drop an open palm near frame edges; keep the
            // last L/R/T/B orbit alive for a moment so rotation does not feel stuck.
            const age = performance.now() - st.palmDirAt;
            if (st.palmDir && age < 750) {
              const SPEED = 1.1;
              if (st.palmDir === 'left')   azRate  = +SPEED;
              if (st.palmDir === 'right')  azRate  = -SPEED;
              if (st.palmDir === 'top')    polRate = +SPEED;
              if (st.palmDir === 'bottom') polRate = -SPEED;
            } else {
              st.palmDir = null;
            }
            st.twoHandMode = null;
            if (st.fingerUpActive) {
              st.fingerUpActive = false;
              window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: false } }));
            }
          }

          if (count !== st.lastHandCount) {
            emitPhrase();
            st.lastHandCount = count;
          }

          // Publish current intent — controller polls every frame.
          faceModeBridge.intent.azimuthRate = azRate;
          faceModeBridge.intent.polarRate   = polRate;
          faceModeBridge.intent.zoomRate    = zoomRate;


          // Bottom legend
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(16, H - 36, 420, 20);
          ctx.fillStyle = '#fff';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(
            count === 0 ? 'open palm L/R/T/B · two hands together to zoom in · apart to zoom out'
            : count === 1 ? 'open palm to orbit · ☝ index up cycles data layers (raise to show, raise again to hide)'
            : st.twoHandMode === 'in' ? '🙏 zooming in…'
            : st.twoHandMode === 'out' ? '↔ zooming out…'
            : 'two hands · come closer to zoom in, spread apart to zoom out',
            22, H - 22
          );
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
      try { handsRef.current?.close?.(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
      faceModeBridge.intent.azimuthRate = 0;
      faceModeBridge.intent.polarRate = 0;
      faceModeBridge.intent.zoomRate = 0;
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className="fixed inset-0 w-full h-full object-cover -scale-x-100"
        style={{ zIndex: 0 }}
      />
      <canvas
        ref={overlayRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 35 }}
      />
      <div
        data-hud
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-white/80 font-mono text-[11px]"
      >
        {error
          ? <span className="text-red-300">⚠ {error} — allow camera access</span>
          : <>face · {status} · palm orbits · 🙏 zoom in · ↔ zoom out · ☝ data layer</>}
      </div>
    </>
  );
};

export default FaceCameraBackground;
