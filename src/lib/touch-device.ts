// Touch-only device detection. We treat a device as "touch-only" when it has
// touch input AND no fine pointer (mouse). That keeps hybrid laptops on the
// desktop UI while phones/tablets get the touch UI.
//
// Usage:
//   import { isTouchOnly, useIsTouchOnly } from '@/lib/touch-device';
//   const touch = useIsTouchOnly();
//   if (touch) return null;

import { useEffect, useState } from 'react';

export function isTouchOnly(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  if (!hasTouch) return false;
  // If a fine pointer exists, treat as desktop (mouse/trackpad).
  try {
    if (window.matchMedia?.('(pointer: fine)').matches) return false;
  } catch { /* ignore */ }
  return true;
}

export function useIsTouchOnly(): boolean {
  const [touch, setTouch] = useState<boolean>(() => isTouchOnly());
  useEffect(() => {
    const update = () => setTouch(isTouchOnly());
    update();
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(pointer: fine)');
      mq.addEventListener?.('change', update);
    } catch { /* ignore */ }
    window.addEventListener('resize', update);
    return () => {
      mq?.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return touch;
}
