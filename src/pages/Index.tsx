import { useState, useEffect } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import TerrainViewer from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';
import Legend from '@/components/Legend';
import IntroOverlay from '@/components/IntroOverlay';

const Index = () => {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exaggeration, setExaggeration] = useState(10);
  const [waterLevel, setWaterLevel] = useState(29);
  const [showBorders, setShowBorders] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    loadGeoTiff('/data/aral_region.tif')
      .then(setTerrain)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* 3D Viewer */}
      <div className="absolute inset-0">
        {terrain && (
          <TerrainViewer
            terrain={terrain}
            exaggeration={exaggeration}
            waterLevel={waterLevel}
            showBorders={showBorders}
            showRivers={showRivers}
            started={started}
          />
        )}
        {!terrain && !loading && error && (
          <div className="flex items-center justify-center h-full">
            <div className="glass-panel p-6 text-center">
              <p className="text-destructive text-sm font-mono">Error: {error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Intro Overlay */}
      {!started && !loading && terrain && (
        <IntroOverlay onStart={() => setStarted(true)} />
      )}

      {/* Header */}
      {started && (
        <div className="absolute top-4 left-4 z-10">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Aral Sea Terrain Viewer
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            aral_region_30m.tif
          </p>
        </div>
      )}

      {/* Controls */}
      {started && (
        <div className="absolute top-4 right-4 z-10 space-y-3">
          <ControlPanel
            terrain={terrain}
            exaggeration={exaggeration}
            onExaggerationChange={setExaggeration}
            waterLevel={waterLevel}
            onWaterLevelChange={setWaterLevel}
            loading={loading}
          />
          <Legend
            showBorders={showBorders}
            onToggleBorders={setShowBorders}
            showRivers={showRivers}
            onToggleRivers={setShowRivers}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
