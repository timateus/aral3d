// Lightweight Web Audio engine for voxel mode.
// All sounds are procedurally synthesized — no asset downloads, no API keys.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let ambientNodes: { stop: () => void } | null = null;
let muted = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.9;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function initAudio() { ensureCtx(); }

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
}
export function isMuted() { return muted; }

export type SfxName = 'mine' | 'place' | 'jump' | 'milk' | 'craft' | 'pickup' | 'step';

function envTone(freq: number, dur: number, type: OscillatorType, vol = 0.4, detune = 0) {
  const c = ensureCtx(); if (!c || !sfxGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.detune.value = detune;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(sfxGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function noiseBurst(dur: number, vol = 0.3, filterFreq = 1200) {
  const c = ensureCtx(); if (!c || !sfxGain) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = filterFreq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(filt).connect(g).connect(sfxGain);
  src.start();
}

export function playSfx(name: SfxName) {
  switch (name) {
    case 'mine':
      noiseBurst(0.18, 0.4, 900);
      envTone(180, 0.12, 'square', 0.18);
      break;
    case 'place':
      envTone(420, 0.08, 'triangle', 0.25);
      envTone(620, 0.06, 'triangle', 0.18, 5);
      break;
    case 'jump':
      envTone(380, 0.12, 'sine', 0.18);
      envTone(560, 0.1, 'sine', 0.12, 8);
      break;
    case 'milk':
      noiseBurst(0.32, 0.18, 600);
      envTone(220, 0.18, 'sine', 0.15);
      break;
    case 'craft':
      envTone(520, 0.08, 'triangle', 0.22);
      setTimeout(() => envTone(780, 0.1, 'triangle', 0.22), 80);
      setTimeout(() => envTone(1040, 0.14, 'triangle', 0.22), 170);
      break;
    case 'pickup':
      envTone(880, 0.06, 'square', 0.18);
      setTimeout(() => envTone(1320, 0.08, 'square', 0.16), 50);
      break;
    case 'step':
      noiseBurst(0.06, 0.12, 500);
      break;
  }
}

// Ambient drone "music": slow detuned pads + occasional bell pings.
export function startAmbient() {
  const c = ensureCtx(); if (!c || !musicGain) return;
  if (ambientNodes) return;

  const now = c.currentTime;
  const pad = c.createGain(); pad.gain.value = 0.0; pad.connect(musicGain);
  pad.gain.linearRampToValueAtTime(0.55, now + 4);

  // Two detuned sawtooth oscillators through a soft lowpass.
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
  lp.connect(pad);

  const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110; // A2
  const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 110.7;
  const o3 = c.createOscillator(); o3.type = 'sine';    o3.frequency.value = 220;
  o1.connect(lp); o2.connect(lp); o3.connect(lp);
  o1.start(); o2.start(); o3.start();

  // Slow filter LFO
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05;
  const lfoGain = c.createGain(); lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();

  // Occasional bell pings
  let pingTimer: number | null = window.setInterval(() => {
    if (!ctx || !musicGain) return;
    const t = ctx.currentTime;
    const notes = [440, 523.25, 659.25, 783.99, 880];
    const f = notes[Math.floor(Math.random() * notes.length)];
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc.connect(g).connect(musicGain);
    osc.start(t); osc.stop(t + 2.3);
  }, 7000);

  ambientNodes = {
    stop: () => {
      try {
        const t = ctx!.currentTime;
        pad.gain.cancelScheduledValues(t);
        pad.gain.linearRampToValueAtTime(0, t + 1);
        setTimeout(() => { o1.stop(); o2.stop(); o3.stop(); lfo.stop(); }, 1100);
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      } catch {}
    },
  };
}

export function stopAmbient() {
  if (ambientNodes) { ambientNodes.stop(); ambientNodes = null; }
}
