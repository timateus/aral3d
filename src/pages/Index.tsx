import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import { mergeTerrains } from '@/lib/terrain-merger';
import TerrainViewer, { TerrainViewerHandle } from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';
import Legend from '@/components/Legend';
import TimelineSlider from '@/components/TimelineSlider';
import IntroOverlay from '@/components/IntroOverlay';
import ScenarioChat from '@/components/ScenarioChat';
import WaterVolumeDisplay from '@/components/WaterVolumeDisplay';
import { Camera, Video } from 'lucide-react';
import type { ScenarioAction } from '@/types/scenario';

export type DataSource = 'regional' | 'seabed' | 'merged';

const Index = () => {
  const [baseTerrain, setBaseTerrain] = useState<TerrainData | null>(null);
  const [seabedTerrain, setSeabedTerrain] = useState<TerrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('merged');
  const [exaggeration, setExaggeration] = useState(10);
  const [waterLevel, setWaterLevel] = useState(29);
  const [showBorders, setShowBorders] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [show13thBasin, setShow13thBasin] = useState(true);
  const [show19thBasin, setShow19thBasin] = useState(true);
  const [show21stBasin, setShow21stBasin] = useState(true);
  const [showWaterExtent, setShowWaterExtent] = useState(true);
  const [waterExtentYear, setWaterExtentYear] = useState(2012);
  
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [scenarioActions, setScenarioActions] = useState<ScenarioAction[]>([]);
  const viewerRef = useRef<TerrainViewerHandle>(null);

  const handleScenarioActions = useCallback((actions: ScenarioAction[]) => {
    // Handle water_level actions by updating the slider
    for (const a of actions) {
      if (a.type === 'water_level') {
        setWaterLevel(a.value);
      }
    }
    // Accumulate non-water-level actions
    const visualActions = actions.filter((a) => a.type !== 'water_level');
    if (visualActions.length > 0) {
      setScenarioActions((prev) => [...prev, ...visualActions]);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadGeoTiff('/data/aral_region.tif'),
      loadGeoTiff('/data/aral_seabed.tif').catch((err) => {
        console.warn('Seabed DEM failed to load:', err);
        return null;
      }),
    ])
      .then(([base, seabed]) => {
        setBaseTerrain(base);
        if (seabed) setSeabedTerrain(seabed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const terrain = useMemo(() => {
    if (!baseTerrain) return null;
    if (dataSource === 'seabed' && seabedTerrain) return seabedTerrain;
    if (dataSource === 'merged' && seabedTerrain) return mergeTerrains(baseTerrain, seabedTerrain);
    return baseTerrain;
  }, [baseTerrain, seabedTerrain, dataSource]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* 3D Viewer */}
      <div className="absolute inset-0">
        {terrain && (
          <TerrainViewer
            ref={viewerRef}
            terrain={terrain}
            exaggeration={exaggeration}
            waterLevel={waterLevel}
            showBorders={showBorders}
            showRivers={showRivers}
            show13thBasin={show13thBasin}
            show19thBasin={show19thBasin}
            show21stBasin={show21stBasin}
            showWaterExtent={showWaterExtent}
            waterExtentYear={waterExtentYear}
            started={started}
            recording={recording}
            onWaterLevelChange={setWaterLevel}
            onRecordingDone={() => setRecording(false)}
            scenarioActions={scenarioActions}
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

      {/* Scenario Chat */}
      {started && (
        <ScenarioChat
          onActions={handleScenarioActions}
          onClear={() => setScenarioActions([])}
        />
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
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
            hasSeabed={!!seabedTerrain}
          />
          <Legend
            showBorders={showBorders}
            onToggleBorders={setShowBorders}
            showRivers={showRivers}
            onToggleRivers={setShowRivers}
            show13thBasin={show13thBasin}
            onToggle13thBasin={setShow13thBasin}
            show19thBasin={show19thBasin}
            onToggle19thBasin={setShow19thBasin}
            show21stBasin={show21stBasin}
            onToggle21stBasin={setShow21stBasin}
          />
          <TimelineSlider
            year={waterExtentYear}
            onYearChange={setWaterExtentYear}
            visible={showWaterExtent}
            onToggleVisible={setShowWaterExtent}
          />
          {terrain && (
            <WaterVolumeDisplay
              terrain={terrain}
              waterLevel={waterLevel}
              waterExtentYear={waterExtentYear}
              showWaterExtent={showWaterExtent}
            />
          )}
          <button
            onClick={() => viewerRef.current?.screenshot()}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            Save Screenshot
          </button>
          <button
            onClick={() => { if (!recording) setRecording(true); }}
            disabled={recording}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Video className="w-3.5 h-3.5" />
            {recording ? 'Recording…' : 'Make a Video'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Index;
