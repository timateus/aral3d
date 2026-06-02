import { useEffect, useRef, useState } from 'react';
import { touchInput, isTouchDevice } from '@/lib/voxel/touch-input';
import { Pickaxe, Box, ArrowUp, Hand, Package, Hammer, ScrollText, Zap } from 'lucide-react';

/**
 * On-screen touch controls for the voxel game.
 * - Left thumbstick: movement
 * - Right side drag: look (camera yaw/pitch)
 * - Action buttons: mine, place, jump, interact (eat/drink), sprint, inventory, build, quests
 *
 * Renders only on touch devices.
 */
const STICK_RADIUS = 60;

const VoxelTouchControls = () => {
  const [enabled] = useState(() => isTouchDevice());
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const [stickPos, setStickPos] = useState<{ x: number; y: number } | null>(null);
  const [stickOrigin, setStickOrigin] = useState<{ x: number; y: number } | null>(null);
  const leftTouchId = useRef<number | null>(null);
  const rightTouchId = useRef<number | null>(null);
  const lastLook = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    touchInput.active = true;
    return () => {
      touchInput.active = false;
      touchInput.move.x = 0; touchInput.move.y = 0;
    };
  }, [enabled]);

  // Left stick handlers
  useEffect(() => {
    if (!enabled) return;
    const zone = leftZoneRef.current;
    if (!zone) return;

    const onStart = (e: TouchEvent) => {
      if (leftTouchId.current !== null) return;
      const t = e.changedTouches[0];
      leftTouchId.current = t.identifier;
      const origin = { x: t.clientX, y: t.clientY };
      setStickOrigin(origin);
      setStickPos(origin);
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (leftTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== leftTouchId.current) continue;
        if (!stickOrigin) return;
        let dx = t.clientX - stickOrigin.x;
        let dy = t.clientY - stickOrigin.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > STICK_RADIUS) {
          dx = (dx / mag) * STICK_RADIUS;
          dy = (dy / mag) * STICK_RADIUS;
        }
        setStickPos({ x: stickOrigin.x + dx, y: stickOrigin.y + dy });
        touchInput.move.x = dx / STICK_RADIUS;
        touchInput.move.y = dy / STICK_RADIUS;
        e.preventDefault();
        return;
      }
    };
    const onEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === leftTouchId.current) {
          leftTouchId.current = null;
          setStickOrigin(null); setStickPos(null);
          touchInput.move.x = 0; touchInput.move.y = 0;
          return;
        }
      }
    };
    zone.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      zone.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, stickOrigin]);

  // Right zone — drag to look
  useEffect(() => {
    if (!enabled) return;
    const zone = rightZoneRef.current;
    if (!zone) return;

    const onStart = (e: TouchEvent) => {
      if (rightTouchId.current !== null) return;
      const t = e.changedTouches[0];
      rightTouchId.current = t.identifier;
      lastLook.current = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (rightTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== rightTouchId.current) continue;
        if (!lastLook.current) return;
        const dx = t.clientX - lastLook.current.x;
        const dy = t.clientY - lastLook.current.y;
        touchInput.look.x += dx;
        touchInput.look.y += dy;
        lastLook.current = { x: t.clientX, y: t.clientY };
        e.preventDefault();
        return;
      }
    };
    const onEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === rightTouchId.current) {
          rightTouchId.current = null;
          lastLook.current = null;
          return;
        }
      }
    };
    zone.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      zone.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  if (!enabled) return null;

  const btnBase =
    'pointer-events-auto select-none flex flex-col items-center justify-center font-mono text-[9px] uppercase tracking-wider text-white/90 active:bg-white/30 transition-colors';

  return (
    <>
      {/* Left half — movement joystick zone (transparent capture) */}
      <div
        ref={leftZoneRef}
        className="fixed bottom-0 left-0 z-30 touch-none"
        style={{ width: '40vw', height: '60vh', touchAction: 'none' }}
      />
      {/* Right half — look zone (transparent capture) */}
      <div
        ref={rightZoneRef}
        className="fixed bottom-0 right-0 z-30 touch-none"
        style={{ width: '50vw', height: '60vh', touchAction: 'none' }}
      />

      {/* Floating joystick visual */}
      {stickOrigin && stickPos && (
        <div className="fixed z-40 pointer-events-none">
          <div
            className="absolute rounded-full border-2 border-white/40 bg-white/5"
            style={{
              left: stickOrigin.x - STICK_RADIUS,
              top: stickOrigin.y - STICK_RADIUS,
              width: STICK_RADIUS * 2,
              height: STICK_RADIUS * 2,
            }}
          />
          <div
            className="absolute rounded-full bg-white/70"
            style={{
              left: stickPos.x - 22,
              top: stickPos.y - 22,
              width: 44,
              height: 44,
            }}
          />
        </div>
      )}

      {/* Action buttons — bottom right */}
      <div className="fixed bottom-3 right-3 z-50 grid grid-cols-2 gap-2">
        <button
          className={`${btnBase} w-16 h-16 bg-amber-700/70 border border-amber-300/40`}
          onTouchStart={(e) => { e.preventDefault(); touchInput.breakQueued = true; }}
        >
          <Pickaxe className="w-5 h-5" /><span className="mt-0.5">Mine</span>
        </button>
        <button
          className={`${btnBase} w-16 h-16 bg-emerald-700/70 border border-emerald-300/40`}
          onTouchStart={(e) => { e.preventDefault(); touchInput.placeQueued = true; }}
        >
          <Box className="w-5 h-5" /><span className="mt-0.5">Place</span>
        </button>
        <button
          className={`${btnBase} w-16 h-16 bg-sky-700/70 border border-sky-300/40`}
          onTouchStart={(e) => { e.preventDefault(); touchInput.jumpQueued = true; }}
        >
          <ArrowUp className="w-5 h-5" /><span className="mt-0.5">Jump</span>
        </button>
        <button
          className={`${btnBase} w-16 h-16 bg-rose-700/70 border border-rose-300/40`}
          onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('voxel:interact')); }}
        >
          <Hand className="w-5 h-5" /><span className="mt-0.5">Eat/Drink</span>
        </button>
      </div>

      {/* Sprint toggle — left side, above joystick area */}
      <button
        className={`${btnBase} fixed bottom-3 left-3 z-50 w-14 h-14 border ${
          touchInput.sprint ? 'bg-yellow-500/70 border-yellow-200' : 'bg-black/60 border-white/30'
        }`}
        onTouchStart={(e) => {
          e.preventDefault();
          touchInput.sprint = !touchInput.sprint;
          // Force re-render
          (e.currentTarget as HTMLButtonElement).classList.toggle('bg-yellow-500/70');
        }}
      >
        <Zap className="w-4 h-4" /><span className="mt-0.5">Run</span>
      </button>

      {/* Top-right panel toggles */}
      <div className="fixed top-12 right-3 z-50 flex flex-col gap-2">
        <button
          className={`${btnBase} w-12 h-12 bg-black/60 border border-white/30`}
          onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('voxel:toggle-inventory')); }}
        >
          <Package className="w-4 h-4" /><span>Bag</span>
        </button>
        <button
          className={`${btnBase} w-12 h-12 bg-black/60 border border-white/30`}
          onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('voxel:toggle-build')); }}
        >
          <Hammer className="w-4 h-4" /><span>Build</span>
        </button>
        <button
          className={`${btnBase} w-12 h-12 bg-black/60 border border-white/30`}
          onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('voxel:toggle-quests')); }}
        >
          <ScrollText className="w-4 h-4" /><span>Quests</span>
        </button>
      </div>
    </>
  );
};

export default VoxelTouchControls;
