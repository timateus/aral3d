// Global visual style mode.
//   - 'dark'     default dark scientific
//   - 'mirage'   off-white paper, hairline strokes, monospace
//   - 'designer' live-editable scheme (see DesignerPanel)
//
// State lives on <html class="..."> + a set of CSS custom properties
// written to <html>'s inline style. CSS in index.css falls back to the
// hard-coded mirage palette via `var(--m-*, fallback)` so designer
// edits override mirage in real time.

import { useEffect, useState } from 'react';

export type VisualMode = 'dark' | 'mirage' | 'designer';

const KEY = 'visualMode';
const SCHEME_KEY = 'designerScheme';
const listeners = new Set<(m: VisualMode) => void>();
const schemeListeners = new Set<(s: DesignerScheme) => void>();

export interface DesignerScheme {
  // Colours (hex)
  background: string;
  foreground: string;
  muted: string;
  panel: string;
  border: string;
  accent: string;
  // Map / terrain
  water: string;
  land: string;
  vegetation: string;
  alert: string;
  // Thicknesses
  borderWidth: number;     // px, 0.25 - 2
  gridOpacity: number;     // 0 - 0.2
  gridSpacing: number;     // px, 16 - 96
  fontWeight: number;      // 100 - 500
  baseFontSize: number;    // px, 9 - 14
  labelFontSize: number;   // px, 7 - 14
  radius: number;          // px, 0 - 12
  svgStroke: number;       // px, 0.25 - 2
}

export const DEFAULT_SCHEME: DesignerScheme = {
  background: '#FAF8F4',
  foreground: '#1A1A1A',
  muted: '#6B6B6B',
  panel: '#FFFFFF',
  border: '#1A1A1A',
  accent: '#1A1A1A',
  water: '#6FA3B8',
  land: '#D9D2C3',
  vegetation: '#8FA68E',
  alert: '#C05A5A',
  borderWidth: 1,
  gridOpacity: 0.012,
  gridSpacing: 48,
  fontWeight: 200,
  baseFontSize: 11,
  labelFontSize: 9,
  radius: 0,
  svgStroke: 0.5,
};

// Hex -> "h s% l%" string for hsl(var(--x)) consumers
function hexToHslTriplet(hex: string): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyDesignerScheme(s: DesignerScheme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  // Override semantic tokens (consumed via hsl(var(--background)) etc.)
  const set = (k: string, v: string) => html.style.setProperty(k, v);
  set('--background', hexToHslTriplet(s.background));
  set('--foreground', hexToHslTriplet(s.foreground));
  set('--muted-foreground', hexToHslTriplet(s.muted));
  set('--card', hexToHslTriplet(s.panel));
  set('--popover', hexToHslTriplet(s.panel));
  set('--border', hexToHslTriplet(s.border));
  set('--primary', hexToHslTriplet(s.accent));
  set('--accent', hexToHslTriplet(s.water));
  set('--destructive', hexToHslTriplet(s.alert));
  set('--terrain-low', hexToHslTriplet(s.water));
  set('--terrain-mid', hexToHslTriplet(s.land));
  set('--terrain-high', hexToHslTriplet(s.vegetation));

  // Designer-specific tokens
  set('--m-border-width', `${s.borderWidth}px`);
  set('--m-grid-opacity', `${s.gridOpacity}`);
  set('--m-grid-spacing', `${s.gridSpacing}px`);
  set('--m-font-weight', `${s.fontWeight}`);
  set('--m-fs-base', `${s.baseFontSize}px`);
  set('--m-fs-label', `${s.labelFontSize}px`);
  set('--m-radius', `${s.radius}px`);
  set('--m-svg-stroke', `${s.svgStroke}`);

  // Map colors as hex (for three.js components reading via JS)
  set('--map-water', s.water);
  set('--map-land', s.land);
  set('--map-vegetation', s.vegetation);
  set('--map-alert', s.alert);
  set('--map-background', s.background);

  try { localStorage.setItem(SCHEME_KEY, JSON.stringify(s)); } catch {}
  schemeListeners.forEach(l => l(s));
}

export function clearDesignerScheme() {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const props = [
    '--background','--foreground','--muted-foreground','--card','--popover',
    '--border','--primary','--accent','--destructive',
    '--terrain-low','--terrain-mid','--terrain-high',
    '--m-border-width','--m-grid-opacity','--m-grid-spacing',
    '--m-font-weight','--m-fs-base','--m-fs-label','--m-radius','--m-svg-stroke',
    '--map-water','--map-land','--map-vegetation','--map-alert','--map-background',
  ];
  for (const p of props) html.style.removeProperty(p);
}

export function getDesignerScheme(): DesignerScheme {
  if (typeof localStorage === 'undefined') return DEFAULT_SCHEME;
  try {
    const raw = localStorage.getItem(SCHEME_KEY);
    if (!raw) return DEFAULT_SCHEME;
    return { ...DEFAULT_SCHEME, ...JSON.parse(raw) };
  } catch { return DEFAULT_SCHEME; }
}

export function getVisualMode(): VisualMode {
  if (typeof document === 'undefined') return 'dark';
  const cl = document.documentElement.classList;
  if (cl.contains('designer')) return 'designer';
  if (cl.contains('mirage')) return 'mirage';
  return 'dark';
}

export function setVisualMode(mode: VisualMode) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('mirage', 'designer');
  if (mode === 'mirage') html.classList.add('mirage');
  if (mode === 'designer') {
    html.classList.add('mirage', 'designer');
    applyDesignerScheme(getDesignerScheme());
  } else {
    clearDesignerScheme();
  }
  try { localStorage.setItem(KEY, mode); } catch {}
  listeners.forEach(l => l(mode));
}

export function toggleVisualMode() {
  const order: VisualMode[] = ['dark', 'mirage', 'designer'];
  const cur = getVisualMode();
  const next = order[(order.indexOf(cur) + 1) % order.length];
  setVisualMode(next);
}

export function subscribeVisualMode(fn: (m: VisualMode) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function subscribeDesignerScheme(fn: (s: DesignerScheme) => void): () => void {
  schemeListeners.add(fn);
  return () => { schemeListeners.delete(fn); };
}

// Initialise from localStorage on module load
if (typeof document !== 'undefined') {
  try {
    const saved = localStorage.getItem(KEY) as VisualMode | null;
    if (saved === 'mirage') document.documentElement.classList.add('mirage');
    if (saved === 'designer') {
      document.documentElement.classList.add('mirage', 'designer');
      applyDesignerScheme(getDesignerScheme());
    }
  } catch {}
}

export function useVisualMode(): [VisualMode, (m: VisualMode) => void] {
  const [mode, setMode] = useState<VisualMode>(() => getVisualMode());
  useEffect(() => subscribeVisualMode(setMode), []);
  return [mode, setVisualMode];
}

export function useDesignerScheme(): [DesignerScheme, (s: DesignerScheme) => void] {
  const [scheme, setScheme] = useState<DesignerScheme>(() => getDesignerScheme());
  useEffect(() => subscribeDesignerScheme(setScheme), []);
  return [scheme, applyDesignerScheme];
}
