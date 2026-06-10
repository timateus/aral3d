import { useEffect, useRef, useState } from 'react';
import track1 from '@/assets/Kobyz_Kachapuri.mp3.asset.json';
import track2 from '@/assets/Kobyz_Kachapuri_1.mp3.asset.json';
import track3 from '@/assets/Kobyz_Lullwater.mp3.asset.json';

const TRACKS = [track1.url, track2.url, track3.url];

interface Props {
  active: boolean;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  tint?: string;
}

/**
 * Cross-level ambient music player.
 * - Picks a random track on `active` true, advances to the next when one ends.
 * - Floating bottom-right mute toggle (only when not controlled externally).
 * - Volume gently fades on mount and on unmount.
 */
export default function BackgroundMusic({ active, muted: controlledMuted, onMutedChange, tint = '#ffffff' }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const idxRef = useRef<number>(Math.floor(Math.random() * TRACKS.length));
  const [internalMuted, setInternalMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('bg-music-muted') === '1'; } catch { return false; }
  });
  const [tabVisible, setTabVisible] = useState<boolean>(() =>
    typeof document === 'undefined' ? true : !document.hidden
  );

  const isControlled = controlledMuted !== undefined;
  const muted = isControlled ? controlledMuted : internalMuted;
  // Keep music playing even when the tab is hidden / unfocused — user requested
  // it shouldn't switch off in the background.
  const effectiveActive = active;
  const setMuted = (v: boolean) => {
    if (isControlled) {
      onMutedChange?.(v);
    } else {
      setInternalMuted(v);
    }
  };


  // Lazy-create audio element
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.volume = 0;
    a.loop = false;
    a.crossOrigin = 'anonymous';
    audioRef.current = a;

    const next = () => {
      idxRef.current = (idxRef.current + 1) % TRACKS.length;
      a.src = TRACKS[idxRef.current];
      a.play().catch(() => {});
    };
    a.addEventListener('ended', next);

    return () => {
      a.removeEventListener('ended', next);
      a.pause();
      a.src = '';
      audioRef.current = null;
    };
  }, []);

  // React to active + muted
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (effectiveActive && !muted) {
      if (!a.src) {
        a.src = TRACKS[idxRef.current];
      }
      a.play().catch(() => {/* user gesture probably required, fine */});
      // gentle fade-in
      const target = 0.55;
      let v = a.volume;
      const id = window.setInterval(() => {
        v = Math.min(target, v + 0.04);
        a.volume = v;
        if (v >= target) window.clearInterval(id);
      }, 60);
      return () => window.clearInterval(id);
    } else {
      // fade-out then pause
      let v = a.volume;
      const id = window.setInterval(() => {
        v = Math.max(0, v - 0.06);
        a.volume = v;
        if (v <= 0) {
          a.pause();
          window.clearInterval(id);
        }
      }, 40);
      return () => window.clearInterval(id);
    }
  }, [effectiveActive, muted]);

  useEffect(() => {
    try { localStorage.setItem('bg-music-muted', muted ? '1' : '0'); } catch {}
  }, [muted]);

  return null;
}
