import { useEffect, useRef, useState } from 'react';

// Level 7 — Face as Infrastructure.
// Camera = background. MediaPipe Hands runs and dispatches `face:gesture`
// events consumed by FaceGestureController inside the R3F canvas.
//
// Gestures (smoothed, two-handed):
//   • one hand pan      → orbit (azimuth/polar deltas, heavily smoothed + deadzone)
//   • two hands         → distance between hand centers controls zoom
//   • one finger up     → reveal a random "data layer" info card while held
//
// Significant gesture transitions trigger a `face:phrase` event with random
// typography (consumed by the page-level FacePhraseLayer).

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

// Phrases shown on the screen when modes change.
const PHRASES_HANDS_LOST = ['no hands', 'show me your hands', 'where did you go', 'lift a hand'];
const PHRASES_ONE_HAND   = ['orbit the terrain', 'pan to look around', 'one hand · navigate', 'face as infrastructure'];
const PHRASES_TWO_HANDS  = ['spread to zoom', 'two-hand zoom engaged', 'pinch the world', 'pull the horizon'];
const PHRASES_FINGER_UP  = ['reading the land', 'data layer revealed', 'one finger · one truth', 'the map speaks'];

const FONT_FAMILIES = [
  '"Times New Roman", serif',
  '"Georgia", serif',
  '"Courier New", monospace',
  '"Impact", sans-serif',
  '"Helvetica Neue", Arial, sans-serif',
  '"Brush Script MT", cursive',
  '"Trebuchet MS", sans-serif',
  '"Palatino", serif',
  '"Verdana", sans-serif',
  '"Lucida Console", monospace',
];
const PHRASE_COLORS = ['#ffffff', '#5fffaf', '#ff5577', '#ffd166', '#5bc0ff', '#c084fc', '#fb923c'];

function emitPhrase(text: string) {
  const detail = {
    text,
    font: FONT_FAMILIES[Math.floor(Math.random() * FONT_FAMILIES.length)],
    color: PHRASE_COLORS[Math.floor(Math.random() * PHRASE_COLORS.length)],
    size: 28 + Math.floor(Math.random() * 64),
    weight: ['300','400','700','900'][Math.floor(Math.random()*4)],
    italic: Math.random() < 0.35,
    transform: (['uppercase','lowercase','none'] as const)[Math.floor(Math.random()*3)],
    x: 0.1 + Math.random() * 0.7,
    y: 0.15 + Math.random() * 0.6,
    rotate: (Math.random() - 0.5) * 16,
  };
  window.dispatchEvent(new CustomEvent('face:phrase', { detail }));
}

// Detect "one finger up": index extended, middle/ring/pinky folded.
function isOneFingerUp(lm: any[]): boolean {
  if (!lm || lm.length < 21) return false;
  // y is inverted in image coords (0 = top). "Extended" = tip above PIP joint.
  const indexExt  = lm[8].y  < lm[6].y  - 0.02;
  const midFold   = lm[12].y > lm[10].y - 0.005;
  const ringFold  = lm[16].y > lm[14].y - 0.005;
  const pinkyFold = lm[20].y > lm[18].y - 0.005;
  return indexExt && midFold && ringFold && pinkyFold;
}

const FaceCameraBackground = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const handsRef = useRef<any>(null);
  const [status, setStatus] = useState('booting…');
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef({
    // smoothed hand center
    smX: 0.5, smY: 0.5,
    // smoothed two-hand spread
    smSpread: 0.3,
    haveSmooth: false,
    haveSpread: false,
    // mode tracking
    lastHandCount: 0,
    fingerUpActive: false,
    fingerUpStart: 0,
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

          const hands = (results.multiHandLandmarks ?? []) as any[][];
          const st = stateRef.current;
          const count = hands.length;

          // ---- Mode-change phrases ----
          if (count !== st.lastHandCount) {
            if (count === 0) emitPhrase(PHRASES_HANDS_LOST[Math.floor(Math.random()*PHRASES_HANDS_LOST.length)]);
            else if (count === 1) emitPhrase(PHRASES_ONE_HAND[Math.floor(Math.random()*PHRASES_ONE_HAND.length)]);
            else if (count >= 2) emitPhrase(PHRASES_TWO_HANDS[Math.floor(Math.random()*PHRASES_TWO_HANDS.length)]);
            st.lastHandCount = count;
          }

          let azimuthDelta = 0, polarDelta = 0, zoomDelta = 0;

          if (count >= 1) {
            // ---- Hand centers ----
            const centers = hands.map((lm) => ({
              x: (lm[0].x + lm[9].x) / 2,
              y: (lm[0].y + lm[9].y) / 2,
            }));

            // ---- ORBIT from primary hand (heavily smoothed + deadzone) ----
            const primary = centers[0];
            const ALPHA = 0.18; // low-pass filter — smaller = smoother (was effectively 1.0)
            if (!st.haveSmooth) { st.smX = primary.x; st.smY = primary.y; st.haveSmooth = true; }
            const targetX = st.smX + (primary.x - st.smX) * ALPHA;
            const targetY = st.smY + (primary.y - st.smY) * ALPHA;
            const rawDx = targetX - st.smX;
            const rawDy = targetY - st.smY;
            const DEADZONE = 0.002;
            const dxApplied = Math.abs(rawDx) < DEADZONE ? 0 : rawDx;
            const dyApplied = Math.abs(rawDy) < DEADZONE ? 0 : rawDy;
            // Lower gain — was 4.0
            azimuthDelta = -dxApplied * 1.6;
            polarDelta = -dyApplied * 1.6;
            st.smX = targetX; st.smY = targetY;

            // ---- ZOOM from two-hand spread ----
            if (count >= 2) {
              const dx = centers[1].x - centers[0].x;
              const dy = centers[1].y - centers[0].y;
              const spread = Math.hypot(dx, dy); // normalized 0..~1.4
              if (!st.haveSpread) { st.smSpread = spread; st.haveSpread = true; }
              const newSpread = st.smSpread + (spread - st.smSpread) * 0.25;
              const ds = newSpread - st.smSpread;
              if (Math.abs(ds) > 0.003) {
                // spread larger → zoom IN (negative distance delta)
                zoomDelta = -ds * 60;
              }
              st.smSpread = newSpread;
            } else {
              st.haveSpread = false;
            }

            // ---- ONE-FINGER-UP gesture (only when single hand visible) ----
            const fingerUp = count === 1 && isOneFingerUp(hands[0]);
            if (fingerUp && !st.fingerUpActive) {
              st.fingerUpActive = true;
              st.fingerUpStart = performance.now();
              emitPhrase(PHRASES_FINGER_UP[Math.floor(Math.random()*PHRASES_FINGER_UP.length)]);
              window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: true } }));
            } else if (!fingerUp && st.fingerUpActive) {
              st.fingerUpActive = false;
              window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: false } }));
            }

            // ---- Draw hand markers (mirrored back to overlay) ----
            ctx.lineWidth = 2;
            centers.forEach((c, i) => {
              const px = (1 - c.x) * W;
              const py = c.y * H;
              ctx.strokeStyle = i === 0 ? '#5fffaf' : '#5bc0ff';
              ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.stroke();
            });

            // Two-hand zoom indicator: line between hands
            if (count >= 2) {
              const p0 = { x: (1 - centers[0].x) * W, y: centers[0].y * H };
              const p1 = { x: (1 - centers[1].x) * W, y: centers[1].y * H };
              ctx.strokeStyle = '#ffd166';
              ctx.setLineDash([6, 6]);
              ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
              ctx.setLineDash([]);
            }

            // Finger-up highlight
            if (fingerUp) {
              const tip = hands[0][8];
              const tx = (1 - tip.x) * W;
              const ty = tip.y * H;
              ctx.strokeStyle = '#ff5577';
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(tx, ty, 30, 0, Math.PI * 2); ctx.stroke();
            }
          } else {
            st.haveSmooth = false;
            st.haveSpread = false;
            if (st.fingerUpActive) {
              st.fingerUpActive = false;
              window.dispatchEvent(new CustomEvent('face:fingerup', { detail: { active: false } }));
            }
          }

          if (azimuthDelta || polarDelta || zoomDelta) {
            const detail: GestureDetail = { azimuthDelta, polarDelta, zoomDelta, handCount: count };
            window.dispatchEvent(new CustomEvent('face:gesture', { detail }));
          }

          // Bottom legend
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(16, H - 36, 360, 20);
          ctx.fillStyle = '#fff';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(
            count === 0 ? 'raise a hand · two hands to zoom · index up for layer'
            : count === 1 ? 'one hand · orbit  (raise two hands to zoom)'
            : 'two hands · spread to zoom out, close to zoom in',
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
          : <>face · {status}  ·  one hand orbits · two hands zoom · index ☝ reveals a layer</>}
      </div>
    </>
  );
};

export default FaceCameraBackground;
