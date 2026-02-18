import { useState, useEffect } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import TerrainViewer from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';

const Index = () => {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exaggeration, setExaggeration] = useState(3);

  useEffect(() => {
    loadGeoTiff('/data/aral_top_left.tif')
      .then(setTerrain)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* 3D Viewer */}
      <div className="absolute inset-0">
        {terrain && (
          <TerrainViewer terrain={terrain} exaggeration={exaggeration} />
        )}
        {!terrain && !loading && error && (
          <div className="flex items-center justify-center h-full">
            <div className="glass-panel p-6 text-center">
              <p className="text-destructive text-sm font-mono">Error: {error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          DEM Terrain Viewer
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          aral_top_left.tif
        </p>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-10">
        <ControlPanel
          terrain={terrain}
          exaggeration={exaggeration}
          onExaggerationChange={setExaggeration}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Index;
