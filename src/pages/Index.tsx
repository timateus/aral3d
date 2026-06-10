import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadGeoTiff, TerrainData } from '@/lib/geotiff-loader';
import { mergeTerrains, mergeExpandTerrains } from '@/lib/terrain-merger';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import { useMapboxTerrain } from '@/hooks/useMapboxTerrain';
import { getRegionBounds, CENTRAL_ASIA_BOUNDS } from '@/lib/terrain-regions';
import { createFlowState, addWaterAt, stepFlow, WaterFlowState } from '@/lib/water-flow-simulation';
import { digCanalsFromBasins } from '@/lib/canal-auto-dig';
import TerrainViewer, { TerrainViewerHandle } from '@/components/TerrainViewer';
import ControlPanel from '@/components/ControlPanel';
import Legend from '@/components/Legend';
import TimelineSlider from '@/components/TimelineSlider';
import IntroOverlay from '@/components/IntroOverlay';
import FountainsOfNukus from '@/components/FountainsOfNukus';
import SpectralEarthHUD from '@/components/SpectralEarthHUD';
import MinistryHUD from '@/components/MinistryHUD';
import WaterSimHUD from '@/components/WaterSimHUD';
import GeoGuessrHUD from '@/components/GeoGuessrHUD';
import { preloadGeoGuessrImages } from '@/lib/geoguessr-locations';
import SettingsGear from '@/components/SettingsGear';
import LevelIntroSplash from '@/components/LevelIntroSplash';
import MapBuilderHUD from '@/components/MapBuilderHUD';
import SchoolTwelveOverlay from '@/components/SchoolTwelveOverlay';
import LocationNameOverlay from '@/components/LocationNameOverlay';
import SchoolPlaceOverlay from '@/components/SchoolPlaceOverlay';
import FaceCameraBackground from '@/components/FaceCameraBackground';
import FacePhraseLayer from '@/components/FacePhraseLayer';
import { faceModeBridge } from '@/lib/face-mode-bridge';


import { applyRandomSpectralPalette } from '@/lib/visual-mode';
import CharacterSelect from '@/components/CharacterSelect';
import ScenarioChat from '@/components/ScenarioChat';
import WaterVolumeDisplay from '@/components/WaterVolumeDisplay';
import DataPanel, { AralAnnual, SEA_SERIES } from '@/components/DataPanel';
import { Camera, Video, BarChart3, Navigation, MapPin, Loader2, Crosshair, Download, Waves, Gamepad2, Link2, ArrowLeft, Circle, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { exportTerrainSTL } from '@/lib/stl-exporter';
import GameMissionHUD from '@/components/GameMissionHUD';
import { isWaterwaysCached } from '@/components/WaterwaysLayer';
import { isLandcoverCached } from '@/components/LandcoverLayer';
import { isChoroplethCached } from '@/components/ChoroplethLayer';
import { isPopDensityCached } from '@/components/PopulationDensityLayer';
import type { GameModeState } from '@/components/GameMode';
import type { ScenarioAction } from '@/types/scenario';
import { NARRATIVE_STEPS } from '@/lib/narrative-steps';
import { CANAL_TOUR_STEPS, getEthnicityColor } from '@/lib/canal-tour-steps';
import { AGMAR_TOUR_STEPS } from '@/lib/agmar-tour-steps';
import NarrativeOverlay from '@/components/NarrativeOverlay';
import ReadingOverlay from '@/components/ReadingOverlay';
import { READING_PASSAGES } from '@/lib/reading-passages';
import CanalTourOverlay from '@/components/CanalTourOverlay';
import AgmarTourOverlay from '@/components/AgmarTourOverlay';
import QuadrantView from '@/components/QuadrantView';
import SoapBubblesOverlay from '@/components/SoapBubblesOverlay';
import DamToolPanel from '@/components/DamToolPanel';
import CanalToolPanel from '@/components/CanalToolPanel';
import WaterFlowPanel from '@/components/WaterFlowPanel';
import { BookOpen } from 'lucide-react';
import { SandboxHUD } from '@/components/SandboxHUD';
import type { SandboxElement } from '@/lib/sandbox-simulation';
import { createSandboxSim, addElementAt, stepSandboxSim, countActivePixels } from '@/lib/sandbox-simulation';
import type { SandboxSimState } from '@/lib/sandbox-simulation';
import * as dustModule from '@/lib/dust-simulation';
import { DustHUD } from '@/components/DustHUD';
import LifeHUD from '@/components/LifeHUD';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useGamepad } from '@/hooks/useGamepad';
import { firstPersonBridge } from '@/lib/first-person-bridge';
import { loadState, saveState } from '@/lib/game-persistence';

function GamepadIndicator({ btnBase }: { btnBase: string }) {
  const { connected, padId } = useGamepad();
  if (!connected) return null;
  return (
    <div
      title={padId ? `Controller: ${padId}` : 'Controller connected'}
      className={`${btnBase} text-primary border-primary/40 bg-primary/10 cursor-default`}
    >
      <Gamepad2 className="w-3 h-3" />
      <span className="hidden sm:inline">Controller</span>
    </div>
  );
}
import MirageToggle from '@/components/MirageToggle';
import DesignerPanel from '@/components/DesignerPanel';
import { useVisualMode } from '@/lib/visual-mode';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

export type DataSource = 'regional' | 'seabed' | 'merged';

const Index = () => {
  const isMobile = useIsMobile();
  const { location: userLocation, loading: locating, requestLocation } = useUserLocation();
  const [baseTerrain, setBaseTerrain] = useState<TerrainData | null>(null);
  const [visualMode, setVisualMode] = useVisualMode();
  const [sidePanelHidden, setSidePanelHidden] = useState(false);
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
  const [showKhorezm, setShowKhorezm] = useState(true);
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
  const [showDwellings, setShowDwellings] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const [showGroundwater, setShowGroundwater] = useState(false);
  const [showPrecipitation, setShowPrecipitation] = useState(false);
  const [showSalinity, setShowSalinity] = useState(false);
  const [showWaterways, setShowWaterways] = useState(false);
  const [waterwayTypeFilter, setWaterwayTypeFilter] = useState<'all' | 'canal' | 'river' | 'stream' | 'drain' | 'ditch' | 'dam'>('all');
  const [waterExtentYear, setWaterExtentYear] = useState(1960);
  const [loadingLayers, setLoadingLayers] = useState<Set<string>>(new Set());
  
  const markLayerLoading = useCallback((layer: string) => {
    setLoadingLayers(prev => { const n = new Set(prev); n.add(layer); return n; });
  }, []);
  const markLayerReady = useCallback((layer: string) => {
    setLoadingLayers(prev => { const n = new Set(prev); n.delete(layer); return n; });
  }, []);

  // Track loading state for heavy layers
  // Preload satellite reference images so Level 4 (GeoGuessr) never shows a blank.
  useEffect(() => { preloadGeoGuessrImages(); }, []);

  useEffect(() => {
    const checks: { show: boolean; layer: string; isCached: () => boolean }[] = [
      { show: showWaterways, layer: 'waterways', isCached: isWaterwaysCached },
      { show: showLandcover, layer: 'landcover', isCached: isLandcoverCached },
      { show: showChoropleth, layer: 'choropleth', isCached: isChoroplethCached },
      { show: showPopDensity, layer: 'popDensity', isCached: isPopDensityCached },
    ];
    
    const pending: string[] = [];
    for (const c of checks) {
      if (c.show && !c.isCached()) {
        markLayerLoading(c.layer);
        pending.push(c.layer);
      } else {
        markLayerReady(c.layer);
      }
    }
    
    if (pending.length === 0) return;
    
    // Poll until caches are ready
    const interval = setInterval(() => {
      let allDone = true;
      for (const c of checks) {
        if (c.show && c.isCached()) {
          markLayerReady(c.layer);
        } else if (c.show && !c.isCached()) {
          allDone = false;
        }
      }
      if (allDone) clearInterval(interval);
    }, 200);
    
    return () => clearInterval(interval);
  }, [showWaterways, showLandcover, showChoropleth, showPopDensity, markLayerLoading, markLayerReady]);
  
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [riverFlyover, setRiverFlyover] = useState(false);
  const [scenarioActions, setScenarioActions] = useState<ScenarioAction[]>([]);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [dataPanelExpanded, setDataPanelExpanded] = useState(false);
  const [narrativeActive, setNarrativeActive] = useState(false);
  const [readingActive, setReadingActive] = useState(false);
  const [readingStep, setReadingStep] = useState(0);
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
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  const [gameCharacter, setGameCharacter] = useState<import('@/components/CharacterSelect').CharacterDef | null>(null);
  const [gameModeState, setGameModeState] = useState<GameModeState | null>(null);
  const [bowlWorldActive, setBowlWorldActive] = useState(false);
  const [aryqWorldActive, setAryqWorldActive] = useState(false);
  const [fountainsMode, setFountainsMode] = useState(false);
  const [spectralMode, setSpectralMode] = useState(false);
  const [ministryMode, setMinistryMode] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const [geoMode, setGeoMode] = useState(false);
  const [geoMarkers, setGeoMarkers] = useState<import('@/components/GeoFeatures').GeoGuessrMarkerSet | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [schoolMode, setSchoolMode] = useState(false);
  const [faceMode, setFaceMode] = useState(false);
  const [placedItems, setPlacedItems] = useState<import('@/lib/map-builder-items').PlacedItem[]>(
    () => loadState<import('@/lib/map-builder-items').PlacedItem[]>('placed-items', [])
  );
  useEffect(() => { saveState('placed-items', placedItems); }, [placedItems]);
  const [schoolAutoWalking, setSchoolAutoWalking] = useState(false);
  const [schoolDistanceMeters, setSchoolDistanceMeters] = useState(0);
  const [schoolArrived, setSchoolArrived] = useState(false);
  const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
  const [simCompleted, setSimCompleted] = useState(false);
  const prevPlaceRef = useRef(false);
  const prevSchoolRef = useRef(false);

  const [levelIntro, setLevelIntro] = useState<{ n: number; name: string; instructions: string[] } | null>(null);
  const ministryPrevVisualRef = useRef<import('@/lib/visual-mode').VisualMode>('dark');
  const [spectralCamPos, setSpectralCamPos] = useState<[number, number, number]>([0, 14, 14]);
  const [spectralCamTarget, setSpectralCamTarget] = useState<[number, number, number]>([0, 0, 0]);
  const [spectralSeed, setSpectralSeed] = useState<number>(() => Date.now());
  const spectralPrevModeRef = useRef<import('@/lib/visual-mode').VisualMode>('dark');
  const spectralPrevExaggerationRef = useRef<number>(10);

  // Ministry (Level 2): user-controlled camera via OrbitControls — no auto-orbit.

  // Level intro splash — rising-edge triggers on entering each level.
  const prevSpectralRef = useRef(false);
  const prevMinistryRef = useRef(false);
  const prevSimRef = useRef(false);
  const prevGeoRef = useRef(false);
  useEffect(() => {
    if (spectralMode && !faceMode && !prevSpectralRef.current) {
      setLevelIntro({
        n: 1,
        name: 'Choose your character',
        instructions: [
          'All maps are wrong, but some are useful',
        ],
      });
    }
    prevSpectralRef.current = spectralMode;
  }, [spectralMode, faceMode]);
  useEffect(() => { faceModeBridge.active = faceMode; }, [faceMode]);
  const prevFaceRef = useRef(false);
  useEffect(() => {
    if (faceMode && !prevFaceRef.current) {
      setLevelIntro({
        n: 7,
        name: 'Aral looks back at me',
        instructions: [],
      });
    }
    prevFaceRef.current = faceMode;
  }, [faceMode]);
  useEffect(() => {
    if (ministryMode && !prevMinistryRef.current) {
      setLevelIntro({
        n: 2,
        name: 'Great Water Level',
        instructions: [
          'Travel to the future with the slider.',
          'Drain the sea below -4m to unlock the next level.',
        ],
      });
    }
    prevMinistryRef.current = ministryMode;
  }, [ministryMode]);
  useEffect(() => {
    if (simMode && !prevSimRef.current) {
      setLevelIntro({
        n: 3,
        name: 'follow the slope of the terrain',
        instructions: [],
      });
    }
    prevSimRef.current = simMode;
  }, [simMode]);
  useEffect(() => {
    if (geoMode && !prevGeoRef.current) {
      setLevelIntro({
        n: 4,
        name: 'Satellite GeoGuessr',
        instructions: ['Where was this photo taken?'],
      });
    }
    prevGeoRef.current = geoMode;
  }, [geoMode]);
  useEffect(() => {
    if (placeMode && !prevPlaceRef.current) {
      setLevelIntro({
        n: 5,
        name: "Let's play some minecraft?",
        instructions: [
          "Remember that everything has it's limits.",
        ],
      });
    }
    prevPlaceRef.current = placeMode;
  }, [placeMode]);
  useEffect(() => {
    if (schoolMode && !prevSchoolRef.current) {
      setLevelIntro({
        n: 6,
        name: 'Kegeyli School 12',
        instructions: [
          'You are guided to School 12 in Kegeyli.',
          'Walk with WASD or use auto-walk. A student is waiting at the door.',
        ],
      });
    }
    prevSchoolRef.current = schoolMode;
  }, [schoolMode]);

  // Poll bridge for school distance/arrival while in school mode.
  useEffect(() => {
    if (!schoolMode) return;
    let prevX = false;
    const interval = window.setInterval(() => {
      const p = firstPersonBridge.player;
      const t = firstPersonBridge.school.target;
      if (p && t) {
        const R = 6371000;
        const dLat = (t.lat - p.lat) * Math.PI / 180;
        const dLon = (t.lon - p.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(p.lat * Math.PI / 180) * Math.cos(t.lat * Math.PI / 180) *
          Math.sin(dLon / 2) ** 2;
        const meters = 2 * R * Math.asin(Math.sqrt(a));
        setSchoolDistanceMeters(meters);
      }
      if (firstPersonBridge.school.arrived) setSchoolArrived(true);
      // Gamepad X (or keyboard X) opens the student dialog once arrived.
      const pads = navigator.getGamepads?.() || [];
      let xDown = false;
      for (const pad of pads) {
        if (pad && pad.buttons[2]?.pressed) { xDown = true; break; }
      }
      if (xDown && !prevX && firstPersonBridge.school.arrived && !firstPersonBridge.school.dialogOpen) {
        firstPersonBridge.school.dialogOpen = true;
        setSchoolDialogOpen(true);
      }
      prevX = xDown;
    }, 120);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'x' || e.key === 'X') && firstPersonBridge.school.arrived && !firstPersonBridge.school.dialogOpen) {
        firstPersonBridge.school.dialogOpen = true;
        setSchoolDialogOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', onKey);
    };
  }, [schoolMode]);



  // One-shot randomizer for Spectral Earth — palette, exaggeration, camera, zoom, typography.
  const randomizeSpectral = useCallback(() => {
    applyRandomSpectralPalette();
    setExaggeration(Math.round(5 + Math.random() * 8));
    const angle = Math.random() * Math.PI * 2;
    const radius = 11 + Math.random() * 10;
    const tilt = 7 + Math.random() * 8;
    setSpectralCamPos([
      Math.sin(angle) * radius,
      tilt,
      Math.cos(angle) * radius,
    ]);
    setSpectralCamTarget([
      (Math.random() - 0.5) * 3,
      0,
      (Math.random() - 0.5) * 3,
    ]);
    setSpectralSeed(Date.now() + Math.floor(Math.random() * 1e6));
  }, []);

  const [quadrantViewActive, setQuadrantViewActive] = useState(false);
  const [bodiesOfWaterMode, setBodiesOfWaterMode] = useState(false);
  const [bodiesActiveLayer, setBodiesActiveLayer] = useState<'none' | 'mortality' | 'landcover' | 'sewage'>('none');
  const [agMarMode, setAgMarMode] = useState(false);
  const [agMarActiveLayer, setAgMarActiveLayer] = useState<'none' | 'population' | 'groundwater'>('none');
  const [soapOperaMode, setSoapOperaMode] = useState(false);
  const [soapActiveLayer, setSoapActiveLayer] = useState<'none' | 'salinity' | 'soap'>('none');
  const [showSoapBubbles, setShowSoapBubbles] = useState(false);
  const [canalMode, setCanalMode] = useState(false);
  const [canalActiveLayer, setCanalActiveLayer] = useState<'none' | 'playground'>('none');
  const [showWaterPlayground, setShowWaterPlayground] = useState(false);
  const [traceMode, setTraceMode] = useState(false);
  const [traceClearSignal, setTraceClearSignal] = useState(0);
  const [agmarTourActive, setAgmarTourActive] = useState(false);
  const [agmarTourStep, setAgmarTourStep] = useState(0);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [lifeMode, setLifeMode] = useState(false);
  const [lifeInExplore, setLifeInExplore] = useState(false);
  const [sandboxElement, setSandboxElement] = useState<SandboxElement>('water');
  const [sandboxBrushSize, setSandboxBrushSize] = useState(3);
  const [sandboxPaused, setSandboxPaused] = useState(false);
  const [sandboxSpeed, setSandboxSpeed] = useState(5);
  const [sandboxAmount, setSandboxAmount] = useState(10);
  const sandboxSimRef = useRef<SandboxSimState | null>(null);
  const [sandboxRenderKey, setSandboxRenderKey] = useState(0);
  const [sandboxActivePixels, setSandboxActivePixels] = useState(0);
  const sandboxAnimRef = useRef<number | null>(null);

  // --- Dust storm state ---
  const [dustMode, setDustMode] = useState(false);
  const [dustPaused, setDustPaused] = useState(false);
  const [dustWindDir, setDustWindDir] = useState(Math.PI * 0.85); // NW->SE-ish
  const [dustWindSpeed, setDustWindSpeed] = useState(1.4);
  const [dustTurbulence, setDustTurbulence] = useState(0.35);
  const [dustParticleLife, setDustParticleLife] = useState(6);
  const [dustSpawnRate, setDustSpawnRate] = useState(100);
  const [dustRenderKey, setDustRenderKey] = useState(0);
  const [dustParticleCount, setDustParticleCount] = useState(0);
  const [dustEmitterCount, setDustEmitterCount] = useState(0);
  const dustStateRef = useRef<import('@/lib/dust-simulation').DustState | null>(null);
  const dustAnimRef = useRef<number | null>(null);
  const dustLastTimeRef = useRef<number>(0);
  
  const [flowState, setFlowState] = useState<WaterFlowState | null>(null);
  const [flowRenderKey, setFlowRenderKey] = useState(0);
  const [flowAnimating, setFlowAnimating] = useState(false);
  const [flowSpeed, setFlowSpeed] = useState(5);
  const [flowWaterAmount, setFlowWaterAmount] = useState(5);
  const [flowWetCount, setFlowWetCount] = useState(0);
  const flowStateRef = useRef<WaterFlowState | null>(null);
  const flowAnimRef = useRef<number | null>(null);
  const viewerRef = useRef<TerrainViewerHandle>(null);
  const [terrainStyle, setTerrainStyle] = useState<'none' | 'contours' | 'vectors'>('none');
  const [contourInterval, setContourInterval] = useState<number>(25);
  const [vectorInterval, setVectorInterval] = useState<number>(50);
  const [hideTerrainSurface, setHideTerrainSurface] = useState<boolean>(false);
  // Start at Aral city (Aralsk) — the historic Aral Sea port — so the
  // avatar walks the length of the dried basin down to the school.
  const schoolStart = useMemo(() => ({ lat: 46.7833, lon: 61.6667 }), []);
  const schoolTarget = useMemo(() => ({ lat: 42.7574883, lon: 59.5618668 }), []);

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

  // Reading mode — Sebald-mode scroll-driven literary overlay over the live map.
  // Reuses NARRATIVE_STEPS for camera + year + layers; passages map onto step indices.
  const handleReadingStepChange = useCallback((newReadingStep: number) => {
    setReadingStep(newReadingStep);
    const passage = READING_PASSAGES[newReadingStep];
    if (!passage) return;
    handleNarrativeStepChange(passage.stepIndex);
  }, [handleNarrativeStepChange]);

  const startReading = useCallback(() => {
    setStarted(true);
    setReadingActive(true);
    setReadingStep(0);
    handleNarrativeStepChange(READING_PASSAGES[0].stepIndex);
  }, [handleNarrativeStepChange]);

  const exitReading = useCallback(() => {
    setReadingActive(false);
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

  const { mode: terrainMode, setMode: setTerrainMode, token: terrainToken, region: terrainRegion, setRegion: setTerrainRegion, customBounds: terrainCustomBounds, setCustomBounds: setTerrainCustomBounds, baseStyle: terrainBaseStyle } = useTerrainMode();
  const satelliteEnabled = terrainMode === 'satellite' && (terrainBaseStyle === 'osm' || !!terrainToken);
  const satelliteBounds = useMemo(
    () => {
      if (!satelliteEnabled) return null;
      // In game mode, preload the full Central Asia bbox so the character can
      // roam freely without on-demand tile fetches. Outside game mode, use the
      // user-selected region.
      if (gameModeActive) {
        return CENTRAL_ASIA_BOUNDS;
      }
      return getRegionBounds(terrainRegion, terrainCustomBounds);
    },
    [satelliteEnabled, terrainRegion, terrainCustomBounds, gameModeActive]
  );
  const { terrain: mapboxTerrain, loading: mapboxLoading, error: mapboxError } = useMapboxTerrain(
    satelliteBounds, terrainToken, satelliteEnabled
  );

  // South-Khorezm extension: load a Mapbox DEM tile that extends the classic
  // GeoTIFF terrain south past Urgench/Khiva so the surface map reaches them.
  const southKhorezmBounds = useMemo(
    () => (!satelliteEnabled && showKhorezm
      ? { minLon: 59.0, maxLon: 62.8, minLat: 40.3, maxLat: 42.6 }
      : null),
    [satelliteEnabled, showKhorezm],
  );
  const { terrain: southKhorezmTerrain } = useMapboxTerrain(
    southKhorezmBounds, terrainToken, !!southKhorezmBounds && !!terrainToken,
  );

  const { terrain, hideNoData } = useMemo(() => {
    if (satelliteEnabled) {
      return { terrain: mapboxTerrain, hideNoData: false };
    }
    if (!baseTerrain) return { terrain: null, hideNoData: false };
    let result = baseTerrain;
    if (seabedTerrain) result = mergeTerrains(result, seabedTerrain);
    let expanded = false;
    if (showKhorezm && khorezmTerrain) {
      result = mergeExpandTerrains(result, khorezmTerrain, false);
      expanded = true;
    }
    if (showKhorezm && southKhorezmTerrain) {
      result = mergeExpandTerrains(result, southKhorezmTerrain, false);
      expanded = true;
    }
    if (showWatershed && watershedTerrain) {
      result = mergeExpandTerrains(result, watershedTerrain, false);
      expanded = true;
    }
    return { terrain: result, hideNoData: expanded };
  }, [satelliteEnabled, mapboxTerrain, baseTerrain, seabedTerrain, khorezmTerrain, southKhorezmTerrain, showKhorezm, watershedTerrain, showWatershed]);

  const simLifeThreshold = useMemo(
    () => terrain ? Math.max(21000, Math.round(terrain.width * terrain.height * 0.09)) : 21000,
    [terrain],
  );

  const updateHydraulicProgress = useCallback((count: number) => {
    if (count >= simLifeThreshold) {
      setSimCompleted(true);
      setFlowWetCount(simLifeThreshold);
      return;
    }
    setFlowWetCount((prev) => simCompleted ? Math.max(prev, simLifeThreshold) : count);
  }, [simCompleted, simLifeThreshold]);

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

  // Level 7 (Face) — ☝ index-up gesture asks Index to flip a layer on, then
  // off when released. Save previous values so the user's other toggles
  // aren't permanently overwritten.
  useEffect(() => {
    const prev: Record<string, boolean> = {};
    const setters: Record<string, [boolean, (v: boolean) => void]> = {
      salinity:    [showSalinity,    setShowSalinity],
      landcover:   [showLandcover,   setShowLandcover],
      waterways:   [showWaterways,   setShowWaterways],
      schools:     [showSchools,     setShowSchools],
      groundwater: [showGroundwater, setShowGroundwater],
      popDensity:  [showPopDensity,  setShowPopDensity],
      choropleth:  [showChoropleth,  setShowChoropleth],
      migration:   [showMigration,   setShowMigration],
      basin13:     [show13thBasin,   setShow13thBasin],
      basin19:     [show19thBasin,   setShow19thBasin],
    };
    const handler = (e: Event) => {
      const { key, active } = (e as CustomEvent).detail || {};
      const entry = setters[key];
      if (!entry) return;
      const [curr, setter] = entry;
      if (active) {
        prev[key] = curr;
        setter(true);
      } else if (key in prev) {
        setter(prev[key]);
        delete prev[key];
      }
    };
    window.addEventListener('face:layer', handler);
    return () => window.removeEventListener('face:layer', handler);
    // setters are stable; only re-bind when current values change (so prev is fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSalinity, showLandcover, showWaterways, showSchools, showGroundwater,
      showPopDensity, showChoropleth, showMigration, show13thBasin, show19thBasin]);


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
    updateHydraulicProgress(count);
  }, [terrain, flowWaterAmount, updateHydraulicProgress]);

  const doFlowStep = useCallback(() => {
    const state = flowStateRef.current;
    if (!state) return;
    for (let i = 0; i < 4; i++) stepFlow(state);
    setFlowState(state);
    setFlowRenderKey(k => k + 1);
    let count = 0;
    for (let i = 0; i < state.waterDepth.length; i++) {
      if (state.waterDepth[i] > 0.01) count++;
    }
    updateHydraulicProgress(count);
  }, [updateHydraulicProgress]);

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

  // --- Sandbox simulation ---
  const handleSandboxClick = useCallback((row: number, col: number) => {
    if (!terrain) return;
    if (!sandboxSimRef.current) {
      sandboxSimRef.current = createSandboxSim(terrain);
    }
    addElementAt(sandboxSimRef.current, row, col, sandboxElement, sandboxAmount, sandboxBrushSize);
    setSandboxRenderKey(k => k + 1);
    setSandboxActivePixels(countActivePixels(sandboxSimRef.current));
    // Start animation if not running
    if (!sandboxAnimRef.current && !sandboxPaused) {
      startSandboxAnim();
    }
  }, [terrain, sandboxElement, sandboxBrushSize, sandboxPaused]);

  const startSandboxAnim = useCallback(() => {
    if (sandboxAnimRef.current) return;
    let lastTime = 0;
    const tick = (time: number) => {
      const interval = 1000 / (sandboxSpeed * 3);
      if (time - lastTime >= interval) {
        lastTime = time;
        if (sandboxSimRef.current && !sandboxPaused) {
          const stepsPerFrame = Math.max(1, Math.floor(sandboxSpeed / 5));
          for (let s = 0; s < stepsPerFrame; s++) {
            stepSandboxSim(sandboxSimRef.current);
          }
          setSandboxRenderKey(k => k + 1);
          setSandboxActivePixels(countActivePixels(sandboxSimRef.current));
        }
      }
      sandboxAnimRef.current = requestAnimationFrame(tick);
    };
    sandboxAnimRef.current = requestAnimationFrame(tick);
  }, [sandboxSpeed, sandboxPaused]);

  const handleSandboxReset = useCallback(() => {
    if (sandboxAnimRef.current) { cancelAnimationFrame(sandboxAnimRef.current); sandboxAnimRef.current = null; }
    if (terrain) sandboxSimRef.current = createSandboxSim(terrain);
    setSandboxRenderKey(k => k + 1);
    setSandboxActivePixels(0);
  }, [terrain]);

  // Start/stop sandbox animation
  useEffect(() => {
    if (sandboxMode && !sandboxPaused && sandboxSimRef.current) {
      startSandboxAnim();
    } else if (sandboxPaused && sandboxAnimRef.current) {
      cancelAnimationFrame(sandboxAnimRef.current);
      sandboxAnimRef.current = null;
    }
    return () => {
      if (sandboxAnimRef.current) { cancelAnimationFrame(sandboxAnimRef.current); sandboxAnimRef.current = null; }
    };
  }, [sandboxMode, sandboxPaused, startSandboxAnim]);

  // Initialize sandbox sim when entering sandbox mode
  useEffect(() => {
    if (sandboxMode && terrain && !sandboxSimRef.current) {
      sandboxSimRef.current = createSandboxSim(terrain);
    }
  }, [sandboxMode, terrain]);

  // --- Dust storm handlers ---
  const ensureDustState = useCallback(() => {
    if (!dustStateRef.current) {
      // dynamic import would split out — use sync import via top-level
      // (createDustState is imported lazily through helper below)
      const mod = dustModule;
      dustStateRef.current = mod.createDustState({
        windDir: dustWindDir,
        windSpeed: dustWindSpeed,
        turbulence: dustTurbulence,
        particleLife: dustParticleLife,
        spawnRate: dustSpawnRate,
      });
    }
    return dustStateRef.current!;
  }, [dustWindDir, dustWindSpeed, dustTurbulence, dustParticleLife, dustSpawnRate]);

  const handleDustClick = useCallback((row: number, col: number) => {
    if (!terrain) return;
    const state = ensureDustState();
    dustModule.addEmitter(state, terrain, row, col, 0.5, 80);
    setDustEmitterCount(state.emitters.length);
    setDustRenderKey(k => k + 1);
  }, [terrain, ensureDustState]);

  const handleDustSeedAralkum = useCallback(() => {
    if (!terrain) return;
    const state = ensureDustState();
    dustModule.autoSeedAralkum(state, terrain, 53, 14, 25);
    setDustEmitterCount(state.emitters.length);
    setDustRenderKey(k => k + 1);
  }, [terrain, ensureDustState]);

  const handleDustClearEmitters = useCallback(() => {
    if (dustStateRef.current) {
      dustModule.clearEmitters(dustStateRef.current);
      setDustEmitterCount(0);
    }
  }, []);

  const handleDustReset = useCallback(() => {
    if (dustStateRef.current) {
      dustModule.clearDust(dustStateRef.current);
      setDustParticleCount(0);
      setDustRenderKey(k => k + 1);
    }
  }, []);

  // Sync HUD params -> live state
  useEffect(() => {
    if (!dustStateRef.current) return;
    dustStateRef.current.windDir = dustWindDir;
    dustStateRef.current.windSpeed = dustWindSpeed;
    dustStateRef.current.turbulence = dustTurbulence;
    dustStateRef.current.particleLife = dustParticleLife;
    dustStateRef.current.spawnRate = dustSpawnRate;
  }, [dustWindDir, dustWindSpeed, dustTurbulence, dustParticleLife, dustSpawnRate]);

  // Animation loop
  useEffect(() => {
    if (!dustMode || !terrain) return;
    ensureDustState();
    let cancelled = false;
    dustLastTimeRef.current = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.05, (now - dustLastTimeRef.current) / 1000);
      dustLastTimeRef.current = now;
      if (!dustPaused && dustStateRef.current) {
        dustModule.stepDust(dustStateRef.current, terrain, dt);
        setDustRenderKey(k => k + 1);
        setDustParticleCount(dustStateRef.current.count);
      }
      dustAnimRef.current = requestAnimationFrame(tick);
    };
    dustAnimRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (dustAnimRef.current) cancelAnimationFrame(dustAnimRef.current);
      dustAnimRef.current = null;
    };
  }, [dustMode, dustPaused, terrain, ensureDustState]);


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

  // ─── URL State Sync ───
  // Read URL params on mount
  const urlInitRef = useRef(false);
  useEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    const p = new URLSearchParams(window.location.search);
    if (p.get('started') === '1') setStarted(true);
    if (p.get('mode') === 'game') { setGameModeActive(true); setStarted(true); }
    if (p.get('mode') === 'sandbox') { setSandboxMode(true); setStarted(true); }
    if (p.get('mode') === 'life') { setLifeMode(true); setStarted(true); }
    if (p.get('year')) setWaterExtentYear(Number(p.get('year')));
    if (p.get('exag')) setExaggeration(Number(p.get('exag')));
    if (p.get('wl')) { setWaterLevelManual(true); setWaterLevel(Number(p.get('wl'))); }
    if (p.get('waterway')) setWaterwayTypeFilter(p.get('waterway') as any);
    if (p.get('layers')) {
      const layers = p.get('layers')!.split(',');
      const has = (k: string) => layers.includes(k);
      setShowBorders(has('borders'));
      setShowRivers(has('rivers'));
      // Khorezm DEM extends terrain south to Khiva — keep it on by default
      // even when older shared links don't include it in the layers list.
      setShowKhorezm(true);
      setShowWaterways(has('waterways'));
      setShowSchools(has('schools'));
      setShowVocabulary(has('vocabulary'));
      setShowDwellings(has('dwellings'));
      // Places (cities/villages) default ON; treat absence as "show" for older links.
      setShowPlaces(layers.includes('noplaces') ? false : true);
      setShowGroundwater(has('groundwater'));
      setShowPrecipitation(has('precipitation'));
      setShowLandcover(has('landcover'));
      setShowPopDensity(has('popDensity'));
      setShowMigration(has('migration'));
      setShowChoropleth(has('choropleth'));
      setShowSalinity(has('salinity'));
      setShowWaterExtent(has('waterExtent'));
      setShow13thBasin(has('13basin'));
      setShow19thBasin(has('19basin'));
      setShow21stBasin(has('21basin'));
    }
  }, []);

  const buildShareUrl = useCallback(() => {
      const p = new URLSearchParams();
      if (started) p.set('started', '1');
      if (gameModeActive) p.set('mode', 'game');
      else if (sandboxMode) p.set('mode', 'sandbox');
      else if (lifeMode) p.set('mode', 'life');
      p.set('year', String(waterExtentYear));
      p.set('exag', String(exaggeration));
      p.set('wl', String(waterLevel));
      if (waterwayTypeFilter !== 'all') p.set('waterway', waterwayTypeFilter);
      const layers: string[] = [];
      if (showBorders) layers.push('borders');
      if (showRivers) layers.push('rivers');
      if (showKhorezm) layers.push('khorezm');
      if (showWaterways) layers.push('waterways');
      if (showSchools) layers.push('schools');
      if (showVocabulary) layers.push('vocabulary');
      if (showDwellings) layers.push('dwellings');
      if (showGroundwater) layers.push('groundwater');
      if (showPrecipitation) layers.push('precipitation');
      if (showLandcover) layers.push('landcover');
      if (showPopDensity) layers.push('popDensity');
      if (showMigration) layers.push('migration');
      if (showChoropleth) layers.push('choropleth');
      if (showSalinity) layers.push('salinity');
      if (showWaterExtent) layers.push('waterExtent');
      if (show13thBasin) layers.push('13basin');
      if (show19thBasin) layers.push('19basin');
      if (show21stBasin) layers.push('21basin');
      if (!showPlaces) layers.push('noplaces');
      if (layers.length) p.set('layers', layers.join(','));
      const qs = p.toString();
      return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
  }, [started, gameModeActive, sandboxMode, lifeMode, waterExtentYear, exaggeration, waterLevel,
      showBorders, showRivers, showKhorezm, showWaterways, showSchools, showVocabulary, showDwellings,
      showGroundwater, showPrecipitation, showLandcover, showPopDensity, showMigration,
      showChoropleth, showSalinity, showWaterExtent, show13thBasin, show19thBasin,
      show21stBasin, showPlaces, waterwayTypeFilter]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(buildShareUrl()).then(() => {
      const el = document.getElementById('copy-link-feedback');
      if (el) { el.textContent = 'Copied!'; setTimeout(() => { el.textContent = ''; }, 1500); }
    });
  }, [buildShareUrl]);

  // Screen recording (canvas-based)
  const [screenRecording, setScreenRecording] = useState(false);

  const toggleScreenRecording = useCallback(() => {
    if (screenRecording) {
      viewerRef.current?.stopCanvasRecording();
      setScreenRecording(false);
      return;
    }
    viewerRef.current?.startCanvasRecording();
    setScreenRecording(true);
  }, [screenRecording]);

  // Keyboard shortcut: R to toggle screen recording
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleScreenRecording();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleScreenRecording]);

  const isMapExploration = started && !gameModeActive && !aryqWorldActive && !bowlWorldActive && !showObjectLibrary && !quadrantViewActive && !bodiesOfWaterMode && !agMarMode && !soapOperaMode && !canalMode && !sandboxMode && !dustMode && !traceMode && !lifeMode && !spectralMode && !ministryMode && !simMode && !geoMode && !placeMode && !schoolMode;

  const enterGameLevel = useCallback((level: number) => {
    setStarted(true);
    // Level 7 reuses Level 1's terrain scene + gamepad controls, but pipes the
    // rendered terrain through the MediaPipe face overlay (FaceProjectionOverlay).
    setSpectralMode(level === 1 || level === 7);
    setFaceMode(level === 7);
    setMinistryMode(level === 2);
    setSimMode(level === 3);
    setGeoMode(level === 4);
    setPlaceMode(level === 5);
    setSchoolMode(level === 6);
    setGeoMarkers(null);
    setShowWaterExtent(false);
    setShowKhorezm(level >= 3 && level <= 6);
    setTerrainMode('classic');
    if (level >= 1 && level <= 7) setVisualMode('designer');
    setWaterFlowActive(level === 3);
    setFlowAnimating(level === 3);
    if (level !== 6) {
      firstPersonBridge.school.active = false;
      firstPersonBridge.school.autoWalk = false;
      firstPersonBridge.school.arrived = false;
      firstPersonBridge.school.dialogOpen = false;
    }
    if (level === 2) {
      setWaterLevelManual(true);
      setWaterLevel(53);
    }
    if (level === 3) {
      setFlowSpeed(20);
      setFlowWaterAmount(20);
      setSimCompleted(false);
      // FLOW level: show Khorezm + the lower Amu Darya basin all the way up to the Aral.
      setTerrainCustomBounds({ minLon: 57.5, maxLon: 75, minLat: 36.5, maxLat: 47.5 });
      setTerrainRegion('custom');
    }
    if (level === 6) {
      // School sits at lat 42.757, lon 59.56 — only fits inside the Khorezm
      // region. Force-switch so the marker and walk surface are valid.
      setTerrainRegion('khorezm');
      firstPersonBridge.school.active = true;
      firstPersonBridge.school.autoWalk = false;
      firstPersonBridge.school.arrived = false;
      firstPersonBridge.school.dialogOpen = false;
      firstPersonBridge.school.target = schoolTarget;
      firstPersonBridge.school.start = schoolStart;
      setSchoolAutoWalking(false);
      setSchoolArrived(false);
      setSchoolDialogOpen(false);
      setSchoolDistanceMeters(0);
    }
  }, [schoolTarget, schoolStart, setTerrainMode, setVisualMode, setTerrainRegion]);

  // Deep-link: ?level=N (1..6) jumps straight into a game level on first mount.
  const didDeepLinkRef = useRef(false);
  useEffect(() => {
    if (didDeepLinkRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const n = parseInt(params.get('level') ?? '', 10);
      if (n >= 1 && n <= 7) {
        didDeepLinkRef.current = true;
        enterGameLevel(n);
        params.delete('level');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      }
    } catch { /* ignore */ }
  }, [enterGameLevel]);



  return (
    <div className={`relative w-screen h-screen overflow-hidden ${faceMode ? '' : 'bg-background'}`}>
      {/* 3D Viewer */}
      <div className="absolute inset-0" style={faceMode ? { zIndex: 10 } : undefined}>
        {terrain && (
          <TerrainViewer
            ref={viewerRef}
            geoGuessrMarkers={geoMode ? geoMarkers : null}
            placedItems={placeMode || schoolMode ? placedItems : null}
            firstPersonMode={placeMode || schoolMode}
            thirdPersonMode={schoolMode}
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
            terrainStyle={terrainStyle}
            contourInterval={contourInterval}
            vectorInterval={vectorInterval}
            hideTerrainSurface={hideTerrainSurface}
            recording={recording}
            hideNoData={hideNoData}
            waterBounds={baseTerrain?.bounds}
            onWaterLevelChange={setWaterLevel}
            onRecordingDone={() => setRecording(false)}
            scenarioActions={scenarioActions}
            currentMetrics={currentMetrics}
            narrativeActive={narrativeActive || readingActive || canalTourActive || agmarTourActive || (spectralMode && !faceMode)}
            narrativeCameraPosition={
              spectralMode && !faceMode ? spectralCamPos :
              readingActive ? NARRATIVE_STEPS[READING_PASSAGES[readingStep]?.stepIndex ?? 0]?.camera.position :
              narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.position :
              canalTourActive ? CANAL_TOUR_STEPS[canalTourStep]?.camera.position :
              agmarTourActive ? AGMAR_TOUR_STEPS[agmarTourStep]?.camera.position :
              undefined
            }
            narrativeCameraTarget={
              spectralMode && !faceMode ? spectralCamTarget :
              readingActive ? NARRATIVE_STEPS[READING_PASSAGES[readingStep]?.stepIndex ?? 0]?.camera.target :
              narrativeActive ? NARRATIVE_STEPS[narrativeStep]?.camera.target :
              canalTourActive ? CANAL_TOUR_STEPS[canalTourStep]?.camera.target :
              agmarTourActive ? AGMAR_TOUR_STEPS[agmarTourStep]?.camera.target :
              undefined
            }
            spectralActive={spectralMode || ministryMode || simMode || geoMode || placeMode || schoolMode || !!levelIntro}
            rightStickCameraEnabled={true}
            riverFlyover={riverFlyover}
            onRiverFlyoverDone={() => setRiverFlyover(false)}
            riverInflow={currentRiverInflow}
            userLocation={schoolMode ? schoolTarget : userLocation}
            showCityMarkers={!levelIntro && !schoolDialogOpen}
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
            gameCharacter={gameCharacter}
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
            // Nukus click no longer triggers aryq world — replaced by Fountains mode in the main menu
            showLandcover={showLandcover}
            landcoverVisibleClasses={landcoverVisibleClasses}
            onLandcoverAvailableClasses={setLandcoverAvailableClasses}
            showSchools={showSchools}
            showVocabulary={showVocabulary}
            showDwellings={showDwellings}
            showPlaces={isMapExploration ? false : showPlaces}
            agmarShowProposalSites={agmarTourActive && !!AGMAR_TOUR_STEPS[agmarTourStep]?.proposalSites}
            showOverlayMetrics={isMapExploration}
            showGroundwater={showGroundwater}
            showPrecipitation={showPrecipitation}
            showSalinity={showSalinity}
            waterPlaygroundActive={showWaterPlayground}
            sandboxActive={sandboxMode}
            sandboxSimState={sandboxSimRef.current}
            sandboxRenderKey={sandboxRenderKey}
            sandboxToolActive={sandboxMode}
            onSandboxClick={handleSandboxClick}
            dustActive={dustMode}
            dustState={dustStateRef.current}
            dustRenderKey={dustRenderKey}
            dustToolActive={dustMode}
            onDustClick={handleDustClick}
            showWaterways={showWaterways}
            waterwayTypeFilter={waterwayTypeFilter}
            waterwayTraceMode={traceMode}
            waterwayClearTraceSignal={traceClearSignal}
            lifeActive={lifeMode || (lifeInExplore && isMapExploration)}
          />
        )}
        {!terrain && !loading && error && (
          <div className="flex items-center justify-center h-full">
            <div className="glass-panel p-6 text-center">
              <p className="text-destructive text-sm font-mono">Error: {error}</p>
            </div>
          </div>
        )}
        {satelliteEnabled && (mapboxLoading || mapboxError) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-3 py-1.5 z-50 pointer-events-none">
            <p className="text-[11px] font-mono text-white/80">
              {mapboxError ? `Mapbox error: ${mapboxError}` : 'Loading Mapbox terrain…'}
            </p>
          </div>
        )}
      </div>

      {/* Intro Overlay */}
      {!started && !loading && terrain && !quadrantViewActive && (
        <IntroOverlay
          onStart={() => { setTerrainMode('satellite'); setStarted(true); }}
          onGuidedTour={startNarrative}
          onReading={startReading}
          onCanalTour={startCanalTour}
          onAgmarTour={startAgmarTour}
          onObjectSelect={(lat, lon, name) => { setStarted(true); }}
          onStartGame={() => {
            setShowCharacterSelect(true);
          }}
          onQuadrants={() => setQuadrantViewActive(true)}
          onSandbox={() => {
            setStarted(true);
            setSandboxMode(true);
            setShowWaterExtent(false);
          }}
          onTraceCanals={() => {
            // Enter Trace mode: show only waterways, hide everything else
            setStarted(true);
            setTraceMode(true);
            setShowWaterways(true);
            setWaterwayTypeFilter('all');
            // Hide other layers for a clean view
            setShowBorders(false);
            setShowRivers(false);
            setShow13thBasin(false);
            setShow19thBasin(false);
            setShow21stBasin(false);
            setShowKhorezm(false);
            setShowLakes(false);
            setShow21cLakes(false);
            setShowWatershed(false);
            setShowLandcover(false);
            setShowPopDensity(false);
            setShowMigration(false);
            setShowChoropleth(false);
            setShowWaterExtent(false);
            setShowSchools(false);
            setShowVocabulary(false);
            setShowDwellings(false);
            setShowGroundwater(false);
            setShowPrecipitation(false);
            setShowSalinity(false);
            setTraceClearSignal(s => s + 1);
          }}
          onDustStorm={() => {
            setStarted(true);
            setDustMode(true);
            setShowWaterExtent(false);
          }}
          onLife={() => {
            setStarted(true);
            setLifeMode(true);
            setShowWaterExtent(false);
          }}
          onFountains={() => setFountainsMode(true)}
          onSpectral={() => {
            spectralPrevModeRef.current = visualMode;
            spectralPrevExaggerationRef.current = exaggeration;
            setStarted(true);
            setSpectralMode(true);
            setShowWaterExtent(false);
            setShowBorders(true);
            setShowRivers(true);
            setShow13thBasin(false);
            setShow19thBasin(false);
            setShow21stBasin(false);
            setShowKhorezm(false);
            setShowLakes(false);
            setShow21cLakes(false);
            setShowLandcover(false);
            setShowPopDensity(false);
            setShowMigration(false);
            setShowChoropleth(false);
            setShowSchools(false);
            setShowVocabulary(false);
            setShowDwellings(false);
            setShowPlaces(false);
            setShowGroundwater(false);
            setShowPrecipitation(false);
            setShowSalinity(false);
            setShowWaterways(false);
            setVisualMode('designer');
            setTerrainMode('classic');
            randomizeSpectral();
          }}
          onMinistry={() => {
            ministryPrevVisualRef.current = visualMode;
            setStarted(true);
            setMinistryMode(true);
            // Keep Spectral Earth colors on the terrain.
            setVisualMode('designer');
            setTerrainMode('classic');
            applyRandomSpectralPalette();
            setShowWaterExtent(false);
            setShowBorders(true);
            setShowRivers(true);
            setShow13thBasin(false);
            setShow19thBasin(false);
            setShow21stBasin(false);
            setShowKhorezm(false);
            setShowLakes(false);
            setShow21cLakes(false);
            setShowLandcover(false);
            setShowPopDensity(false);
            setShowMigration(false);
            setShowChoropleth(false);
            setShowSchools(false);
            setShowVocabulary(false);
            setShowDwellings(false);
            setShowPlaces(false);
            setShowGroundwater(false);
            setShowPrecipitation(false);
            setShowSalinity(false);
            setShowWaterways(false);
            setWaterLevelManual(true);
            setWaterLevel(53);
          }}
        />
      )}

      {fountainsMode && <FountainsOfNukus onClose={() => setFountainsMode(false)} />}

      {spectralMode && !faceMode && (
        <SpectralEarthHUD
          onExit={() => {
            setSpectralMode(false);
            setStarted(false);
            setVisualMode(spectralPrevModeRef.current);
            setExaggeration(spectralPrevExaggerationRef.current);
          }}
          onRandomize={randomizeSpectral}
          randomSeed={spectralSeed}
          onNext={() => {
            // Hand off to Level 2 — keep the current spectral palette + scene.
            ministryPrevVisualRef.current = spectralPrevModeRef.current;
            enterGameLevel(2);
          }}
        />
      )}

      {faceMode && (
        <>
          <FaceCameraBackground />
          <FacePhraseLayer />
          {/* Level 7 HUD — mirrors the other levels' top strip + prev/next pills */}
          <div data-hud className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-md bg-black/60 backdrop-blur-md border border-white/15">
            <span className="text-white/90 font-mono text-[11px] tracking-wider uppercase">Level 7 · Aral looks back at me</span>
          </div>
          <button
            data-hud
            onClick={() => enterGameLevel(6)}
            className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
          >← Prev</button>
          <button
            data-hud
            onClick={() => {
              setFaceMode(false);
              setSpectralMode(false);
              setStarted(false);
              setVisualMode(spectralPrevModeRef.current);
              setExaggeration(spectralPrevExaggerationRef.current);
            }}
            className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-white/90 font-mono text-[11px] hover:bg-black/80"
          >Exit</button>
          <button
            data-hud
            onClick={() => {
              setFaceMode(false);
              setSpectralMode(false);
              setStarted(false);
              setVisualMode(spectralPrevModeRef.current);
              setExaggeration(spectralPrevExaggerationRef.current);
            }}
            aria-label="back to main menu"
            className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center text-white/85 hover:text-white"
            title="Back to Main Menu"
          >
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span className="mt-1 px-2 py-0.5 text-[10px] font-mono border border-white/40 rounded">→ Main menu</span>
          </button>
        </>
      )}

      {ministryMode && (
        <MinistryHUD
          waterLevel={waterLevel}
          onWaterLevelChange={(v) => { setWaterLevelManual(true); setWaterLevel(v); }}
          annualData={annualData}
          onExit={() => {
            setMinistryMode(false);
            setStarted(false);
            setVisualMode(ministryPrevVisualRef.current);
          }}
          onPrev={() => {
            // Back to Level 1 — preserve the spectral session.
            enterGameLevel(1);
          }}
          onNext={() => {
            // Hand off to Level 3 (water simulation sandbox).
            enterGameLevel(3);
          }}
        />
      )}

      {simMode && terrain && (
        <WaterSimHUD
          wetPixels={simCompleted ? Math.max(10500, Math.round(terrain.width * terrain.height * 0.045)) : flowWetCount}
          damEdits={raiseEditCount}
          lifeThreshold={Math.max(10500, Math.round(terrain.width * terrain.height * 0.045))}
          onExit={() => {
            setSimMode(false);
            setStarted(false);
            setWaterFlowActive(false);
            setFlowAnimating(false);
            setVisualMode(ministryPrevVisualRef.current);
          }}
          onPrev={() => {
            // Back to Level 2
            enterGameLevel(2);
          }}
          onAddWaterCenter={() => {
            // Splash a large volume of water exactly where the center aim mark hits.
            const aim = viewerRef.current?.getAimPixel();
            const row = aim?.row ?? Math.floor(terrain.height / 2);
            const col = aim?.col ?? Math.floor(terrain.width / 2);
            let state = flowStateRef.current;
            if (!state) {
              state = createFlowState(terrain);
              flowStateRef.current = state;
            }
            addWaterAt(state, row, col, 50, 6);
            setFlowState(state);
            setFlowRenderKey(k => k + 1);
            setFlowAnimating(true);
            let count = 0;
            for (let i = 0; i < state.waterDepth.length; i++) {
              if (state.waterDepth[i] > 0.01) count++;
            }
            updateHydraulicProgress(count);
          }}
          onBuildDamCenter={() => {
            const aim = viewerRef.current?.getAimPixel();
            const row = aim?.row ?? Math.floor(terrain.height / 2);
            const col = aim?.col ?? Math.floor(terrain.width / 2);
            handleRaiseTerrainClick(row, col);
          }}
          onNext={() => {
            // Hand off to Level 4 (satellite geoguessr).
            enterGameLevel(4);
          }}
        />
      )}

      {geoMode && terrain && (
        <GeoGuessrHUD
          onExit={() => {
            setGeoMode(false);
            setGeoMarkers(null);
            setStarted(false);
            setVisualMode(ministryPrevVisualRef.current);
          }}
          onPrev={() => {
            enterGameLevel(3);
          }}
          onMarkersChange={setGeoMarkers}
          onNext={() => {
            enterGameLevel(5);
          }}
          getAimLatLon={() => {
            const aim = viewerRef.current?.getAimPixel();
            if (!aim || !terrain.bounds) return null;
            const b = terrain.bounds;
            const lon = b.minLon + (aim.col / (terrain.width - 1)) * (b.maxLon - b.minLon);
            const lat = b.minLat + (1 - aim.row / (terrain.height - 1)) * (b.maxLat - b.minLat);
            return { lat, lon };
          }}
          getLatLonAtScreen={(x, y) => {
            const px = viewerRef.current?.getPixelAtScreen(x, y);
            if (!px || !terrain.bounds) return null;
            const b = terrain.bounds;
            const lon = b.minLon + (px.col / (terrain.width - 1)) * (b.maxLon - b.minLon);
            const lat = b.minLat + (1 - px.row / (terrain.height - 1)) * (b.maxLat - b.minLat);
            return { lat, lon };
          }}
        />
      )}

      {placeMode && terrain && (
        <MapBuilderHUD
          onExit={() => {
            setPlaceMode(false);
            // NOTE: do NOT clear placedItems — placed blocks must persist across visits.
            setStarted(false);
            setVisualMode(ministryPrevVisualRef.current);
          }}
          onPrev={() => {
            enterGameLevel(4);
          }}
          onNext={() => {
            enterGameLevel(6);
          }}
          onItemsChange={setPlacedItems}
        />
      )}

      {schoolMode && (
        <SchoolTwelveOverlay
          onExit={() => {
            setSchoolMode(false);
            setStarted(false);
            firstPersonBridge.school.active = false;
          }}
          onPrev={() => enterGameLevel(5)}
          onNext={() => enterGameLevel(7)}
          onToggleAutoWalk={() => {
            const next = !schoolAutoWalking;
            setSchoolAutoWalking(next);
            firstPersonBridge.school.autoWalk = next;
          }}
          autoWalking={schoolAutoWalking}
          distanceMeters={schoolDistanceMeters}
          arrived={schoolArrived}
          dialogOpen={schoolDialogOpen}
          onDialogOpen={(open) => {
            setSchoolDialogOpen(open);
            firstPersonBridge.school.dialogOpen = open;
          }}
        />
      )}
      {schoolMode && <SchoolPlaceOverlay hidden={schoolDialogOpen} />}
      <LocationNameOverlay active={(placeMode || schoolMode) && !schoolDialogOpen} />

      <SettingsGear active={spectralMode || ministryMode || simMode || geoMode || placeMode || schoolMode} />

      {levelIntro && (
        <LevelIntroSplash
          number={levelIntro.n}
          name={levelIntro.name}
          instructions={levelIntro.instructions}
          onBegin={() => setLevelIntro(null)}
          onPrev={levelIntro.n > 1 ? () => enterGameLevel(levelIntro.n - 1) : undefined}
          onNext={levelIntro.n < 7 ? () => enterGameLevel(levelIntro.n + 1) : undefined}
        />
      )}





      {/* Quadrant View */}
      {quadrantViewActive && !started && (
        <QuadrantView
          onSelectQuadrant={(id) => {
            setQuadrantViewActive(false);
            setStarted(true);
            if (id === 'serious-large') {
              setAgMarMode(true);
              setAgMarActiveLayer('none');
              setWaterExtentYear(2024);
              setShowWaterExtent(true);
              setShowPopDensity(false);
              setShowGroundwater(false);
            } else if (id === 'serious-small') {
              setBodiesOfWaterMode(true);
              setBodiesActiveLayer('none');
              setWaterExtentYear(2024);
              setShowChoropleth(false);
              setShowLandcover(false);
            } else if (id === 'playful-large') {
              setCanalMode(true);
              setCanalActiveLayer('none');
              setWaterExtentYear(1960);
              setShowWaterExtent(true);
              setShow21stBasin(true);
              setShowRivers(true);
            } else if (id === 'playful-small') {
              setSoapOperaMode(true);
              setSoapActiveLayer('none');
              setWaterExtentYear(2024);
              setShowWaterExtent(true);
              setShowKhorezm(true);
              setShowSalinity(false);
            } else if (id === 'sandbox') {
              setSandboxMode(true);
            }
          }}
          onBack={() => setQuadrantViewActive(false)}
        />
      )}

      {/* Sandbox HUD */}
      <SandboxHUD
        active={sandboxMode && started}
        selectedElement={sandboxElement}
        onSelectElement={setSandboxElement}
        brushSize={sandboxBrushSize}
        onBrushSize={setSandboxBrushSize}
        amount={sandboxAmount}
        onAmountChange={setSandboxAmount}
        paused={sandboxPaused}
        onTogglePause={() => setSandboxPaused(p => !p)}
        onReset={handleSandboxReset}
        onExit={() => {
          setSandboxMode(false);
          setStarted(false);
          if (sandboxAnimRef.current) { cancelAnimationFrame(sandboxAnimRef.current); sandboxAnimRef.current = null; }
          sandboxSimRef.current = null;
        }}
        activePixels={sandboxActivePixels}
        speed={sandboxSpeed}
        onSpeedChange={setSandboxSpeed}
      />

      {/* Game of Life HUD */}
      <LifeHUD
        active={(lifeMode && started) || (lifeInExplore && isMapExploration)}
        onExit={() => {
          if (lifeInExplore) setLifeInExplore(false);
          else { setLifeMode(false); setStarted(false); }
        }}
      />

      {/* Dust Storm HUD */}
      <DustHUD
        active={dustMode && started}
        windDir={dustWindDir}
        onWindDir={setDustWindDir}
        windSpeed={dustWindSpeed}
        onWindSpeed={setDustWindSpeed}
        turbulence={dustTurbulence}
        onTurbulence={setDustTurbulence}
        particleLife={dustParticleLife}
        onParticleLife={setDustParticleLife}
        spawnRate={dustSpawnRate}
        onSpawnRate={setDustSpawnRate}
        paused={dustPaused}
        onTogglePause={() => setDustPaused(p => !p)}
        onReset={handleDustReset}
        onSeedAralkum={handleDustSeedAralkum}
        onClearEmitters={handleDustClearEmitters}
        onExit={() => {
          setDustMode(false);
          setStarted(false);
          if (dustAnimRef.current) { cancelAnimationFrame(dustAnimRef.current); dustAnimRef.current = null; }
          dustStateRef.current = null;
          setDustParticleCount(0);
          setDustEmitterCount(0);
        }}
        particleCount={dustParticleCount}
        emitterCount={dustEmitterCount}
      />

      {/* Character Selection */}
      {showCharacterSelect && (
        <CharacterSelect
          onSelect={(char) => {
            setGameCharacter(char);
            setShowCharacterSelect(false);
            setStarted(true);
            setGameModeActive(true);
            setWaterExtentYear(2024);
            setFlowSpeed(20);
            setShowWaterExtent(true);
          }}
          onBack={() => setShowCharacterSelect(false)}
        />
      )}

      {narrativeActive && (
        <NarrativeOverlay
          step={narrativeStep}
          onStepChange={handleNarrativeStepChange}
          onExit={exitNarrative}
        />
      )}

      {readingActive && (
        <ReadingOverlay
          step={readingStep}
          onStepChange={handleReadingStepChange}
          onExit={exitReading}
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
        <div className="absolute top-[4.5rem] left-4 z-10 max-h-[calc(100vh-6rem)] overflow-auto">
          <DataPanel
            currentYear={waterExtentYear}
            onClose={() => setShowDataPanel(false)}
            annualData={annualData}
            enabledSeries={enabledSeries}
            onToggleSeries={toggleSeries}
            enabledClimate={enabledClimate}
            onToggleClimate={toggleClimate}
            defaultExpanded={dataPanelExpanded}
          />
        </div>
      )}

      {/* Header */}
      {isMapExploration && (() => {
        const btnBase = "text-[10px] tracking-[0.15em] uppercase border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0";
        return (
          <div className="absolute top-4 left-4 right-4 z-30 h-9 flex items-center gap-2 pointer-events-none">
            {/* Left cluster */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => { setStarted(false); setGameModeActive(false); }}
                className={`${btnBase} text-muted-foreground hover:text-primary`}
              >
                Menu
              </button>
              <MirageToggle />
            </div>

            {/* Center: terrain style segmented */}
            <div className="flex items-center border border-border/50 bg-card/60 backdrop-blur-sm pointer-events-auto shrink-0">
              {([
                { id: 'none', label: 'Surface' },
                { id: 'contours', label: 'Contours' },
                { id: 'vectors', label: 'Vectors' },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTerrainStyle(opt.id)}
                  title={opt.id === 'contours' ? 'Show terrain as elevation contour lines' : opt.id === 'vectors' ? 'Show terrain as gradient vector field' : 'Show terrain surface only'}
                  className={`text-[10px] tracking-[0.15em] uppercase px-2.5 py-1.5 transition-colors ${
                    terrainStyle === opt.id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Actions cluster */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {!gameModeActive && (
                <button
                  onClick={() => setLifeInExplore(v => !v)}
                  title="Conway's Game of Life over the terrain"
                  className={`${btnBase} ${lifeInExplore ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
                >
                  ✦ {lifeInExplore ? 'Life on' : 'Life'}
                </button>
              )}
              {gameModeActive && (
                <button
                  onClick={() => setGameModeActive(false)}
                  className={`${btnBase} text-primary border-primary/40 bg-primary/10`}
                >
                  <Gamepad2 className="w-3 h-3" />
                  Exit Game
                </button>
              )}
            </div>

            {/* Title — hidden on smaller widths */}
            {!gameModeActive && (
              <div className="hidden xl:flex items-center gap-2 mx-2 pointer-events-auto">
                <h1 className="text-lg font-semibold text-foreground tracking-tight">Aral Sea Terrain Viewer</h1>
                <p className="text-xs text-muted-foreground font-mono">aral_region_30m.tif</p>
              </div>
            )}

            {/* Right cluster — pushed to the end */}
            <div className="ml-auto flex items-center gap-2 pointer-events-auto">
              <button
                onClick={handleCopyLink}
                className={`${btnBase} text-muted-foreground hover:text-primary`}
              >
                <Link2 className="w-3 h-3" />
                Copy Link
                <span id="copy-link-feedback" className="text-primary font-bold" />
              </button>
              <GamepadIndicator btnBase={btnBase} />
              <a
                href="/voxel"
                className={`${btnBase} text-emerald-300 border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20`}
                title="Enter Minecraft-like Survive mode"
              >
                <span className="font-bold">▣</span>
                Survive
              </a>
              <button
                onClick={toggleScreenRecording}
                className={`${btnBase} ${screenRecording ? 'text-destructive border-destructive/50 bg-destructive/10 animate-pulse' : 'text-muted-foreground hover:text-primary'}`}
              >
                <Circle className={`w-3 h-3 ${screenRecording ? 'fill-destructive' : ''}`} />
                {screenRecording ? 'Stop (R)' : 'Record (R)'}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="More controls"
                    className={`${btnBase} text-muted-foreground hover:text-primary`}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onSelect={() => setSidePanelHidden(v => !v)}>
                    {sidePanelHidden ? <PanelRightOpen className="w-3 h-3 mr-2" /> : <PanelRightClose className="w-3 h-3 mr-2" />}
                    {sidePanelHidden ? 'Show side panel' : 'Hide side panel'}
                  </DropdownMenuItem>
                  {!gameModeActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setShowCharacterSelect(true)}>
                        <Gamepad2 className="w-3 h-3 mr-2" />
                        Game Mode
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })()}

      {/* Terrain style sub-controls (second row, only when active) */}
      {isMapExploration && terrainStyle !== 'none' && (
        <div className="absolute top-[3.5rem] left-4 right-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          {terrainStyle === 'contours' && (
            <label className="pointer-events-auto flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-muted-foreground border border-border/50 px-2 py-1.5 bg-card/60 backdrop-blur-sm">
              <span>Interval</span>
              <select
                value={contourInterval}
                onChange={(e) => setContourInterval(Number(e.target.value))}
                className="bg-transparent text-foreground outline-none text-[10px]"
              >
                {[5, 10, 25, 50, 100, 200, 500].map(v => (
                  <option key={v} value={v} className="bg-card text-foreground">{v} m</option>
                ))}
              </select>
            </label>
          )}
          {terrainStyle === 'vectors' && (
            <label className="pointer-events-auto flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-muted-foreground border border-border/50 px-2 py-1.5 bg-card/60 backdrop-blur-sm">
              <span>Spacing</span>
              <select
                value={vectorInterval}
                onChange={(e) => setVectorInterval(Number(e.target.value))}
                className="bg-transparent text-foreground outline-none text-[10px]"
              >
                {[10, 25, 50, 100, 200, 500, 1000].map(v => (
                  <option key={v} value={v} className="bg-card text-foreground">{v} m</option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => setHideTerrainSurface(v => !v)}
            className={`pointer-events-auto text-[10px] tracking-[0.15em] uppercase px-2.5 py-1.5 transition-colors border border-border/50 bg-card/60 backdrop-blur-sm ${
              hideTerrainSurface ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            {hideTerrainSurface ? 'Show surface' : 'Hide surface'}
          </button>
        </div>
      )}

      {visualMode === 'designer' && isMapExploration && !isMobile && false && (
        <DesignerPanel onClose={() => setVisualMode('mirage')} />
      )}

      {/* Controls - desktop only, hide in game mode unless toggled */}
      {isMapExploration && !isMobile && !sidePanelHidden && (
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
            showDwellings={showDwellings}
            onToggleDwellings={setShowDwellings}
            showPlaces={showPlaces}
            onTogglePlaces={setShowPlaces}
            showGroundwater={showGroundwater}
            onToggleGroundwater={setShowGroundwater}
            showPrecipitation={showPrecipitation}
            onTogglePrecipitation={setShowPrecipitation}
            showWaterways={showWaterways}
            onToggleWaterways={setShowWaterways}
            waterwayTypeFilter={waterwayTypeFilter}
            onWaterwayTypeFilterChange={setWaterwayTypeFilter}
            loadingLayers={loadingLayers}
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
            onClick={() => { setDataPanelExpanded(false); setShowDataPanel(v => !v); }}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {showDataPanel ? 'Hide Data Panel' : 'Show Data Panel'}
          </button>
          <button
            onClick={() => { setDataPanelExpanded(true); setShowDataPanel(true); }}
            className="glass-panel p-2.5 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Show Data Table
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
      {started && gameModeActive && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => { setStarted(false); setGameModeActive(false); }}
            className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/80 backdrop-blur-sm flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            Menu
          </button>
        </div>
      )}
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
      {isMapExploration && !bodiesOfWaterMode && (
        <TimelineSlider
          year={waterExtentYear}
          onYearChange={setWaterExtentYear}
          visible={showWaterExtent}
          onToggleVisible={setShowWaterExtent}
        />
      )}

      {/* Bodies of Water preset buttons */}
      {bodiesOfWaterMode && started && (
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              setBodiesOfWaterMode(false);
              setShowChoropleth(false);
              setShowLandcover(false);
              setStarted(false);
              setQuadrantViewActive(true);
            }}
            className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm mb-2"
          >
            ← Back to compare
          </button>
          <button
            onClick={() => {
              const next = bodiesActiveLayer === 'mortality' ? 'none' : 'mortality';
              setBodiesActiveLayer(next);
              setShowChoropleth(next === 'mortality');
              setChoroplethIndicator(next === 'mortality' ? 'maternal_mortality' : 'sewage');
              setShowLandcover(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              bodiesActiveLayer === 'mortality'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Mortality
          </button>
          <button
            onClick={() => {
              const next = bodiesActiveLayer === 'landcover' ? 'none' : 'landcover';
              setBodiesActiveLayer(next);
              setShowLandcover(next === 'landcover');
              if (next === 'landcover') {
                setLandcoverVisibleClasses(new Set([16, 17, 18]));
              }
              setShowChoropleth(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              bodiesActiveLayer === 'landcover'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Landcover
          </button>
          <button
            onClick={() => {
              const next = bodiesActiveLayer === 'sewage' ? 'none' : 'sewage';
              setBodiesActiveLayer(next);
              setShowChoropleth(next === 'sewage');
              setChoroplethIndicator(next === 'sewage' ? 'sewage' : 'sewage');
              if (next === 'sewage') setWaterExtentYear(2018);
              setShowLandcover(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              bodiesActiveLayer === 'sewage'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Sewage Coverage
          </button>
        </div>
      )}

      {/* ag MAR preset buttons */}
      {agMarMode && started && (
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              setAgMarMode(false);
              setShowPopDensity(false);
              setShowGroundwater(false);
              setAgMarActiveLayer('none');
              setStarted(false);
              setQuadrantViewActive(true);
            }}
            className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm mb-2"
          >
            ← Back to compare
          </button>
          <button
            onClick={() => {
              const next = agMarActiveLayer === 'population' ? 'none' : 'population';
              setAgMarActiveLayer(next);
              setShowPopDensity(next === 'population');
              if (next === 'population') {
                setPopHexSize(0.01);
                setPopHexHeight(0);
              }
              setShowGroundwater(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              agMarActiveLayer === 'population'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Population
          </button>
          <button
            onClick={() => {
              const next = agMarActiveLayer === 'groundwater' ? 'none' : 'groundwater';
              setAgMarActiveLayer(next);
              setShowGroundwater(next === 'groundwater');
              setShowPopDensity(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              agMarActiveLayer === 'groundwater'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Ground Water
          </button>
        </div>
      )}

      {/* Soap Opera preset buttons */}
      {soapOperaMode && started && (
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              setSoapOperaMode(false);
              setShowSalinity(false);
              setShowSoapBubbles(false);
              setSoapActiveLayer('none');
              setShowKhorezm(false);
              setStarted(false);
              setQuadrantViewActive(true);
            }}
            className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm mb-2"
          >
            ← Back to compare
          </button>
          <button
            onClick={() => {
              const next = soapActiveLayer === 'salinity' ? 'none' : 'salinity';
              setSoapActiveLayer(next);
              setShowSalinity(next === 'salinity');
              if (next === 'salinity') setShowSoapBubbles(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              soapActiveLayer === 'salinity'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            Salinity
          </button>
          <button
            onClick={() => {
              const next = soapActiveLayer === 'soap' ? 'none' : 'soap';
              setSoapActiveLayer(next);
              setShowSoapBubbles(next === 'soap');
              if (next === 'soap') setShowSalinity(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              soapActiveLayer === 'soap'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            🫧 Soap
          </button>
        </div>
      )}

      <SoapBubblesOverlay active={showSoapBubbles} />

      {/* Canal thinking preset buttons */}
      {canalMode && started && (
        <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              setCanalMode(false);
              setShowWaterPlayground(false);
              setCanalActiveLayer('none');
              setShow21stBasin(false);
              setStarted(false);
              setQuadrantViewActive(true);
            }}
            className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm mb-2"
          >
            ← Back to compare
          </button>
          <button
            onClick={() => {
              const next = canalActiveLayer === 'playground' ? 'none' : 'playground';
              setCanalActiveLayer(next);
              setShowWaterPlayground(next === 'playground');
              if (next !== 'playground') setGameModeActive(false);
            }}
            className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all ${
              canalActiveLayer === 'playground'
                ? 'bg-primary/20 border-primary/60 text-primary'
                : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            🏊 Water Playground
          </button>
          {showWaterPlayground && (
            <button
              onClick={() => {
                setGameModeActive(prev => !prev);
                if (!gameModeActive) {
                  setFlowSpeed(20);
                }
              }}
              className={`text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border backdrop-blur-sm transition-all flex items-center gap-1.5 ${
                gameModeActive
                  ? 'bg-primary/20 border-primary/60 text-primary'
                  : 'bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              {gameModeActive ? 'Exit Game' : 'Game Mode'}
            </button>
          )}
        </div>
      )}

      {/* Trace mode HUD */}
      {traceMode && started && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass-panel px-4 py-2">
            <p className="text-xs text-foreground tracking-wide">
              <span className="text-cyan-400 font-semibold">Trace mode</span>
              <span className="text-muted-foreground ml-2">— click any canal to follow the connected water network</span>
            </p>
          </div>
          <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
            <button
              onClick={() => {
                setTraceMode(false);
                setShowWaterways(false);
                setStarted(false);
                setTraceClearSignal(s => s + 1);
              }}
              className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground hover:text-primary transition-colors border border-border/50 px-3 py-1.5 bg-card/60 backdrop-blur-sm"
            >
              ← Menu
            </button>
            <button
              onClick={() => setTraceClearSignal(s => s + 1)}
              className="text-[11px] tracking-[0.08em] uppercase font-mono px-4 py-2 border bg-card/60 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 backdrop-blur-sm transition-all"
            >
              Clear trace
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Index;
