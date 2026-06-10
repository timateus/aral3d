import { useEffect, useState } from 'react';

/**
 * Polls the DOM for any visible modal/overlay window that covers the map.
 * Used to hide map-anchored labels (city names, place markers) while a menu
 * or dialog is on top — they would otherwise bleed through the modal.
 *
 * Treats as "overlay active" anything with role="dialog", aria-modal="true",
 * Radix's data-state="open" wrappers, or our own [data-overlay-active] markers.
 */
export function useOverlayActive(pollMs = 200): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const sel =
        '[role="dialog"]:not([aria-hidden="true"]),' +
        '[aria-modal="true"],' +
        '[data-overlay-active],' +
        '[data-state="open"][data-radix-popper-content-wrapper]';
      let found = false;
      const nodes = document.querySelectorAll<HTMLElement>(sel);
      for (const n of nodes) {
        // Filter out zero-size / hidden nodes
        const r = n.getBoundingClientRect();
        if (r.width > 60 && r.height > 60) { found = true; break; }
      }
      setActive(found);
    };
    check();
    const id = window.setInterval(check, pollMs);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [pollMs]);
  return active;
}
