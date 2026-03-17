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

    const initial: Bubble[] = Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 100 + Math.random() * 40,
      size: 40 + Math.random() * 120,
      speed: 0.2 + Math.random() * 0.5,
      wobble: 0,
      wobbleSpeed: 0.3 + Math.random() * 2,
      opacity: 0.4 + Math.random() * 0.4,
      hue: 330 + Math.random() * 20,
      delay: Math.random() * 2000,
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
              background: `radial-gradient(circle at 30% 25%, 
                rgba(255, 255, 255, 0.6),
                hsla(340, 100%, 70%, 0.7) 30%,
                hsla(320, 90%, 55%, 0.5) 55%,
                hsla(300, 80%, 45%, 0.3) 80%,
                transparent 100%)`,
              boxShadow: `inset 0 0 ${b.size * 0.4}px hsla(330, 100%, 70%, 0.5), 
                          inset ${b.size * 0.2}px ${-b.size * 0.15}px ${b.size * 0.25}px rgba(255, 255, 255, 0.6),
                          0 0 ${b.size * 0.5}px hsla(340, 100%, 65%, 0.3),
                          0 0 ${b.size}px hsla(330, 80%, 60%, 0.15)`,
              border: `2px solid hsla(340, 100%, 80%, 0.5)`,
              transition: 'top 0.05s linear',
            }}
          />
        );
      })}
    </div>
  );
};

export default SoapBubblesOverlay;
