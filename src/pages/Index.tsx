import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import { mergeTerrains, mergeExpandTerrains } from '@/lib/terrain-merger';
import { createFlowState, addWaterAt, stepFlow, WaterFlowState } from '@/lib/water-flow-simulation';
import { digCanalsFromBasins } from '@/lib/canal-auto-dig';
import TerrainViewer, { TerrainViewerHandle } from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';
import Legend from '@/components/Legend';
import TimelineSlider from '@/components/TimelineSlider';
import IntroOverlay from '@/components/IntroOverlay';
import ScenarioChat from '@/components/ScenarioChat';
import WaterVolumeDisplay from '@/components/WaterVolumeDisplay';
import DataPanel, { AralAnnual, SEA_SERIES } from '@/components/DataPanel';
import { Camera, Video, BarChart3, Navigation, MapPin, Loader2, Crosshair, Download, Waves, Gamepad2 } from 'lucide-react';
import { exportTerrainSTL } from '@/lib/stl-exporter';
import GameMissionHUD from '@/components/GameMissionHUD';
import type { GameModeState } from '@/components/GameMode';
import type { ScenarioAction } from '@/types/scenario';
import { NARRATIVE_STEPS } from '@/lib/narrative-steps';
import { CANAL_TOUR_STEPS, getEthnicityColor } from '@/lib/canal-tour-steps';
import { AGMAR_TOUR_STEPS } from '@/lib/agmar-tour-steps';
import NarrativeOverlay from '@/components/NarrativeOverlay';
import CanalTourOverlay from '@/components/CanalTourOverlay';
import AgmarTourOverlay from '@/components/AgmarTourOverlay';
import QuadrantView from '@/components/QuadrantView';
import DamToolPanel from '@/components/DamToolPanel';
import CanalToolPanel from '@/components/CanalToolPanel';
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
  const [show13thBasin, setShow13thBasin] = useState(false);
  const [show19thBasin, setShow19thBasin] = useState(false);
  const [show21stBasin, setShow21stBasin] = useState(false);
  const [showKhorezm, setShowKhorezm] = useState(false);
  const [showLakes, setShowLakes] = useState(false);
  const [show21cLakes, setShow21cLakes] = useState(false);
  const [showWatershed, setShowWatershed] = useState(false);
  const [watershedTerrain, setWatershedTerrain] = useState<TerrainData | null>(null);
  const [showLandcover, setShowLandcover] = useState(false);
  const [landcoverVisibleClasses, setLandcoverVisibleClasses] = useState<Set<number> | undefined>(undefined);
  const [landcoverAvailableClasses, setLandcoverAvailableClasses] = useState<number[]>([]);
  const [showPopDensity, setShowPopDensity] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [showChoropleth, setShowChoropleth] = useState(false);
  const [choroplethIndicator, setChoroplethIndicator] = useState('sewage');
  const [choroplethExaggeration, setChoroplethExaggeration] = useState(1.0);
  const [popHexSize, setPopHexSize] = useState(0.15);
  const [popHexHeight, setPopHexHeight] = useState(1.0);
  const [showWaterExtent, setShowWaterExtent] = useState(true);
  const [showSchools, setShowSchools] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(false);
  const [waterExtentYear, setWaterExtentYear] = useState(1960);
  
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [riverFlyover, setRiverFlyover] = useState(false);
  const [scenarioActions, setScenarioActions] = useState<ScenarioAction[]>([]);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [narrativeActive, setNarrativeActive] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [narrativeStep, setNarrativeStep] = useState(0);
  const [canalTourActive, setCanalTourActive] = useState(false);
  const [canalTourStep, setCanalTourStep] = useState(0);
  const [damToolActive, setDamToolActive] = useState(false);
  const [raiseBrushRadius, setRaiseBrushRadius] = useState(5);
  const [raiseAmount, setRaiseAmount] = useState(10);
  const [raiseEditCount, setRaiseEditCount] = useState(0);
  const [raiseEnabled, setRaiseEnabled] = useState(true);
  const originalElevationsRef = useRef<Float32Array | null>(null);
  const raisedPixelsRef = useRef<Set<number>>(new Set());
  const [terrainVersion, setTerrainVersion] = useState(0);
  // Canal dig tool state
  const [canalToolActive, setCanalToolActive] = useState(false);
  const [canalBrushRadius, setCanalBrushRadius] = useState(3);
  const [canalDigDepth, setCanalDigDepth] = useState(10);
  const [canalEditCount, setCanalEditCount] = useState(0);
  const [canalDigEnabled, setCanalDigEnabled] = useState(true);
  const dugPixelsRef = useRef<Set<number>>(new Set());
  const [waterFlowActive, setWaterFlowActive] = useState(false);
  const [autoDigActive, setAutoDigActive] = useState(false);
  const [autoDigging, setAutoDigging] = useState(false);
  const autoDigPixelsRef = useRef<Set<number>>(new Set());
  const [showObjectLibrary, setShowObjectLibrary] = useState(false);
  const [gameModeActive, setGameModeActive] = useState(false);
  const [gameModeState, setGameModeState] = useState<GameModeState | null>(null);
  const [bowlWorldActive, setBowlWorldActive] = useState(false);
  const [aryqWorldActive, setAryqWorldActive] = useState(false);
  const [quadrantViewActive, setQuadrantViewActive] = useState(false);
  const [agmarTourActive, setAgmarTourActive] = useState(false);
  const [agmarTourStep, setAgmarTourStep] = useState(0);
  
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

  // Canal tour handlers
  const handleCanalTourStepChange = useCallback((newStep: number) => {
    setCanalTourStep(newStep);
    const step = CANAL_TOUR_STEPS[newStep];
    if (!step) return;
    setWaterExtentYear(step.year);
    setShowBorders(step.layers.showBorders);
    setShowRivers(step.layers.showRivers);
    // Always show all basin layers during canal tour so we can highlight matching lines
    setShow13thBasin(true);
    setShow19thBasin(true);
    setShow21stBasin(true);
    setShowWaterExtent(step.layers.showWaterExtent);
    setShowKhorezm(true);
  }, []);

  const startCanalTour = useCallback(() => {
    setStarted(true);
    setCanalTourActive(true);
    setCanalTourStep(0);
    handleCanalTourStepChange(0);
  }, [handleCanalTourStepChange]);

  const exitCanalTour = useCallback(() => {
    setCanalTourActive(false);
    setShowKhorezm(false);
  }, []);

  // Ag-MAR tour handlers
  const agmarAnimRef = useRef<number | null>(null);

  const handleAgmarTourStepChange = useCallback((newStep: number) => {
    // Cancel any running year animation
    if (agmarAnimRef.current) {
      cancelAnimationFrame(agmarAnimRef.current);
      agmarAnimRef.current = null;
    }

    setAgmarTourStep(newStep);
    const step = AGMAR_TOUR_STEPS[newStep];
    if (!step) return;
    setShowBorders(step.layers.showBorders);
    setShowRivers(step.layers.showRivers);
    setShowWaterExtent(step.layers.showWaterExtent);
    setShowKhorezm(step.layers.showKhorezm);
    setShowLandcover(step.layers.showLandcover);
    setShowChoropleth(step.layers.showChoropleth);
    if (step.layers.choroplethIndicator) setChoroplethIndicator(step.layers.choroplethIndicator);
    if (step.enabledSeries) setEnabledSeries(new Set(step.enabledSeries));

    // Year animation
    if (step.animateYearFrom != null) {
      const fromYear = step.animateYearFrom;
      const toYear = step.year;
      const duration = 4000; // 4 seconds
      const startTime = performance.now();
      setWaterExtentYear(fromYear);

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const currentYear = Math.round(fromYear + (toYear - fromYear) * t);
        setWaterExtentYear(currentYear);
        if (t < 1) {
          agmarAnimRef.current = requestAnimationFrame(tick);
        } else {
          agmarAnimRef.current = null;
        }
      };
      agmarAnimRef.current = requestAnimationFrame(tick);
    } else {
      setWaterExtentYear(step.year);
    }
  }, []);

  const startAgmarTour = useCallback(() => {
    setStarted(true);
    setAgmarTourActive(true);
    setAgmarTourStep(0);
    handleAgmarTourStepChange(0);
  }, [handleAgmarTourStepChange]);

  const exitAgmarTour = useCallback(() => {
    if (agmarAnimRef.current) {
      cancelAnimationFrame(agmarAnimRef.current);
      agmarAnimRef.current = null;
    }
    setAgmarTourActive(false);
    setShowLandcover(false);
    setShowChoropleth(false);
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
    let expanded = false;
    if (showKhorezm && khorezmTerrain) {
      result = mergeExpandTerrains(result, khorezmTerrain, false);
      expanded = true;
    }
    if (showWatershed && watershedTerrain) {
      result = mergeExpandTerrains(result, watershedTerrain, false);
      expanded = true;
    }
    return { terrain: result, hideNoData: expanded };
  }, [baseTerrain, seabedTerrain, khorezmTerrain, showKhorezm, watershedTerrain, showWatershed]);

  // Listen for game mode state events
  useEffect(() => {
    const handler = (e: Event) => {
      const state = (e as CustomEvent<GameModeState>).detail;
      setGameModeState(state);
      if (state.requiresKhorezm !== undefined) setShowKhorezm(state.requiresKhorezm);
      if (state.requiresInspector !== undefined) setShowInspector(state.requiresInspector);
      if (state.inBowlWorld) setBowlWorldActive(true);
    };
    window.addEventListener('game-mode-state', handler);
    return () => window.removeEventListener('game-mode-state', handler);
  }, []);

  // Game mode water pouring handler
  const handleGameAddWater = useCallback((row: number, col: number) => {
    if (!terrain) return;
    let state = flowStateRef.current;
    if (!state) {
      state = createFlowState(terrain);
      flowStateRef.current = state;
    }
    addWaterAt(state, row, col, 3, 2);
    setFlowState(state);
    setFlowRenderKey(k => k + 1);
    // Also auto-animate
    if (!flowAnimRef.current) {
      setFlowAnimating(true);
    }
  }, [terrain]);

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

  // Raise terrain click handler
  const handleRaiseTerrainClick = useCallback((row: number, col: number) => {
    if (!terrain) return;
    if (!originalElevationsRef.current) {
      originalElevationsRef.current = new Float32Array(terrain.elevations);
    }
    const { width, height, elevations } = terrain;
    for (let dr = -raiseBrushRadius; dr <= raiseBrushRadius; dr++) {
      for (let dc = -raiseBrushRadius; dc <= raiseBrushRadius; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= height || c < 0 || c >= width) continue;
        const dist = Math.sqrt(dr * dr + dc * dc);
        if (dist > raiseBrushRadius) continue;
        const falloff = 1 - dist / (raiseBrushRadius + 1);
        const idx = r * width + c;
        elevations[idx] += raiseAmount * falloff;
        raisedPixelsRef.current.add(idx);
      }
    }
    let newMax = terrain.maxElevation;
    for (let i = 0; i < elevations.length; i++) {
      if (elevations[i] > newMax) newMax = elevations[i];
    }
    terrain.maxElevation = newMax;
    setRaiseEditCount(c => c + 1);
    setTerrainVersion(v => v + 1);
  }, [terrain, raiseBrushRadius, raiseAmount]);

  const handleResetTerrain = useCallback(() => {
    if (!terrain || !originalElevationsRef.current) return;
    terrain.elevations.set(originalElevationsRef.current);
    let newMax = terrain.minElevation;
    for (let i = 0; i < terrain.elevations.length; i++) {
      if (terrain.elevations[i] > newMax) newMax = terrain.elevations[i];
    }
    terrain.maxElevation = newMax;
    originalElevationsRef.current = null;
    raisedPixelsRef.current = new Set();
    setRaiseEditCount(0);
    setRaiseEnabled(true);
    setTerrainVersion(v => v + 1);
  }, [terrain]);

  const handleToggleRaise = useCallback(() => {
    if (!terrain || !originalElevationsRef.current) return;
    if (raiseEnabled) {
      // Disable: restore original elevations
      terrain.elevations.set(originalElevationsRef.current);
    } else {
      // Enable: reapply by computing diff
      // We stored the modified state, so we need to swap back
      // Actually, let's store the modified elevations when disabling
    }
    // Simpler: swap current and original
    const current = new Float32Array(terrain.elevations);
    terrain.elevations.set(originalElevationsRef.current);
    originalElevationsRef.current = current;
    // Recalc max
    let newMax = terrain.minElevation;
    for (let i = 0; i < terrain.elevations.length; i++) {
      if (terrain.elevations[i] > newMax) newMax = terrain.elevations[i];
    }
    terrain.maxElevation = newMax;
    setRaiseEnabled(v => !v);
    setTerrainVersion(v => v + 1);
  }, [terrain, raiseEnabled]);

  // Canal dig click handler
  const handleDigCanalClick = useCallback((row: number, col: number) => {
    if (!terrain) return;
    if (!originalElevationsRef.current) {
      originalElevationsRef.current = new Float32Array(terrain.elevations);
    }
    const { width, height, elevations } = terrain;
    for (let dr = -canalBrushRadius; dr <= canalBrushRadius; dr++) {
      for (let dc = -canalBrushRadius; dc <= canalBrushRadius; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= height || c < 0 || c >= width) continue;
        const dist = Math.sqrt(dr * dr + dc * dc);
        if (dist > canalBrushRadius) continue;
        const falloff = 1 - dist / (canalBrushRadius + 1);
        const idx = r * width + c;
        elevations[idx] -= canalDigDepth * falloff;
        dugPixelsRef.current.add(idx);
      }
    }
    let newMin = terrain.maxElevation;
    for (let i = 0; i < elevations.length; i++) {
      if (elevations[i] < newMin) newMin = elevations[i];
    }
    terrain.minElevation = newMin;
    setCanalEditCount(c => c + 1);
    setTerrainVersion(v => v + 1);
  }, [terrain, canalBrushRadius, canalDigDepth]);

  const handleResetCanal = useCallback(() => {
    if (!terrain || !originalElevationsRef.current) return;
    for (const idx of dugPixelsRef.current) {
      terrain.elevations[idx] = originalElevationsRef.current[idx];
    }
    dugPixelsRef.current = new Set();
    setCanalEditCount(0);
    setCanalDigEnabled(true);
    setTerrainVersion(v => v + 1);
    if (raisedPixelsRef.current.size === 0) {
      originalElevationsRef.current = null;
    }
  }, [terrain]);

  const handleToggleDig = useCallback(() => {
    if (!terrain || !originalElevationsRef.current) return;
    for (const idx of dugPixelsRef.current) {
      const tmp = terrain.elevations[idx];
      terrain.elevations[idx] = originalElevationsRef.current[idx];
      originalElevationsRef.current[idx] = tmp;
    }
    setCanalDigEnabled(v => !v);
    setTerrainVersion(v => v + 1);
  }, [terrain, canalDigEnabled]);

  const handleAutoDigCanals = useCallback(async () => {
    if (!terrain) return;
    const anyBasin = show13thBasin || show19thBasin || show21stBasin;
    if (!anyBasin) return;

    if (autoDigActive) {
      // Undo auto-dig: restore original elevations for auto-dug pixels
      if (originalElevationsRef.current) {
        for (const idx of autoDigPixelsRef.current) {
          terrain.elevations[idx] = originalElevationsRef.current[idx];
        }
        // Remove from dugPixels visual set too
        for (const idx of autoDigPixelsRef.current) {
          dugPixelsRef.current.delete(idx);
        }
        autoDigPixelsRef.current = new Set();
        // Recalc min
        let newMin = terrain.maxElevation;
        for (let i = 0; i < terrain.elevations.length; i++) {
          if (terrain.elevations[i] < newMin) newMin = terrain.elevations[i];
        }
        terrain.minElevation = newMin;
        if (raisedPixelsRef.current.size === 0 && dugPixelsRef.current.size === 0) {
          originalElevationsRef.current = null;
        }
      }
      setAutoDigActive(false);
      setCanalEditCount(c => Math.max(0, c - autoDigPixelsRef.current.size));
      setTerrainVersion(v => v + 1);
      return;
    }

    // Save original elevations if not yet saved
    if (!originalElevationsRef.current) {
      originalElevationsRef.current = new Float32Array(terrain.elevations);
    }

    setAutoDigging(true);
    const newDugPixels = await digCanalsFromBasins(
      terrain,
      { show13th: show13thBasin, show19th: show19thBasin, show21st: show21stBasin },
      canalDigDepth,
      canalBrushRadius
    );

    // Merge into visual sets
    for (const idx of newDugPixels) {
      dugPixelsRef.current.add(idx);
    }
    autoDigPixelsRef.current = newDugPixels;

    setAutoDigActive(true);
    setAutoDigging(false);
    setCanalEditCount(c => c + newDugPixels.size);
    setCanalDigEnabled(true);
    setTerrainVersion(v => v + 1);
  }, [terrain, show13thBasin, show19thBasin, show21stBasin, autoDigActive, canalDigDepth, canalBrushRadius]);

  const handleScenarioActions = useCallback((actions: ScenarioAction[]) => {
    for (const a of actions) {
      if (a.type === 'water_level') {
        setWaterLevel(a.value);
      }
    }
    const visualActions = actions.filter((a) => a.type !== 'water_level');
    if (visualActions.length > 0) {
      setScenarioActions((prev) => [...prev, ...visualActions]);
    }
  }, [terrain]);

  const isMapExploration = started && !gameModeActive && !aryqWorldActive && !bowlWorldActive && !showObjectLibrary && !quadrantViewActive;

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
            show21cLakes={show21cLakes}
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
            narrativeActive={narrativeActive || canalTourActive || agmarTourActive}
            narrativeCameraPosition={
              narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.position :
              canalTourActive ? CANAL_TOUR_STEPS[canalTourStep]?.camera.position :
              agmarTourActive ? AGMAR_TOUR_STEPS[agmarTourStep]?.camera.position :
              undefined
            }
            narrativeCameraTarget={
              narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.target :
              canalTourActive ? CANAL_TOUR_STEPS[canalTourStep]?.camera.target :
              agmarTourActive ? AGMAR_TOUR_STEPS[agmarTourStep]?.camera.target :
              undefined
            }
            riverFlyover={riverFlyover}
            onRiverFlyoverDone={() => setRiverFlyover(false)}
            riverInflow={currentRiverInflow}
            userLocation={userLocation}
            inspectorEnabled={showInspector}
            damToolActive={damToolActive}
            onDamPlace={handleRaiseTerrainClick}
            canalToolActive={canalToolActive}
            onCanalDig={handleDigCanalClick}
            waterFlowActive={waterFlowActive}
            onWaterFlowClick={handleWaterFlowClick}
            flowState={flowState}
            flowRenderKey={flowRenderKey}
            terrainVersion={terrainVersion}
            raisedPixels={raiseEnabled ? raisedPixelsRef.current : undefined}
            dugPixels={canalDigEnabled ? dugPixelsRef.current : undefined}
            showMigration={showMigration}
            migrationYear={waterExtentYear}
            showChoropleth={showChoropleth}
            choroplethIndicator={choroplethIndicator}
            choroplethExaggeration={choroplethExaggeration}
            canalHighlights={canalTourActive ? CANAL_TOUR_STEPS[canalTourStep]?.canals.map(c => ({
              canal: c.canal,
              lat: c.lat,
              lon: c.lon,
              ethnicity: c.ethnicity,
              color: getEthnicityColor(c.ethnicity),
            })) : undefined}
            highlightedCanalNames={canalTourActive ? new Set(CANAL_TOUR_STEPS[canalTourStep]?.canals.map(c => c.canal)) : undefined}
            canalTourActive={canalTourActive}
            showObjectLibrary={showObjectLibrary}
            onObjectSelect={(obj) => {
              console.log('Selected object:', obj.name, obj.lat, obj.lon);
            }}
            gameModeActive={gameModeActive}
            onGameAddWater={handleGameAddWater}
            bowlWorldActive={bowlWorldActive}
            onBowlWorldComplete={() => {
              setBowlWorldActive(false);
              window.dispatchEvent(new CustomEvent('bowl-world-complete'));
            }}
            aryqWorldActive={aryqWorldActive}
            onAryqWorldComplete={() => {
              setAryqWorldActive(false);
            }}
            onNukusClick={() => {
              setAryqWorldActive(true);
            }}
            showLandcover={showLandcover}
            landcoverVisibleClasses={landcoverVisibleClasses}
            onLandcoverAvailableClasses={setLandcoverAvailableClasses}
            showSchools={showSchools}
            showVocabulary={showVocabulary}
            agmarShowProposalSites={agmarTourActive && !!AGMAR_TOUR_STEPS[agmarTourStep]?.proposalSites}
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
      {!started && !loading && terrain && !quadrantViewActive && (
        <IntroOverlay
          onStart={() => setStarted(true)}
          onGuidedTour={startNarrative}
          onCanalTour={startCanalTour}
          onAgmarTour={startAgmarTour}
          onObjectSelect={(lat, lon, name) => { setStarted(true); }}
          onStartGame={() => {
            setStarted(true);
            setGameModeActive(true);
            setWaterExtentYear(2024);
            setFlowSpeed(20);
            setShowWaterExtent(true);
          }}
          onQuadrants={() => setQuadrantViewActive(true)}
        />
      )}

      {/* Quadrant View */}
      {quadrantViewActive && !started && (
        <QuadrantView
          onSelectQuadrant={(id) => {
            setQuadrantViewActive(false);
            setStarted(true);
            if (id === 'serious-small' || id === 'playful-small') {
              setAryqWorldActive(true);
            }
          }}
          onBack={() => setQuadrantViewActive(false)}
        />
      )}

      {/* Narrative Overlay */}
      {narrativeActive && (
        <NarrativeOverlay
          step={narrativeStep}
          onStepChange={handleNarrativeStepChange}
          onExit={exitNarrative}
        />
      )}

      {/* Canal Tour Overlay */}
      {canalTourActive && (
        <CanalTourOverlay
          step={canalTourStep}
          onStepChange={handleCanalTourStepChange}
          onExit={exitCanalTour}
        />
      )}

      {/* Ag-MAR Tour Overlay */}
      {agmarTourActive && (
        <AgmarTourOverlay
          step={agmarTourStep}
          onStepChange={handleAgmarTourStepChange}
          onExit={exitAgmarTour}
        />
      )}

      {/* Scenario Chat */}
      {isMapExploration && !isMobile && (
        <ScenarioChat
          onActions={handleScenarioActions}
          onClear={() => setScenarioActions([])}
        />
      )}

      {/* Data Panel - positioned left */}
      {isMapExploration && showDataPanel && !isMobile && (
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
      {isMapExploration && !isMobile && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
          <button
            onClick={() => { setStarted(false); setGameModeActive(false); }}
            className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm"
          >
            Menu
          </button>
          {!gameModeActive && (
            <button
              onClick={() => {
                setGameModeActive(true);
                setWaterExtentYear(2024);
                setFlowSpeed(20);
              }}
              className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm flex items-center gap-1.5"
            >
              <Gamepad2 className="w-3 h-3" />
              Game Mode
            </button>
          )}
          {gameModeActive && (
            <button
              onClick={() => setGameModeActive(false)}
              className="text-[10px] tracking-[0.15em] uppercase text-primary transition-colors border border-primary/40 px-3 py-1.5 bg-primary/10 backdrop-blur-sm flex items-center gap-1.5"
            >
              <Gamepad2 className="w-3 h-3" />
              Exit Game
            </button>
          )}
          {!gameModeActive && (
            <>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Aral Sea Terrain Viewer
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                aral_region_30m.tif
              </p>
            </>
          )}
        </div>
      )}

      {/* Controls - desktop only, hide in game mode unless toggled */}
      {isMapExploration && !isMobile && (
        <div className="absolute top-4 right-4 z-10 space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto w-[280px] scrollbar-thin pr-1">
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
            showLandcover={showLandcover}
            onToggleLandcover={setShowLandcover}
            landcoverVisibleClasses={landcoverVisibleClasses}
            landcoverAvailableClasses={landcoverAvailableClasses}
            onLandcoverVisibleClassesChange={setLandcoverVisibleClasses}
            showLakes={showLakes}
            onToggleLakes={setShowLakes}
            show21cLakes={show21cLakes}
            onToggle21cLakes={setShow21cLakes}
            showPopDensity={showPopDensity}
            onTogglePopDensity={setShowPopDensity}
            showMigration={showMigration}
            onToggleMigration={(val: boolean) => {
              setShowMigration(val);
              if (val) {
                setExaggeration(1);
              }
            }}
            popHexSize={popHexSize}
            onPopHexSizeChange={setPopHexSize}
            popHexHeight={popHexHeight}
            onPopHexHeightChange={setPopHexHeight}
            showChoropleth={showChoropleth}
            onToggleChoropleth={(val: boolean) => {
              setShowChoropleth(val);
              if (val) setExaggeration(0);
              else setExaggeration(10);
            }}
            choroplethIndicator={choroplethIndicator}
            onChoroplethIndicatorChange={setChoroplethIndicator}
            choroplethExaggeration={choroplethExaggeration}
            onChoroplethExaggerationChange={setChoroplethExaggeration}
            showSchools={showSchools}
            onToggleSchools={setShowSchools}
            showVocabulary={showVocabulary}
            onToggleVocabulary={setShowVocabulary}
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
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            Save Screenshot
          </button>
          <button
            onClick={() => { if (!recording) setRecording(true); }}
            disabled={recording}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Video className="w-3.5 h-3.5" />
            {recording ? 'Recording…' : 'Make a Video'}
          </button>
          <button
            onClick={() => { if (!riverFlyover) setRiverFlyover(true); }}
            disabled={riverFlyover || recording}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5" />
            {riverFlyover ? 'Flying…' : 'Amu Darya Flyover'}
          </button>
          <button
            onClick={() => setShowDataPanel(v => !v)}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {showDataPanel ? 'Hide Data Panel' : 'Show Data Panel'}
          </button>
          <button
            onClick={startNarrative}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guided Tour
          </button>
          <button
            onClick={() => setShowInspector(v => !v)}
            className={`glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${showInspector ? 'text-foreground ring-1 ring-primary/50' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {showInspector ? 'Inspector On' : 'Inspector Off'}
          </button>
          <DamToolPanel
            active={damToolActive}
            onToggle={() => { setDamToolActive(v => !v); setWaterFlowActive(false); setCanalToolActive(false); }}
            onClear={handleResetTerrain}
            brushRadius={raiseBrushRadius}
            onBrushRadiusChange={setRaiseBrushRadius}
            raiseAmount={raiseAmount}
            onRaiseAmountChange={setRaiseAmount}
            editCount={raiseEditCount}
            raiseEnabled={raiseEnabled}
            onToggleRaise={handleToggleRaise}
          />
          <CanalToolPanel
            active={canalToolActive}
            onToggle={() => { setCanalToolActive(v => !v); setDamToolActive(false); setWaterFlowActive(false); }}
            onClear={handleResetCanal}
            brushRadius={canalBrushRadius}
            onBrushRadiusChange={setCanalBrushRadius}
            digDepth={canalDigDepth}
            onDigDepthChange={setCanalDigDepth}
            editCount={canalEditCount}
            digEnabled={canalDigEnabled}
            onToggleDig={handleToggleDig}
          />
          {(show13thBasin || show19thBasin || show21stBasin) && (
            <button
              onClick={handleAutoDigCanals}
              disabled={autoDigging}
              className={`glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${
                autoDigActive
                  ? 'text-foreground bg-primary/10 ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              } disabled:opacity-50`}
            >
              <Waves className="w-3.5 h-3.5" />
              {autoDigging ? 'Digging…' : autoDigActive ? 'Undo Auto-Dig Canals' : 'Auto-Dig Visible Canals'}
            </button>
          )}
          <WaterFlowPanel
            active={waterFlowActive}
            onToggle={() => { setWaterFlowActive(v => !v); setDamToolActive(false); setCanalToolActive(false); }}
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
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
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
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export STL (220mm, x30)
          </button>
        </div>
      )}

      {/* Mobile locate button */}
      {started && !narrativeActive && !canalTourActive && !agmarTourActive && isMobile && (
        <button
          onClick={requestLocation}
          disabled={locating}
          className="absolute top-4 right-4 z-10 glass-panel p-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        </button>
      )}

      {/* Game Mode HUD */}
      {started && gameModeActive && gameModeState && (
        <GameMissionHUD
          currentMission={gameModeState.currentMission}
          completedCount={gameModeState.completedCount}
          totalCount={gameModeState.totalCount}
          rewardMessage={gameModeState.rewardMessage}
          rewardFact={gameModeState.rewardFact}
          
          waterPouringActive={gameModeState.waterPouringActive}
          onShowAllControls={() => setGameModeActive(false)}
        />
      )}

      {/* Timeline Slider - bottom bar (hide in game mode) */}
      {isMapExploration && (
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
