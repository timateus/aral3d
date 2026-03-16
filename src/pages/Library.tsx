import { useNavigate } from 'react-router-dom';

interface LibraryObject {
  id: string;
  name: string;
  image: string;
  description: string;
  lat: number;
  lon: number;
}

const PLACEHOLDER_OBJECTS: LibraryObject[] = [
  { id: '1', name: 'Aral Sea North', image: '', description: 'Northern remnant of the Aral Sea', lat: 46.8, lon: 61.5 },
  { id: '2', name: 'Amu Darya Delta', image: '', description: 'River delta feeding the southern basin', lat: 43.5, lon: 58.8 },
  { id: '3', name: 'Muynak Harbor', image: '', description: 'Former fishing port, now desert', lat: 43.77, lon: 58.69 },
  { id: '4', name: 'Barsa-Kelmes', image: '', description: 'Former island, now connected to shore', lat: 45.5, lon: 59.5 },
  { id: '5', name: 'Vozrozhdeniya', image: '', description: 'Former island bioweapons facility', lat: 45.0, lon: 59.0 },
  { id: '6', name: 'Karakalpakstan', image: '', description: 'Autonomous republic affected by the crisis', lat: 42.5, lon: 59.6 },
  { id: '7', name: 'Tashkent Canal', image: '', description: 'Major irrigation canal diverting water', lat: 41.3, lon: 69.3 },
  { id: '8', name: 'Nukus', image: '', description: 'Capital of Karakalpakstan', lat: 42.46, lon: 59.6 },
  { id: '9', name: 'Aral Seabed', image: '', description: 'Exposed former seabed — salt flats', lat: 44.5, lon: 59.0 },
];

export default function Library() {
  const navigate = useNavigate();

  const handleObjectClick = (obj: LibraryObject) => {
    navigate(`/?lat=${obj.lat}&lon=${obj.lon}&name=${encodeURIComponent(obj.name)}`);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#8ec8e8]">
          Object Library
        </h1>
        <p className="mt-2 text-sm text-white/50 max-w-lg mx-auto">
          Select an object to explore its location on the 3D terrain map
        </p>
      </header>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {PLACEHOLDER_OBJECTS.map((obj) => (
            <button
              key={obj.id}
              onClick={() => handleObjectClick(obj)}
              className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-[#8ec8e8]/50 hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#8ec8e8]/50"
            >
              {obj.image ? (
                <img
                  src={obj.image}
                  alt={obj.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl text-white/30">
                    ?
                  </div>
                </div>
              )}

              {/* Label overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                <h3 className="text-sm font-semibold leading-tight text-white group-hover:text-[#8ec8e8] transition-colors">
                  {obj.name}
                </h3>
                <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">
                  {obj.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
