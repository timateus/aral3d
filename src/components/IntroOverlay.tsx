import { useState, Suspense, useRef } from 'react';
import { ArrowRight, Gamepad2, BookOpen, Map, Package } from 'lucide-react';
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
    detailText: 'Khorezm soap is crafted from cottonseed oil, animal fat, and alkaline ash — a centuries-old recipe. The region\'s soap-makers supply local bazaars with bars scented with dried herbs from the Amu Darya floodplain.',
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
    detailText: 'Dried pumpkins were used as water vessels in traditional times: women carried water-filled pumpkins from wells. At home women used dried pumpkins as a baby rattle.',
    lat: 42.46,
    lon: 59.6,
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
  {
    id: 'amu-delta',
    name: 'Amu Darya Delta',
    image: '',
    description: 'River delta',
    detailText: 'The delta once supported vast wetlands and fisheries before upstream irrigation diverted most of its flow.',
    lat: 43.5,
    lon: 58.8,
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

interface IntroOverlayProps {
  onStart: () => void;
  onGuidedTour: () => void;
  onCanalTour: () => void;
  onObjectSelect?: (lat: number, lon: number, name: string) => void;
  onStartGame?: () => void;
}

type LandingView = 'main' | 'artifacts';

const IntroOverlay = ({ onStart, onGuidedTour, onCanalTour, onObjectSelect, onStartGame }: IntroOverlayProps) => {
  const [view, setView] = useState<LandingView>('main');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Main landing view
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-lg px-6">
        {/* Title */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-light tracking-[0.25em] uppercase text-foreground">
            The Aral Sea
          </h1>
          <div className="mt-3 h-px w-20 mx-auto bg-primary/40" />
          <p className="mt-4 text-sm tracking-widest uppercase text-muted-foreground">
            An interactive exploration
          </p>
        </div>

        {/* Four main options */}
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => onStartGame?.()}
            className="group flex items-center gap-4 bg-card/70 backdrop-blur-md border border-border/50 p-5 rounded-lg hover:bg-card hover:border-primary/40 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Gamepad2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground tracking-wide">Start a Game</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Explore missions, pour water, and discover the region
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => setView('artifacts')}
            className="group flex items-center gap-4 bg-card/70 backdrop-blur-md border border-border/50 p-5 rounded-lg hover:bg-card hover:border-primary/40 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
              <Package className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground tracking-wide">Explore Artifacts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browse 3D objects and cultural heritage items
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={onGuidedTour}
            className="group flex items-center gap-4 bg-card/70 backdrop-blur-md border border-border/50 p-5 rounded-lg hover:bg-card hover:border-primary/40 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/70 transition-colors">
              <BookOpen className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground tracking-wide">Guided Tours</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Narrated history of the Aral Sea & canal systems
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={onStart}
            className="group flex items-center gap-4 bg-card/70 backdrop-blur-md border border-border/50 p-5 rounded-lg hover:bg-card hover:border-primary/40 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
              <Map className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground tracking-wide">Free Exploration</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full map controls, data layers, and simulation tools
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
