// Global visual style mode. Two options:
//  - 'dark'   (default) the original dark scientific look
//  - 'mirage' off-white paper, hairline strokes, monospace, heat-haze map
//
// State lives on <html class="mirage"> so any CSS rule can react with a
// `.mirage &` selector. We also expose a tiny pub/sub so React components
// (Canvas background, fog, three.js things that can't read CSS) can react.

export type VisualMode = 'dark' | 'mirage';

const KEY = 'visualMode';
const listeners = new Set<(m: VisualMode) => void>();

export function getVisualMode(): VisualMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('mirage') ? 'mirage' : 'dark';
}

export function setVisualMode(mode: VisualMode) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (mode === 'mirage') html.classList.add('mirage');
  else html.classList.remove('mirage');
  try { localStorage.setItem(KEY, mode); } catch {}
  listeners.forEach(l => l(mode));
}

export function toggleVisualMode() {
  setVisualMode(getVisualMode() === 'mirage' ? 'dark' : 'mirage');
}

export function subscribeVisualMode(fn: (m: VisualMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Initialise from localStorage on module load
if (typeof document !== 'undefined') {
  try {
    const saved = localStorage.getItem(KEY) as VisualMode | null;
    if (saved === 'mirage') document.documentElement.classList.add('mirage');
  } catch {}
}

import { useEffect, useState } from 'react';

export function useVisualMode(): [VisualMode, (m: VisualMode) => void] {
  const [mode, setMode] = useState<VisualMode>(() => getVisualMode());
  useEffect(() => subscribeVisualMode(setMode), []);
  return [mode, setVisualMode];
}
