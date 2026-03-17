import { useEffect, useState, useRef } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  hue: number;
  delay: number;
}

const SoapBubblesOverlay = ({ active }: { active: boolean }) => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const frameRef = useRef<number>(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!active) { setBubbles([]); return; }
    startTime.current = Date.now();

    const initial: Bubble[] = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 100 + Math.random() * 40,
      size: 30 + Math.random() * 80,
      speed: 0.3 + Math.random() * 0.6,
      wobble: 0,
      wobbleSpeed: 0.5 + Math.random() * 1.5,
      opacity: 0.15 + Math.random() * 0.25,
      hue: Math.random() * 360,
      delay: Math.random() * 3000,
    }));
    setBubbles(initial);

    let running = true;
    const tick = () => {
      if (!running) return;
      const now = Date.now();
      setBubbles(prev => prev.map(b => {
        const elapsed = now - startTime.current - b.delay;
        if (elapsed < 0) return b;
        const newY = b.y - b.speed * 0.3;
        const wobbleX = Math.sin(elapsed * 0.001 * b.wobbleSpeed) * 15;
        return {
          ...b,
          y: newY < -20 ? 120 : newY,
          wobble: wobbleX,
          hue: (b.hue + 0.1) % 360,
        };
      }));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [active]);

  if (!active || bubbles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
      {bubbles.map(b => {
        const elapsed = Date.now() - startTime.current - b.delay;
        if (elapsed < 0) return null;
        return (
          <div
            key={b.id}
            className="absolute rounded-full"
            style={{
              left: `calc(${b.x}% + ${b.wobble}px)`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              background: `radial-gradient(circle at 35% 30%, 
                hsla(${b.hue}, 80%, 92%, 0.9),
                hsla(${(b.hue + 40) % 360}, 70%, 80%, 0.4) 40%,
                hsla(${(b.hue + 120) % 360}, 60%, 70%, 0.15) 70%,
                transparent 100%)`,
              boxShadow: `inset 0 0 ${b.size * 0.3}px hsla(${b.hue}, 60%, 85%, 0.3), 
                          inset ${b.size * 0.15}px ${-b.size * 0.1}px ${b.size * 0.2}px hsla(0, 0%, 100%, 0.4),
                          0 0 ${b.size * 0.4}px hsla(${b.hue}, 50%, 80%, 0.15)`,
              border: `1px solid hsla(${b.hue}, 50%, 85%, 0.3)`,
              transition: 'top 0.05s linear',
            }}
          />
        );
      })}
    </div>
  );
};

export default SoapBubblesOverlay;
