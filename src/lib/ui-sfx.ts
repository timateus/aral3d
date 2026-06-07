// Tiny WebAudio click/blip generator for UI sound effects.
// No assets, no external deps.

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface BlipOpts {
  freq?: number;
  freqEnd?: number;
  duration?: number;   // seconds
  type?: OscillatorType;
  gain?: number;
}

function blip({ freq = 600, freqEnd, duration = 0.06, type = 'square', gain = 0.08 }: BlipOpts) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Public SFX
export const sfx = {
  click: () => blip({ freq: 720, freqEnd: 520, duration: 0.05, type: 'square', gain: 0.06 }),
  navPrev: () => blip({ freq: 520, freqEnd: 320, duration: 0.09, type: 'triangle', gain: 0.09 }),
  navNext: () => blip({ freq: 520, freqEnd: 880, duration: 0.09, type: 'triangle', gain: 0.09 }),
  slider: (() => {
    let last = 0;
    return () => {
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      blip({ freq: 1200, duration: 0.018, type: 'sine', gain: 0.025 });
    };
  })(),
  make: () => {
    blip({ freq: 440, freqEnd: 880, duration: 0.12, type: 'sawtooth', gain: 0.07 });
    setTimeout(() => blip({ freq: 880, freqEnd: 1320, duration: 0.14, type: 'triangle', gain: 0.05 }), 70);
  },
  toggle: () => blip({ freq: 600, duration: 0.04, type: 'square', gain: 0.05 }),
  exit: () => blip({ freq: 380, freqEnd: 220, duration: 0.12, type: 'triangle', gain: 0.07 }),
};
