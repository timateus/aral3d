import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import { mergeTerrains, mergeExpandTerrains } from '@/lib/terrain-merger';
import { createFlowState, addWaterAt, stepFlow, WaterFlowState } from '@/lib/water-flow-simulation';
import TerrainViewer, { TerrainViewerHandle } from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';
import Legend from '@/components/Legend';
import TimelineSlider from '@/components/TimelineSlider';
import IntroOverlay from '@/components/IntroOverlay';
import ScenarioChat from '@/components/ScenarioChat';
import WaterVolumeDisplay from '@/components/WaterVolumeDisplay';
import DataPanel, { AralAnnual, SEA_SERIES } from '@/components/DataPanel';
import { Camera, Video, BarChart3, Navigation, MapPin, Loader2, Crosshair, Download, Waves } from 'lucide-react';
import { exportTerrainSTL } from '@/lib/stl-exporter';
import type { ScenarioAction } from '@/types/scenario';
import { NARRATIVE_STEPS } from '@/lib/narrative-steps';
import NarrativeOverlay from '@/components/NarrativeOverlay';
import DamToolPanel from '@/components/DamToolPanel';
import WaterFlowPanel from '@/components/WaterFlowPanel';
import { BookOpen } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserLocation } from '@/hooks/useUserLocation';

export type DataSource = 'regional' | 'seabed' | 'merged';

const Index = () => {
  const isMobile = useIsMobile();
  const { location: userLocation, loading: locating, requestLocation } = useUserLocation();
  const [baseTerrain, setBaseTerrain] = useState<TerrainData | null>(null);
  const [seabedTerrain, setSeabedTerrain] = useState<TerrainData | null>(null);
  const [khorezmTerrain, setKhorezmTerrain] = useState<TerrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataSource: DataSource = 'merged';
  const [exaggeration, setExaggeration] = useState(10);
  const [waterLevel, setWaterLevel] = useState(53);
  const [waterLevelManual, setWaterLevelManual] = useState(false);
  const [showBorders, setShowBorders] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [show13thBasin, setShow13thBasin] = useState(true);
  const [show19thBasin, setShow19thBasin] = useState(true);
  const [show21stBasin, setShow21stBasin] = useState(true);
  const [showKhorezm, setShowKhorezm] = useState(false);
  const [showLakes, setShowLakes] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [watershedTerrain, setWatershedTerrain] = useState<TerrainData | null>(null);
  const [showPopDensity, setShowPopDensity] = useState(false);
  const [popHexSize, setPopHexSize] = useState(0.15);
  const [popHexHeight, setPopHexHeight] = useState(1.0);
  const [showWaterExtent, setShowWaterExtent] = useState(true);
  const [waterExtentYear, setWaterExtentYear] = useState(1960);
  
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [riverFlyover, setRiverFlyover] = useState(false);
  const [scenarioActions, setScenarioActions] = useState<ScenarioAction[]>([]);
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [narrativeActive, setNarrativeActive] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [narrativeStep, setNarrativeStep] = useState(0);
  const [damToolActive, setDamToolActive] = useState(false);
  const [raiseBrushRadius, setRaiseBrushRadius] = useState(5);
  const [raiseAmount, setRaiseAmount] = useState(10);
  const [raiseEditCount, setRaiseEditCount] = useState(0);
  const originalElevationsRef = useRef<Float32Array | null>(null);
  const [waterFlowActive, setWaterFlowActive] = useState(false);
  const [flowState, setFlowState] = useState<WaterFlowState | null>(null);
  const [flowRenderKey, setFlowRenderKey] = useState(0);
  const [flowAnimating, setFlowAnimating] = useState(false);
  const [flowSpeed, setFlowSpeed] = useState(5);
  const [flowWaterAmount, setFlowWaterAmount] = useState(5);
  const [flowWetCount, setFlowWetCount] = useState(0);
  const flowStateRef = useRef<WaterFlowState | null>(null);
  const flowAnimRef = useRef<number | null>(null);
  const viewerRef = useRef<TerrainViewerHandle>(null);

  // Lifted data panel state
  const [annualData, setAnnualData] = useState<AralAnnual[]>([]);
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(
    new Set(['seaLevel', 'volume', 'salinity'])
  );
  const [enabledClimate, setEnabledClimate] = useState<Set<string>>(
    new Set(['temp', 'rainfall', 'humidity', 'groundwater'])
  );

  useEffect(() => {
    fetch('/data/aral_sea_annual.json').then(r => r.json()).then(setAnnualData);
  }, []);

  // Sync water level to sea level time series when year changes
  useEffect(() => {
    setWaterLevelManual(false);
  }, [waterExtentYear]);

  useEffect(() => {
    if (waterLevelManual) return;
    const row = annualData.find(d => d.year === waterExtentYear);
    if (row && row.seaLevel != null) {
      setWaterLevel(row.seaLevel as number);
    }
  }, [waterExtentYear, annualData, waterLevelManual]);

  const toggleSeries = useCallback((key: string) => {
    setEnabledSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleClimate = useCallback((key: string) => {
    setEnabledClimate(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Current year metrics for 3D overlay
  const currentMetrics = useMemo(() => {
    const row = annualData.find(d => d.year === waterExtentYear);
    if (!row) return [];
    return SEA_SERIES
      .filter(s => enabledSeries.has(s.key))
      .map(s => ({
        name: s.name,
        value: row[s.key as keyof AralAnnual] as number,
        unit: s.unit,
        color: s.color,
      }));
  }, [annualData, waterExtentYear, enabledSeries]);

  const currentRiverInflow = useMemo(() => {
    const row = annualData.find(d => d.year === waterExtentYear);
    return row?.riverInflow as number | undefined;
  }, [annualData, waterExtentYear]);

  

  // Narrative step change handler
  const handleNarrativeStepChange = useCallback((newStep: number) => {
    setNarrativeStep(newStep);
    const step = NARRATIVE_STEPS[newStep];
    if (!step) return;
    setWaterExtentYear(step.year);
    setShowBorders(step.layers.showBorders);
    setShowRivers(step.layers.showRivers);
    setShow13thBasin(step.layers.show13thBasin);
    setShow19thBasin(step.layers.show19thBasin);
    setShow21stBasin(step.layers.show21stBasin);
    setShowWaterExtent(step.layers.showWaterExtent);
    setEnabledSeries(new Set(step.enabledSeries));
  }, []);

  const startNarrative = useCallback(() => {
    setStarted(true);
    setNarrativeActive(true);
    setNarrativeStep(0);
    handleNarrativeStepChange(0);
  }, [handleNarrativeStepChange]);

  const exitNarrative = useCallback(() => {
    setNarrativeActive(false);
  }, []);

  useEffect(() => {
    Promise.all([
      loadGeoTiff('/data/aral_region.tif'),
      loadGeoTiff('/data/aral_seabed.tif').catch((err) => {
        console.warn('Seabed DEM failed to load:', err);
        return null;
      }),
      loadGeoTiff('/data/khorezm.tif').catch((err) => {
        console.warn('Khorezm DEM failed to load:', err);
        return null;
      }),
      loadGeoTiff('/data/lower_amudarya.tif').catch((err) => {
        console.warn('Lower Amu Darya DEM failed to load:', err);
        return null;
      }),
    ])
      .then(([base, seabed, khorezm, watershed]) => {
        setBaseTerrain(base);
        if (seabed) setSeabedTerrain(seabed);
        if (khorezm) setKhorezmTerrain(khorezm);
        if (watershed) setWatershedTerrain(watershed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const { terrain, hideNoData } = useMemo(() => {
    if (!baseTerrain) return { terrain: null, hideNoData: false };
    let result = baseTerrain;
    if (seabedTerrain) result = mergeTerrains(result, seabedTerrain);
    if (showKhorezm && khorezmTerrain) result = mergeExpandTerrains(result, khorezmTerrain);
    if (showWatershed && watershedTerrain) {
      result = mergeExpandTerrains(result, watershedTerrain, false);
      return { terrain: result, hideNoData: true };
    }
    return { terrain: result, hideNoData: false };
  }, [baseTerrain, seabedTerrain, khorezmTerrain, showKhorezm, watershedTerrain, showWatershed]);

  // --- Water flow simulation ---
  const handleWaterFlowClick = useCallback((row: number, col: number) => {
    if (!terrain) return;
    let state = flowStateRef.current;
    if (!state) {
      state = createFlowState(terrain);
      flowStateRef.current = state;
    }
    addWaterAt(state, row, col, flowWaterAmount, 3);
    setFlowState(state);
    setFlowRenderKey(k => k + 1);
    // Count wet pixels
    let count = 0;
    for (let i = 0; i < state.waterDepth.length; i++) {
      if (state.waterDepth[i] > 0.01) count++;
    }
    setFlowWetCount(count);
  }, [terrain, flowWaterAmount]);

  const doFlowStep = useCallback(() => {
    const state = flowStateRef.current;
    if (!state) return;
    stepFlow(state);
    setFlowState(state);
    setFlowRenderKey(k => k + 1);
    let count = 0;
    for (let i = 0; i < state.waterDepth.length; i++) {
      if (state.waterDepth[i] > 0.01) count++;
    }
    setFlowWetCount(count);
  }, []);

  const resetFlow = useCallback(() => {
    flowStateRef.current = null;
    setFlowState(null);
    setFlowRenderKey(0);
    setFlowAnimating(false);
    setFlowWetCount(0);
    if (flowAnimRef.current) {
      cancelAnimationFrame(flowAnimRef.current);
      flowAnimRef.current = null;
    }
  }, []);

  // Animation loop for flow
  useEffect(() => {
    if (!flowAnimating) {
      if (flowAnimRef.current) {
        cancelAnimationFrame(flowAnimRef.current);
        flowAnimRef.current = null;
      }
      return;
    }

    let lastTime = 0;
    const interval = 1000 / (flowSpeed * 3); // ms between steps

    const tick = (time: number) => {
      if (time - lastTime >= interval) {
        lastTime = time;
        // Run multiple steps per frame for higher speeds
        const stepsPerFrame = Math.max(1, Math.floor(flowSpeed / 5));
        for (let s = 0; s < stepsPerFrame; s++) {
          doFlowStep();
        }
      }
      flowAnimRef.current = requestAnimationFrame(tick);
    };

    flowAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (flowAnimRef.current) cancelAnimationFrame(flowAnimRef.current);
    };
  }, [flowAnimating, flowSpeed, doFlowStep]);

  // Cleanup on deactivate
  useEffect(() => {
    if (!waterFlowActive) {
      setFlowAnimating(false);
      if (flowAnimRef.current) {
        cancelAnimationFrame(flowAnimRef.current);
        flowAnimRef.current = null;
      }
    }
  }, [waterFlowActive]);

  const handleScenarioActions = useCallback((actions: ScenarioAction[]) => {
    for (const a of actions) {
      if (a.type === 'water_level') {
        setWaterLevel(a.value);
      }
      if (a.type === 'dam' && a.simulate && terrain) {
        const res = simulateReservoir(
          terrain,
          a.lat,
          a.lon,
          a.height ?? 30,
          a.width ?? 200,
          a.orientation
        );
        setDamPosition({ lat: a.lat, lon: a.lon });
        setReservoirResult(res);
      }
    }
    const visualActions = actions.filter((a) => a.type !== 'water_level');
    if (visualActions.length > 0) {
      setScenarioActions((prev) => [...prev, ...visualActions]);
    }
  }, [terrain]);

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
            showLakes={showLakes}
            showWaterExtent={showWaterExtent}
            waterExtentYear={waterExtentYear}
            showPopDensity={showPopDensity}
            popHexSize={popHexSize}
            popHexHeight={popHexHeight}
            started={started}
            recording={recording}
            hideNoData={hideNoData}
            waterBounds={baseTerrain?.bounds}
            onWaterLevelChange={setWaterLevel}
            onRecordingDone={() => setRecording(false)}
            scenarioActions={scenarioActions}
            currentMetrics={currentMetrics}
            narrativeActive={narrativeActive}
            narrativeCameraPosition={narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.position : undefined}
            narrativeCameraTarget={narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.target : undefined}
            riverFlyover={riverFlyover}
            onRiverFlyoverDone={() => setRiverFlyover(false)}
            riverInflow={currentRiverInflow}
            userLocation={userLocation}
            inspectorEnabled={showInspector}
            damToolActive={damToolActive}
            onDamPlace={(lat, lon) => setDamPosition({ lat, lon })}
            reservoirResult={reservoirResult}
            waterFlowActive={waterFlowActive}
            onWaterFlowClick={handleWaterFlowClick}
            flowState={flowState}
            flowRenderKey={flowRenderKey}
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
        <IntroOverlay onStart={() => setStarted(true)} onGuidedTour={startNarrative} />
      )}

      {/* Narrative Overlay */}
      {narrativeActive && (
        <NarrativeOverlay
          step={narrativeStep}
          onStepChange={handleNarrativeStepChange}
          onExit={exitNarrative}
        />
      )}

      {/* Scenario Chat */}
      {started && !narrativeActive && !isMobile && (
        <ScenarioChat
          onActions={handleScenarioActions}
          onClear={() => setScenarioActions([])}
        />
      )}

      {/* Data Panel - positioned left */}
      {started && !narrativeActive && showDataPanel && !isMobile && (
        <div className="absolute top-16 left-4 z-10">
          <DataPanel
            currentYear={waterExtentYear}
            onClose={() => setShowDataPanel(false)}
            annualData={annualData}
            enabledSeries={enabledSeries}
            onToggleSeries={toggleSeries}
            enabledClimate={enabledClimate}
            onToggleClimate={toggleClimate}
          />
        </div>
      )}

      {/* Header */}
      {started && !narrativeActive && !isMobile && (
        <div className="absolute top-4 left-4 z-10">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            Aral Sea Terrain Viewer
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            aral_region_30m.tif
          </p>
        </div>
      )}

      {/* Controls - desktop only */}
      {started && !narrativeActive && !isMobile && (
        <div className="absolute top-4 right-4 z-10 space-y-3">
          <ControlPanel
            terrain={terrain}
            exaggeration={exaggeration}
            onExaggerationChange={setExaggeration}
            waterLevel={waterLevel}
            onWaterLevelChange={(v) => { setWaterLevelManual(true); setWaterLevel(v); }}
            loading={loading}
            dataSource={dataSource}
            onDataSourceChange={() => {}}
            hasSeabed={false}
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
            showKhorezm={showKhorezm}
            onToggleKhorezm={setShowKhorezm}
            showWatershed={showWatershed}
            onToggleWatershed={setShowWatershed}
            showLakes={showLakes}
            onToggleLakes={setShowLakes}
            showPopDensity={showPopDensity}
            onTogglePopDensity={setShowPopDensity}
            popHexSize={popHexSize}
            onPopHexSizeChange={setPopHexSize}
            popHexHeight={popHexHeight}
            onPopHexHeightChange={setPopHexHeight}
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
          <button
            onClick={() => { if (!riverFlyover) setRiverFlyover(true); }}
            disabled={riverFlyover || recording}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5" />
            {riverFlyover ? 'Flying…' : 'Amu Darya Flyover'}
          </button>
          <button
            onClick={() => setShowDataPanel(v => !v)}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {showDataPanel ? 'Hide Data Panel' : 'Show Data Panel'}
          </button>
          <button
            onClick={startNarrative}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guided Tour
          </button>
          <button
            onClick={() => setShowInspector(v => !v)}
            className={`glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${showInspector ? 'text-foreground ring-1 ring-primary/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {showInspector ? 'Inspector On' : 'Inspector Off'}
          </button>
          {terrain && (
            <DamToolPanel
              terrain={terrain}
              active={damToolActive}
              onToggle={() => { setDamToolActive(v => !v); setWaterFlowActive(false); }}
              damPosition={damPosition}
              onSimulationResult={setReservoirResult}
              onClear={() => setDamPosition(null)}
            />
          )}
          <WaterFlowPanel
            active={waterFlowActive}
            onToggle={() => { setWaterFlowActive(v => !v); setDamToolActive(false); }}
            isPlaced={!!flowState}
            stepCount={flowState?.stepCount ?? 0}
            wetPixelCount={flowWetCount}
            isAnimating={flowAnimating}
            onToggleAnimate={() => setFlowAnimating(v => !v)}
            onStep={doFlowStep}
            onReset={resetFlow}
            speed={flowSpeed}
            onSpeedChange={setFlowSpeed}
            waterAmount={flowWaterAmount}
            onWaterAmountChange={setFlowWaterAmount}
          />
          <button
            onClick={requestLocation}
            disabled={locating}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            {locating ? 'Locating…' : userLocation ? 'Located ✓' : 'Locate Me'}
          </button>
          <button
            onClick={() => {
              if (!terrain) return;
              const blob = exportTerrainSTL(terrain);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'aral_basin_x30_220mm.stl';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="glass-panel p-2.5 w-72 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export STL (220mm, x30)
          </button>
        </div>
      )}

      {/* Mobile locate button */}
      {started && !narrativeActive && isMobile && (
        <button
          onClick={requestLocation}
          disabled={locating}
          className="absolute top-4 right-4 z-10 glass-panel p-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        </button>
      )}

      {/* Timeline Slider - bottom bar */}
      {started && !narrativeActive && (
        <TimelineSlider
          year={waterExtentYear}
          onYearChange={setWaterExtentYear}
          visible={showWaterExtent}
          onToggleVisible={setShowWaterExtent}
        />
      )}
    </div>
  );
};

export default Index;
