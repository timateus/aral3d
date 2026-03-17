import { useState, useEffect, useRef, Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

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
  onCanalTour: () => void;
  onAgmarTour?: () => void;
  onObjectSelect?: (lat: number, lon: number, name: string) => void;
  onStartGame?: () => void;
}

type LandingView = 'main' | 'artifacts';

const IntroOverlay = ({ onStart, onGuidedTour, onCanalTour, onAgmarTour, onObjectSelect, onStartGame }: IntroOverlayProps) => {
  const [view, setView] = useState<LandingView>('main');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

        {/* Four cards — sharp edges */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onStartGame?.()}
            className="group relative bg-card/40 backdrop-blur-md border border-border/30 p-6 hover:bg-card/70 hover:border-primary/40 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <p className="text-base font-semibold text-foreground tracking-wide mb-1">Play</p>
              <p className="text-xs text-foreground/50 leading-relaxed">
                Explore missions, pour water, and discover the region
              </p>
            </div>
            <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-foreground/20 group-hover:text-primary/60 transition-all duration-300 group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => setView('artifacts')}
            className="group relative bg-card/40 backdrop-blur-md border border-border/30 p-6 hover:bg-card/70 hover:border-accent/40 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <p className="text-base font-semibold text-foreground tracking-wide mb-1">Touch</p>
              <p className="text-xs text-foreground/50 leading-relaxed">
                Browse 3D objects and cultural heritage items
              </p>
            </div>
            <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-foreground/20 group-hover:text-accent/60 transition-all duration-300 group-hover:translate-x-1" />
          </button>

          <button
            onClick={onGuidedTour}
            className="group relative bg-card/40 backdrop-blur-md border border-border/30 p-6 hover:bg-card/70 hover:border-secondary-foreground/30 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <p className="text-base font-semibold text-foreground tracking-wide mb-1">Walk</p>
              <p className="text-xs text-foreground/50 leading-relaxed">
                Narrated history of the Aral Sea & canal systems
              </p>
            </div>
            <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-foreground/20 group-hover:text-secondary-foreground/60 transition-all duration-300 group-hover:translate-x-1" />
          </button>

          <button
            onClick={onStart}
            className="group relative bg-card/40 backdrop-blur-md border border-border/30 p-6 hover:bg-card/70 hover:border-muted-foreground/30 transition-all duration-500 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <p className="text-base font-semibold text-foreground tracking-wide mb-1">Explore</p>
              <p className="text-xs text-foreground/50 leading-relaxed">
                Full map controls, data layers, and simulation tools
              </p>
            </div>
            <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-foreground/20 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
