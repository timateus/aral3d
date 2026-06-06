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
import { setDesignerPaletteOverride } from '@/lib/geotiff-loader';

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
  // Optional multi-stop terrain ramp (5+ colors low->high). When provided
  // it OVERRIDES the 4-color water/land/veg/alert ramp on the 3D surface.
  terrainStops?: string[];
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

  // Push to terrain color ramp so the 3D surface itself recolors.
  setDesignerPaletteOverride({
    water: s.water,
    land: s.land,
    vegetation: s.vegetation,
    alert: s.alert,
    background: s.background,
    stops: s.terrainStops,
  });

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
  setDesignerPaletteOverride(null);
}

// ---------- Palette presets ----------
export type PresetId = 'cutesy' | 'scientific' | 'bw' | 'hotpink' | 'forest' | 'sunset' | 'cyberpunk' | 'desert' | 'oceanic' | 'candy';

export const PALETTE_PRESETS: { id: PresetId; label: string; scheme: Partial<DesignerScheme> }[] = [
  { id: 'cutesy', label: 'Cutesy', scheme: {
    background: '#FFF5F8', foreground: '#3A2A38', muted: '#9B7B92', panel: '#FFFFFF',
    border: '#E8B8CC', accent: '#FF8FB1',
    water: '#A6E1FA', land: '#FFE7C7', vegetation: '#B8E8B0', alert: '#FF6BA0',
  }},
  { id: 'scientific', label: 'Scientific', scheme: {
    background: '#F4F5F7', foreground: '#0E1726', muted: '#5A6478', panel: '#FFFFFF',
    border: '#0E1726', accent: '#0D5FAA',
    water: '#1F4E79', land: '#C9B89A', vegetation: '#5E8A55', alert: '#B5322C',
  }},
  { id: 'bw', label: 'B&W', scheme: {
    background: '#FFFFFF', foreground: '#000000', muted: '#6B6B6B', panel: '#FFFFFF',
    border: '#000000', accent: '#000000',
    water: '#1A1A1A', land: '#C8C8C8', vegetation: '#7A7A7A', alert: '#000000',
  }},
  { id: 'hotpink', label: 'Hot Pink', scheme: {
    background: '#1A0512', foreground: '#FFE6F2', muted: '#FF8FB1', panel: '#2A0820',
    border: '#FF1E7A', accent: '#FF1E7A',
    water: '#4A0E2E', land: '#FF6BA0', vegetation: '#FF1E7A', alert: '#FFE600',
  }},
  { id: 'forest', label: 'Forest', scheme: {
    background: '#F2EEDF', foreground: '#1F2A1A', muted: '#5A6850', panel: '#FAF7EB',
    border: '#1F2A1A', accent: '#3E6B3A',
    water: '#3F6F76', land: '#C9B98A', vegetation: '#3E6B3A', alert: '#A6443A',
  }},
  { id: 'sunset', label: 'Sunset', scheme: {
    background: '#2A0E1F', foreground: '#FFE6CC', muted: '#D89A7A', panel: '#3A1428',
    border: '#FF7755', accent: '#FFB347',
    water: '#5A2E5A', land: '#FF8855', vegetation: '#D44A6A', alert: '#FFE066',
  }},
  { id: 'cyberpunk', label: 'Cyberpunk', scheme: {
    background: '#04020E', foreground: '#E6F6FF', muted: '#6A8AB0', panel: '#0A0820',
    border: '#00F0FF', accent: '#FF00C8',
    water: '#1B0E4A', land: '#3A1F66', vegetation: '#00F0FF', alert: '#FF00C8',
  }},
  { id: 'desert', label: 'Desert', scheme: {
    background: '#F7EBD3', foreground: '#3A2614', muted: '#8C6B4A', panel: '#FFF7E6',
    border: '#3A2614', accent: '#C97B3E',
    water: '#5A8A9C', land: '#E2C28A', vegetation: '#9CA66B', alert: '#B5322C',
  }},
  { id: 'oceanic', label: 'Oceanic', scheme: {
    background: '#0A1A24', foreground: '#E6F4F8', muted: '#7AA0B0', panel: '#102634',
    border: '#3FB8C4', accent: '#3FB8C4',
    water: '#0F3A52', land: '#5A8FA0', vegetation: '#7FD3C8', alert: '#FFB347',
  }},
  { id: 'candy', label: 'Candy', scheme: {
    background: '#FFF8FB', foreground: '#3A1F4A', muted: '#9A7AB0', panel: '#FFFFFF',
    border: '#C896E0', accent: '#A050E0',
    water: '#9AC8FF', land: '#FFD6E6', vegetation: '#B8F0C8', alert: '#FF5A88',
  }},
];

export function applyPreset(id: PresetId) {
  const p = PALETTE_PRESETS.find(x => x.id === id);
  if (!p) return;
  applyDesignerScheme({ ...getDesignerScheme(), ...p.scheme });
}

export function applyRandomPreset(): PresetId {
  const idx = Math.floor(Math.random() * PALETTE_PRESETS.length);
  const p = PALETTE_PRESETS[idx];
  applyPreset(p.id);
  return p.id;
}

// ---------- HSL <-> hex utils ----------
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToHsl(hex: string): [number, number, number] {
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
  return [h, s, l];
}

// Generates a fresh, coherent color scale from a single random seed hue.
// Keeps the current UI mode (light/dark background lightness preserved).
export function generateRandomRamp() {
  const cur = getDesignerScheme();
  const [, , bgL] = hexToHsl(cur.background);
  const darkMode = bgL < 0.5;

  const baseHue = Math.random() * 360;
  const sat = 0.45 + Math.random() * 0.35; // 0.45..0.80

  // 5 analogous/triadic hues across the ramp
  const hueWater     = baseHue;
  const hueLand      = baseHue + 40 + Math.random() * 30;
  const hueVeg       = baseHue + 90 + Math.random() * 40;
  const hueAlert     = baseHue + 180 + (Math.random() - 0.5) * 40;
  const hueAccent    = baseHue + 30 + (Math.random() - 0.5) * 40;

  const background = darkMode
    ? hslToHex(baseHue, 0.20, 0.06 + Math.random() * 0.05)
    : hslToHex(baseHue, 0.10, 0.94 + Math.random() * 0.04);
  const foreground = darkMode ? '#F2EEE6' : '#1A1A1A';
  const muted      = darkMode ? hslToHex(baseHue, 0.15, 0.65) : hslToHex(baseHue, 0.15, 0.42);
  const panel      = darkMode ? hslToHex(baseHue, 0.18, 0.10) : '#FFFFFF';
  const border     = darkMode ? hslToHex(baseHue, 0.30, 0.55) : hslToHex(baseHue, 0.30, 0.20);

  const next: DesignerScheme = {
    ...cur,
    background, foreground, muted, panel, border,
    accent:     hslToHex(hueAccent, sat,        darkMode ? 0.60 : 0.45),
    water:      hslToHex(hueWater,  sat * 0.9,  darkMode ? 0.30 : 0.45),
    land:       hslToHex(hueLand,   sat * 0.6,  darkMode ? 0.55 : 0.70),
    vegetation: hslToHex(hueVeg,    sat * 0.7,  darkMode ? 0.45 : 0.55),
    alert:      hslToHex(hueAlert,  sat,        darkMode ? 0.60 : 0.50),
  };
  applyDesignerScheme(next);
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
