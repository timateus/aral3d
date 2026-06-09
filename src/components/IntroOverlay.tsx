import { useState, useEffect, useRef, Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useGamepad } from '@/hooks/useGamepad';
import { consumeGamepadButton } from '@/lib/gamepad-dedupe';
import { remapPadLabel } from '@/lib/pad-labels';

interface LibraryItem {
  id: string;
  name: string;
  image: string;
  modelPath?: string;
  description: string;
  detailText: string;
  lat: number;
  lon: number;
  is3D?: boolean;
}

const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'yarn-ball',
    name: 'Yarn Ball',
    image: '/images/objects/yarn-ball.png',
    description: 'Camel wool craft',
    detailText: 'In Shımbay, camel wool is hand-spun and dyed using pomegranate rinds, walnut husks, and indigo — techniques passed down through generations of Karakalpak women.',
    lat: 42.05,
    lon: 58.34,
    is3D: false,
  },
  {
    id: 'soap-khorezm',
    name: 'Khorezm Soap',
    modelPath: '/models/soap-khorezm.glb',
    image: '',
    description: 'Traditional soap',
    detailText: 'Khorezm soap is crafted from cottonseed oil, animal fat, and alkaline ash — a centuries-old recipe.',
    lat: 41.55,
    lon: 60.63,
    is3D: true,
  },
  {
    id: 'suw-qabaq',
    name: 'Suw Qabaq',
    modelPath: '/models/pumpkin.glb',
    image: '',
    description: 'Dried pumpkin vessel',
    detailText: 'Dried pumpkins were used as water vessels in traditional times.',
    lat: 42.46,
    lon: 59.6,
    is3D: true,
  },
  {
    id: 'bowls',
    name: 'Ceramic Bowls',
    modelPath: '/models/bowls.glb',
    image: '',
    description: 'Traditional ceramics',
    detailText: 'Karakalpak ceramic bowls feature geometric patterns inspired by water and earth — crafted using techniques dating back to the Khorezm civilization.',
    lat: 42.3,
    lon: 59.4,
    is3D: true,
  },
  {
    id: 'aryq',
    name: 'Aryq',
    modelPath: '/models/aryq.glb',
    image: '',
    description: 'Irrigation canal',
    detailText: 'An aryq is a traditional irrigation canal — the lifeline of agriculture in Karakalpakstan. These channels carry water from rivers to fields, sustaining communities across the arid landscape.',
    lat: 42.462,
    lon: 59.603,
    is3D: true,
  },
  {
    id: 'aral-north',
    name: 'Aral Sea North',
    image: '',
    description: 'Northern remnant',
    detailText: 'The Small Aral Sea — a fragment sustained by the Kok-Aral Dam since 2005.',
    lat: 46.8,
    lon: 61.5,
  },
  {
    id: 'muynak',
    name: 'Muynak Harbor',
    image: '',
    description: 'Former fishing port',
    detailText: 'Once a bustling Aral Sea port, Muynak now sits over 100 km from the nearest shoreline.',
    lat: 43.77,
    lon: 58.69,
  },
  {
    id: 'nukus',
    name: 'Nukus',
    image: '',
    description: 'Capital of Karakalpakstan',
    detailText: 'Home to the Savitsky Museum — one of the world\'s most important collections of Soviet avant-garde art.',
    lat: 42.46,
    lon: 59.6,
  },
];

function RotatingModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <group ref={ref} scale={[6, 6, 6]} position={[0, -1.2, 0]}>
      <primitive object={scene.clone()} />
    </group>
  );
}

// Generative particle field
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth * 2;
      canvas.height = window.innerHeight * 2;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };
    resize();
    window.addEventListener('resize', resize);

    const count = 120;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      const connectionDist = 200;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${p.opacity})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

interface IntroOverlayProps {
  onStart: () => void;
  onGuidedTour: () => void;
  onReading?: () => void;
  onCanalTour: () => void;
  onAgmarTour?: () => void;
  onObjectSelect?: (lat: number, lon: number, name: string) => void;
  onStartGame?: () => void;
  onQuadrants?: () => void;
  onSandbox?: () => void;
  onTraceCanals?: () => void;
  onDustStorm?: () => void;
  onLife?: () => void;
  onFountains?: () => void;
  onSpectral?: () => void;
  onMinistry?: () => void;
}

type LandingView = 'main' | 'artifacts';

const IntroOverlay = ({ onStart, onGuidedTour, onReading, onCanalTour, onAgmarTour, onObjectSelect, onStartGame, onQuadrants, onSandbox, onTraceCanals, onDustStorm, onLife, onFountains, onSpectral, onMinistry }: IntroOverlayProps) => {
  const [view, setView] = useState<LandingView>('main');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { stateRef: gpRef } = useGamepad();

  // Gamepad: X / A on the landing page triggers Play (Choose your character).
  // B returns from the artifacts subview to main.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = gpRef.current;
      if (s.connected) {
        if (view === 'main') {
          if (consumeGamepadButton('x_intro', s.buttons.x) || consumeGamepadButton('a_intro', s.buttons.a)) {
            (onSpectral ?? onStartGame)?.();
          }
        } else if (view === 'artifacts') {
          if (consumeGamepadButton('b_intro_back', s.buttons.b)) setView('main');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, onSpectral, onStartGame]);

  // Dispatch auto-rotate event for the background 3D map
  useEffect(() => {
    if (view === 'main') {
      window.dispatchEvent(new CustomEvent('intro-auto-rotate', { detail: { active: true } }));
    }
    return () => {
      window.dispatchEvent(new CustomEvent('intro-auto-rotate', { detail: { active: false } }));
    };
  }, [view]);

  const handleItemClick = (item: LibraryItem) => {
    if (onObjectSelect) {
      onObjectSelect(item.lat, item.lon, item.name);
    }
    onStart();
  };

  const hoveredItem = LIBRARY_ITEMS.find(i => i.id === hoveredId);

  if (view === 'artifacts') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-4xl px-6">
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={() => setView('main')}
              className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors"
            >
              ← Back
            </button>
            <h2 className="text-xl font-light tracking-[0.15em] uppercase text-foreground">
              Artifact Collection
            </h2>
          </div>

          <div className="flex gap-px">
            <div className="grid grid-cols-3 gap-px bg-border/30 flex-1">
              {LIBRARY_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group relative aspect-square bg-card/60 backdrop-blur-md border-0 transition-all duration-300 hover:bg-card focus:outline-none focus:ring-1 focus:ring-primary/30 ${
                    hoveredId === item.id ? 'bg-card' : ''
                  }`}
                >
                  {item.modelPath ? (
                    <div className="w-full h-full">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Canvas camera={{ position: [1.5, 1, 1.5], fov: 35 }}>
                          <ambientLight intensity={0.6} />
                          <directionalLight position={[5, 5, 5]} intensity={0.8} />
                          <Suspense fallback={null}>
                            <RotatingModel modelPath={item.modelPath} />
                            <Environment preset="city" />
                          </Suspense>
                          <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
                        </Canvas>
                      </div>
                    </div>
                  ) : item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground/40 font-mono">
                        ?
                      </div>
                    </div>
                  )}
                  <div className={`absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200 ${
                    hoveredId === item.id ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <p className="text-[10px] font-medium tracking-wider uppercase text-primary truncate">
                      {item.name}
                    </p>
                  </div>
                  {item.is3D && (
                    <div className="absolute top-1.5 right-1.5 text-[8px] font-mono tracking-wider text-primary/60 uppercase">
                      3D
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="w-48 bg-card/40 backdrop-blur-md p-4 flex flex-col justify-center transition-all duration-300">
              {hoveredItem ? (
                <div className="animate-fade-in">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-primary mb-2 font-medium">
                    {hoveredItem.name}
                  </p>
                  <div className="h-px w-8 bg-primary/30 mb-3" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {hoveredItem.detailText}
                  </p>
                  <p className="mt-3 text-[9px] font-mono text-muted-foreground/50">
                    {hoveredItem.lat.toFixed(2)}°N, {hoveredItem.lon.toFixed(2)}°E
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/40 tracking-wider uppercase text-center">
                  Hover an object
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main landing view — sharp cards, auto-rotating background
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Very subtle overlay to keep map visible */}
      <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
      
      {/* Generative particle effect */}
      <ParticleField />

      <div className="relative z-10 w-full max-w-2xl px-6">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-extralight tracking-[0.3em] uppercase text-foreground drop-shadow-lg">
            The Aral Sea
          </h1>
          <div className="mt-4 h-px w-24 mx-auto bg-primary/50" />
          <p className="mt-4 text-sm tracking-[0.2em] uppercase text-foreground/60">
            An interactive exploration
          </p>
        </div>

        <div className="space-y-4">
          {/* Big Play card */}
          <button
            onClick={() => (onSpectral ?? onStartGame)?.()}
            className="group relative w-full bg-card/40 backdrop-blur-md border border-border/30 p-8 hover:bg-card/70 hover:border-primary/40 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-foreground tracking-wide mb-2">Play</p>
                <p className="text-sm text-foreground/50 leading-relaxed">
                  Choose your character, Ministry of Sea, Water Sim, GeoGuessr & more
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[11px] font-mono font-bold leading-none rounded border-2"
                  style={{ background: '#3b82f6', color: '#fff', borderColor: '#fff' }}
                  title="Press X on controller"
                >{remapPadLabel('X').text}</span>
                <ArrowRight className="w-8 h-8 text-foreground/20 group-hover:text-primary/60 transition-all duration-300 group-hover:translate-x-2" />
              </div>
            </div>
          </button>

          {/* Explore — second, smaller */}
          <button
            onClick={onStart}
            className="group relative w-full bg-card/40 backdrop-blur-md border border-border/30 p-5 hover:bg-card/70 hover:border-muted-foreground/30 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <p className="text-lg font-semibold text-foreground tracking-wide mb-1">Explore</p>
              <p className="text-[11px] text-foreground/50 leading-relaxed">
                Full map controls & simulation
              </p>
            </div>
            <ArrowRight className="absolute bottom-3 right-3 w-4 h-4 text-foreground/20 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-1" />
          </button>


          {/* Compact grid — hidden behind "More" */}
          <details className="group">
            <summary className="list-none cursor-pointer text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/40 hover:text-foreground/70 transition-colors py-2 text-center select-none">
              More modes ▾
            </summary>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
              {[
                { label: 'Touch', desc: '3D objects', onClick: () => setView('artifacts') },
                { label: 'Learn', desc: 'Ag-MAR water tech', onClick: () => onAgmarTour?.() },
                { label: 'Walk', desc: 'History & canals', onClick: onGuidedTour },
                { label: 'Compare', desc: 'Four views', onClick: () => onQuadrants?.() },
                { label: 'Spectral', desc: 'Color-wild Earth', onClick: () => onSpectral?.() },
                { label: 'Sandbox', desc: 'Drop elements', onClick: () => onSandbox?.() },
                { label: 'Trace', desc: 'Follow canals', onClick: () => onTraceCanals?.() },
                { label: 'Dust', desc: 'Particle wind', onClick: () => onDustStorm?.() },
                { label: 'Life', desc: "Conway's cells", onClick: () => onLife?.() },
                { label: 'Fountains', desc: 'Nukus sites', onClick: () => onFountains?.() },
                { label: 'Read', desc: 'Field notebook', onClick: () => onReading?.() },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="group relative bg-card/30 backdrop-blur-md border border-border/20 p-2.5 hover:bg-card/60 transition-all duration-300 text-left overflow-hidden"
                >
                  <div className="relative z-10">
                    <p className="text-xs font-medium text-foreground tracking-wide">{item.label}</p>
                    <p className="text-[9px] text-foreground/40 leading-tight mt-0.5">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </details>

        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
