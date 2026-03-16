import { useState, Suspense, useRef } from 'react';
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
    detailText: 'Khorezm soap is crafted from cottonseed oil, animal fat, and alkaline ash — a centuries-old recipe. The region\'s soap-makers supply local bazaars with bars scented with dried herbs from the Amu Darya floodplain.',
    lat: 41.55,
    lon: 60.63,
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
    <group ref={ref} scale={[6, 6, 6]}>
      <primitive object={scene.clone()} />
    </group>
  );
}

interface IntroOverlayProps {
  onStart: () => void;
  onGuidedTour: () => void;
  onCanalTour: () => void;
  onObjectSelect?: (lat: number, lon: number, name: string) => void;
}

const IntroOverlay = ({ onStart, onGuidedTour, onCanalTour, onObjectSelect }: IntroOverlayProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleItemClick = (item: LibraryItem) => {
    if (onObjectSelect) {
      onObjectSelect(item.lat, item.lon, item.name);
    }
    onStart();
  };

  const hoveredItem = LIBRARY_ITEMS.find(i => i.id === hoveredId);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-4xl px-6">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-light tracking-[0.2em] uppercase text-foreground">
            The Aral Sea
          </h1>
          <div className="mt-2 h-px w-16 mx-auto bg-primary/40" />
          <p className="mt-3 text-xs tracking-widest uppercase text-muted-foreground">
            Object Library
          </p>
        </div>

        <div className="flex gap-px">
          {/* Object Grid */}
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

                {/* Hover label */}
                <div
                  className={`absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200 ${
                    hoveredId === item.id ? 'opacity-100' : 'opacity-0'
                  }`}
                >
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

          {/* Detail Panel */}
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

        {/* Actions */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            onClick={onGuidedTour}
            className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors"
          >
            Guided Tour
          </button>
          <button
            onClick={onCanalTour}
            className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors"
          >
            Canal History
          </button>
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-primary hover:text-foreground transition-colors"
          >
            Explore <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;
