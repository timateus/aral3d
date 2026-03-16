import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface LibraryItem {
  id: string;
  name: string;
  image: string;
  description: string;
  lat: number;
  lon: number;
  is3D?: boolean;
}

const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'yarn-ball',
    name: 'Yarn Ball',
    image: '/images/objects/yarn-ball.png',
    description: 'Traditional craft',
    lat: 44.5,
    lon: 59.0,
    is3D: true,
  },
  {
    id: 'aral-north',
    name: 'Aral Sea North',
    image: '',
    description: 'Northern remnant',
    lat: 46.8,
    lon: 61.5,
  },
  {
    id: 'muynak',
    name: 'Muynak Harbor',
    image: '',
    description: 'Former fishing port',
    lat: 43.77,
    lon: 58.69,
  },
  {
    id: 'nukus',
    name: 'Nukus',
    image: '',
    description: 'Capital of Karakalpakstan',
    lat: 42.46,
    lon: 59.6,
  },
  {
    id: 'vozrozhdeniya',
    name: 'Vozrozhdeniya',
    image: '',
    description: 'Former island facility',
    lat: 45.0,
    lon: 59.0,
  },
  {
    id: 'amu-delta',
    name: 'Amu Darya Delta',
    image: '',
    description: 'River delta',
    lat: 43.5,
    lon: 58.8,
  },
];

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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-3xl px-6">
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

        {/* Object Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border/30">
          {LIBRARY_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group relative aspect-square bg-card/60 backdrop-blur-md border-0 transition-all duration-300 hover:bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 border border-muted-foreground/20 flex items-center justify-center text-xs text-muted-foreground/40 font-mono">
                    {item.is3D ? '3D' : '?'}
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

              {/* 3D badge */}
              {item.is3D && (
                <div className="absolute top-1.5 right-1.5 text-[8px] font-mono tracking-wider text-primary/60 uppercase">
                  3D
                </div>
              )}
            </button>
          ))}
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
