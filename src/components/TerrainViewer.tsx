import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, Suspense, useMemo } from 'react';
import AgmarProposalMarkers from './AgmarProposalMarkers';
import GroundwaterLayer from './GroundwaterLayer';
import SalinityLayer from './SalinityLayer';
import PrecipitationLayer from './PrecipitationLayer';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Html, useGLTF } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import MapboxTerrainMesh from './MapboxTerrainMesh';
import { useTerrainMode } from '@/hooks/useTerrainMode';
import GeoFeatures from './GeoFeatures';
import WaterExtentLayer from './WaterExtentLayer';
import PopulationDensityLayer, { PopData } from './PopulationDensityLayer';
import LandcoverLayer, { LandcoverRasterData } from './LandcoverLayer';
import NarrativeCameraController from './NarrativeCameraController';
import ScenarioOverlay from './ScenarioOverlay';
import WaterFlowOverlay from './WaterFlowOverlay';
import WaterPlaygroundOverlay from './WaterPlaygroundOverlay';
import MigrationLayer from './MigrationLayer';
import ChoroplethLayer from './ChoroplethLayer';
import RiverFlyover from './RiverFlyover';
import MapControls from './MapControls';
import ObjectLibrary3D from './ObjectLibrary3D';
import type { LibraryObject } from './ObjectLibrary3D';
import SchoolsLayer from './SchoolsLayer';
import VocabularyLayer from './VocabularyLayer';
import DwellingsLayer from './DwellingsLayer';
import PlacesLayer from './PlacesLayer';
import GameMode from './GameMode';
import BowlWorld from './BowlWorld';
import AryqWorld from './AryqWorld';
import SandboxOverlay from './SandboxOverlay';
import DustOverlay from './DustOverlay';
import LifeOverlay from './LifeOverlay';
import TerrainStyleOverlay, { TerrainStyle } from './TerrainStyleOverlay';
import WaterwaysLayer from './WaterwaysLayer';
import type { WaterwayTypeFilter } from './WaterwaysLayer';
import type { SandboxSimState } from '@/lib/sandbox-simulation';
import { TerrainData } from '@/lib/geotiff-loader';
import type { ScenarioAction } from '@/types/scenario';
import type { WaterFlowState } from '@/lib/water-flow-simulation';
import * as THREE from 'three';
import { useVisualMode, useDesignerScheme } from '@/lib/visual-mode';

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 18, 8);
const EXPLORE_CAMERA_POSITION = new THREE.Vector3(0, 10, 12);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const EXPLORE_CAMERA_TARGET = new THREE.Vector3(0, 0, -1);
const savedExploreView = {
  position: null as THREE.Vector3 | null,
  target: null as THREE.Vector3 | null,
};
let introFlightPlayed = false;

/* ── Scene background + fog reactive to mirage/dark/designer mode ── */
function SceneBackground() {
  const [mode] = useVisualMode();
  const [scheme] = useDesignerScheme();
  const isMirage = mode === 'mirage' || mode === 'designer';
  const bg = mode === 'designer' ? scheme.background : (isMirage ? '#faf8f4' : '#0d1117');
  const near = isMirage ? 28 : 20;
  const far = isMirage ? 80 : 50;
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, near, far]} />
    </>
  );
}

export interface TerrainViewerHandle {
  screenshot: () => void;
  recordVideo: () => void;
  startCanvasRecording: () => void;
  stopCanvasRecording: () => void;
}

interface MetricItem {
  name: string;
  value: number;
  unit: string;
  color: string;
}

interface TerrainViewerProps {
  terrain: TerrainData;
  exaggeration: number;
  waterLevel: number;
  showBorders: boolean;
  showRivers: boolean;
  show13thBasin: boolean;
  show19thBasin: boolean;
  show21stBasin: boolean;
  showLakes: boolean;
  show21cLakes?: boolean;
  showWaterExtent: boolean;
  waterExtentYear: number;
  showPopDensity?: boolean;
  popHexSize?: number;
  popHexHeight?: number;
  hideNoData?: boolean;
  waterBounds?: import('@/lib/geotiff-loader').GeoBounds | null;
  
  started: boolean;
  onWaterLevelChange?: (level: number) => void;
  recording?: boolean;
  onRecordingDone?: () => void;
  scenarioActions?: ScenarioAction[];
  currentMetrics?: MetricItem[];
  narrativeActive?: boolean;
  narrativeCameraPosition?: [number, number, number];
  narrativeCameraTarget?: [number, number, number];
  riverFlyover?: boolean;
  onRiverFlyoverDone?: () => void;
  riverInflow?: number;
  userLocation?: { lat: number; lon: number } | null;
  inspectorEnabled?: boolean;
  damToolActive?: boolean;
  onDamPlace?: (row: number, col: number) => void;
  canalToolActive?: boolean;
  onCanalDig?: (row: number, col: number) => void;
  waterFlowActive?: boolean;
  onWaterFlowClick?: (row: number, col: number) => void;
  flowState?: WaterFlowState | null;
  flowRenderKey?: number;
  terrainVersion?: number;
  raisedPixels?: Set<number>;
  dugPixels?: Set<number>;
  showMigration?: boolean;
  migrationYear?: number;
  showChoropleth?: boolean;
  choroplethIndicator?: string;
  choroplethExaggeration?: number;
  canalHighlights?: { canal: string; lat: number; lon: number; ethnicity: string; color: string }[];
  highlightedCanalNames?: Set<string>;
  canalTourActive?: boolean;
  showObjectLibrary?: boolean;
  onObjectSelect?: (obj: LibraryObject) => void;
  gameModeActive?: boolean;
  gameCharacter?: import('@/components/CharacterSelect').CharacterDef | null;
  onGameAddWater?: (row: number, col: number) => void;
  bowlWorldActive?: boolean;
  onBowlWorldComplete?: () => void;
  showLandcover?: boolean;
  landcoverVisibleClasses?: Set<number>;
  onLandcoverAvailableClasses?: (classes: number[]) => void;
  showSchools?: boolean;
  showVocabulary?: boolean;
  showDwellings?: boolean;
  showPlaces?: boolean;
  agmarShowProposalSites?: boolean;
  aryqWorldActive?: boolean;
  onAryqWorldComplete?: () => void;
  onNukusClick?: () => void;
  showOverlayMetrics?: boolean;
  showGroundwater?: boolean;
  showPrecipitation?: boolean;
  showSalinity?: boolean;
  waterPlaygroundActive?: boolean;
  sandboxActive?: boolean;
  sandboxSimState?: SandboxSimState | null;
  sandboxRenderKey?: number;
  sandboxToolActive?: boolean;
  onSandboxClick?: (row: number, col: number) => void;
  dustActive?: boolean;
  dustState?: import('@/lib/dust-simulation').DustState | null;
  dustRenderKey?: number;
  dustToolActive?: boolean;
  onDustClick?: (row: number, col: number) => void;
  showWaterways?: boolean;
  waterwayTypeFilter?: WaterwayTypeFilter;
  waterwayTraceMode?: boolean;
  waterwayClearTraceSignal?: number;
  terrainStyle?: TerrainStyle;
  contourInterval?: number;
  vectorInterval?: number;
  hideTerrainSurface?: boolean;
  lifeActive?: boolean;
}

/* ── Canvas Recorder (captures WebGL canvas stream, no camera animation) ── */
function CanvasRecorder({ onReady }: { onReady: (controls: { start: () => void; stop: () => void }) => void }) {
  const { gl } = useThree();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    onReady({
      start: () => {
        chunks.current = [];
        const stream = gl.domElement.captureStream(30);
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 8_000_000,
        });
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.download = `aral-recording-${Date.now()}.webm`;
          a.href = url;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start();
        mediaRecorder.current = recorder;
      },
      stop: () => {
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
          mediaRecorder.current.stop();
        }
        mediaRecorder.current = null;
      },
    });
  }, [gl, onReady]);

  return null;
}

function CameraAnimator({ started, skip, orbitRef }: { started: boolean; skip?: boolean; orbitRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const animating = useRef(false);
  const hasStarted = useRef(false);
  const autoRotateAngle = useRef(0);
  const [autoRotate, setAutoRotate] = useState(false);

  const start = DEFAULT_CAMERA_POSITION;
  const end = EXPLORE_CAMERA_POSITION;
  const startTarget = DEFAULT_CAMERA_TARGET;
  const endTarget = EXPLORE_CAMERA_TARGET;

  useEffect(() => {
    const handler = (e: Event) => {
      setAutoRotate((e as CustomEvent).detail.active);
    };
    window.addEventListener('intro-auto-rotate', handler);
    return () => window.removeEventListener('intro-auto-rotate', handler);
  }, []);

  useEffect(() => {
    if (started && savedExploreView.position && savedExploreView.target) {
      camera.position.copy(savedExploreView.position);
      camera.lookAt(savedExploreView.target);
      if (orbitRef.current) orbitRef.current.target.copy(savedExploreView.target);
      return;
    }
    if (!started) {
      camera.position.copy(start);
      camera.lookAt(startTarget);
    }
  }, []);

  useEffect(() => {
    const shouldSkipIntro = skip || introFlightPlayed || window.location.search.includes('started=1');
    if (started && !hasStarted.current && !shouldSkipIntro) {
      hasStarted.current = true;
      introFlightPlayed = true;
      animating.current = true;
      progress.current = 0;
    }
    if (started && shouldSkipIntro && !hasStarted.current) {
      hasStarted.current = true;
      const position = savedExploreView.position ?? end;
      const target = savedExploreView.target ?? endTarget;
      const applyView = () => {
        camera.position.copy(position);
        camera.lookAt(target);
        if (orbitRef.current) {
          orbitRef.current.target.copy(target);
          orbitRef.current.update?.();
        }
      };
      if (savedExploreView.position && savedExploreView.target) {
        applyView();
      } else {
        savedExploreView.position = end.clone();
        savedExploreView.target = endTarget.clone();
        applyView();
        requestAnimationFrame(applyView);
      }
    }
  }, [started, skip, camera, orbitRef]);

  useFrame((_, delta) => {
    if (autoRotate && !started) {
      autoRotateAngle.current += delta * 0.08;
      const radius = 20;
      camera.position.set(
        Math.sin(autoRotateAngle.current) * radius,
        18,
        Math.cos(autoRotateAngle.current) * radius
      );
      camera.lookAt(0, 0, 0);
      return;
    }
    if (!animating.current) return;
    progress.current = Math.min(progress.current + delta * 0.15, 1);
    const t = 1 - Math.pow(1 - progress.current, 3);
    camera.position.lerpVectors(start, end, t);
    const target = new THREE.Vector3().lerpVectors(startTarget, endTarget, t);
    camera.lookAt(target);
    if (orbitRef.current) orbitRef.current.target.copy(target);
    if (progress.current >= 1) {
      animating.current = false;
      savedExploreView.position = camera.position.clone();
      savedExploreView.target = target.clone();
    }
  });

  return null;
}

function ExploreViewMemory({ started, orbitRef, disabled }: { started: boolean; orbitRef: React.MutableRefObject<any>; disabled?: boolean }) {
  const { camera } = useThree();
  const restored = useRef(false);

  useFrame(() => {
    if (!started || disabled) return;
    if (!restored.current && savedExploreView.position && savedExploreView.target && orbitRef.current) {
      camera.position.copy(savedExploreView.position);
      orbitRef.current.target.copy(savedExploreView.target);
      camera.lookAt(savedExploreView.target);
      orbitRef.current.update?.();
      restored.current = true;
    }
    savedExploreView.position = camera.position.clone();
    savedExploreView.target = orbitRef.current?.target?.clone?.() ?? savedExploreView.target ?? EXPLORE_CAMERA_TARGET.clone();
  });

  return null;
}

function ScreenshotHelper({ onReady }: { onReady: (fn: () => void) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'aral-sea-terrain.png';
      link.href = dataUrl;
      link.click();
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function VideoAnimator({
  recording,
  onWaterLevelChange,
  onDone,
}: {
  recording: boolean;
  onWaterLevelChange: (level: number) => void;
  onDone: () => void;
}) {
  const { camera, gl } = useThree();
  const progress = useRef(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const active = useRef(false);

  // Total animation: phase1 = camera flyover (0-0.5), phase2 = water level + rotate (0.5-1.0)
  const totalDuration = 12; // seconds

  const flyStart = new THREE.Vector3(18, 16, 18);
  const flyEnd = new THREE.Vector3(0, 10, 12);
  const flyTargetStart = new THREE.Vector3(0, 0, 0);
  const flyTargetEnd = new THREE.Vector3(0, 0, -1);

  useEffect(() => {
    if (recording && !active.current) {
      active.current = true;
      progress.current = 0;
      chunks.current = [];

      // Reset camera
      camera.position.copy(flyStart);
      camera.lookAt(flyTargetStart);

      // Start recording
      const stream = gl.domElement.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'aral-sea-flyover.webm';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        active.current = false;
        onDone();
      };
      recorder.start();
      mediaRecorder.current = recorder;
    }
  }, [recording]);

  useFrame((_, delta) => {
    if (!active.current) return;

    progress.current += delta / totalDuration;
    const p = Math.min(progress.current, 1);

    if (p <= 0.5) {
      // Phase 1: Camera flyover (0 -> 0.5 maps to 0 -> 1)
      const t = p / 0.5;
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(flyStart, flyEnd, eased);
      const target = new THREE.Vector3().lerpVectors(flyTargetStart, flyTargetEnd, eased);
      camera.lookAt(target);
    } else {
      // Phase 2: Water level 44 -> 29 + camera orbit
      const t = (p - 0.5) / 0.5;
      const eased = 1 - Math.pow(1 - t, 2);

      // Water level interpolation
      const wl = 44 - (44 - 29) * eased;
      onWaterLevelChange(Math.round(wl));

      // Gentle orbit around the terrain
      const angle = t * Math.PI * 0.6;
      const radius = 12;
      const height = 10 - t * 2;
      camera.position.set(
        Math.sin(angle) * radius,
        height,
        Math.cos(angle) * radius
      );
      camera.lookAt(0, 0, -1);
    }

    if (p >= 1) {
      mediaRecorder.current?.stop();
    }
  });

  return null;
}

/* ── Noah's Ark in the middle of the Aral Sea ──────────────── */
function NoahsArk({ terrain, exaggeration, waterLevel }: { terrain: TerrainData; exaggeration: number; waterLevel: number }) {
  const { scene } = useGLTF('/models/noahs-arc.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);

  const position = useMemo(() => {
    const bounds = terrain.bounds;
    if (!bounds) return [0, 0, 0] as [number, number, number];
    const lat = 44.87, lon = 59.87;
    const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
    const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    const meshW = 10, meshH = 10 * (terrain.height / terrain.width);
    const x = (nx - 0.5) * meshW;
    const z = -(ny - 0.5) * meshH;
    // Place on top of water surface
    const elevRange = terrain.maxElevation - terrain.minElevation || 1;
    const maxH = 10 * (exaggeration / 100);
    const waterY = ((waterLevel - terrain.minElevation) / elevRange) * maxH;
    return [x, waterY + 0.05, z] as [number, number, number];
  }, [terrain, exaggeration, waterLevel]);

  return (
    <primitive object={cloned} position={position} scale={3} rotation={[0, Math.PI / 4, 0]} />
  );
}

const TerrainViewer = forwardRef<TerrainViewerHandle, TerrainViewerProps>(({ terrain, exaggeration, waterLevel, showBorders, showRivers, show13thBasin, show19thBasin, show21stBasin, showLakes, show21cLakes, showWaterExtent, waterExtentYear, showPopDensity, popHexSize, popHexHeight, hideNoData, waterBounds, started, onWaterLevelChange, recording, onRecordingDone, scenarioActions, currentMetrics, narrativeActive, narrativeCameraPosition, narrativeCameraTarget, riverFlyover, onRiverFlyoverDone, riverInflow, userLocation, inspectorEnabled, damToolActive, onDamPlace, canalToolActive, onCanalDig, waterFlowActive, onWaterFlowClick, flowState, flowRenderKey, terrainVersion, raisedPixels, dugPixels, showMigration, migrationYear, showChoropleth, choroplethIndicator, choroplethExaggeration, canalHighlights, highlightedCanalNames, canalTourActive, showObjectLibrary, onObjectSelect, gameModeActive, gameCharacter, onGameAddWater, bowlWorldActive, onBowlWorldComplete, showLandcover, landcoverVisibleClasses, onLandcoverAvailableClasses, showSchools, showVocabulary, showDwellings, showPlaces, agmarShowProposalSites, aryqWorldActive, onAryqWorldComplete, onNukusClick, showOverlayMetrics, showGroundwater, showPrecipitation, showSalinity, waterPlaygroundActive, sandboxActive, sandboxSimState, sandboxRenderKey, sandboxToolActive, onSandboxClick, dustActive, dustState, dustRenderKey, dustToolActive, onDustClick, showWaterways, waterwayTypeFilter, waterwayTraceMode, waterwayClearTraceSignal, terrainStyle, contourInterval, vectorInterval, hideTerrainSurface, lifeActive }, ref) => {
  const screenshotFn = useRef<(() => void) | null>(null);
  const canvasRecorderControls = useRef<{ start: () => void; stop: () => void } | null>(null);
  const orbitRef = useRef<any>(null);
  const [flyoverAnimating, setFlyoverAnimating] = useState(false);
  const [popData, setPopData] = useState<PopData | null>(null);
  const [lcData, setLcData] = useState<LandcoverRasterData | null>(null);
  const { mode: terrainMode, token: terrainToken } = useTerrainMode();

  const handleCanvasRecorderReady = useCallback((controls: { start: () => void; stop: () => void }) => {
    canvasRecorderControls.current = controls;
  }, []);

  useImperativeHandle(ref, () => ({
    screenshot: () => screenshotFn.current?.(),
    recordVideo: () => {},
    startCanvasRecording: () => canvasRecorderControls.current?.start(),
    stopCanvasRecording: () => canvasRecorderControls.current?.stop(),
  }));

  return (
    <Canvas
      camera={{ position: [0, 18, 8], fov: 50, near: 0.1, far: 1000 }}
      className="w-full h-full"
      gl={{ antialias: true, toneMapping: 3, preserveDrawingBuffer: true }}
    >
      <SceneBackground />

      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#cfe6ff', '#3a3a4a', 0.55]} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.5} color="#8ec8e8" />
      <directionalLight position={[0, 6, -8]} intensity={0.35} color="#ffd9b3" />
      <CanvasRecorder onReady={handleCanvasRecorderReady} />

      {!aryqWorldActive && (
        <>
          <group>
            {!hideTerrainSurface && terrainMode === 'classic' && (
              <TerrainMesh terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} hideNoData={hideNoData} waterBounds={waterBounds} inspectorEnabled={inspectorEnabled} popData={showPopDensity ? popData : null} lcData={showLandcover ? lcData : null} damToolActive={damToolActive} onDamPlace={onDamPlace} canalToolActive={canalToolActive} onCanalDig={onCanalDig} waterFlowActive={waterFlowActive || sandboxToolActive || dustToolActive} onWaterFlowClick={dustToolActive ? onDustClick : (sandboxToolActive ? onSandboxClick : onWaterFlowClick)} terrainVersion={terrainVersion} raisedPixels={raisedPixels} dugPixels={dugPixels} sandboxActive={false} />
            )}
            {!hideTerrainSurface && terrainMode === 'satellite' && terrainToken && (
              <MapboxTerrainMesh terrain={terrain} exaggeration={exaggeration} token={terrainToken} />
            )}
            {terrainStyle && terrainStyle !== 'none' && (
              <TerrainStyleOverlay terrain={terrain} exaggeration={exaggeration} style={terrainStyle} contourInterval={contourInterval} vectorInterval={vectorInterval} />
            )}
            {!sandboxActive && flowState && flowRenderKey !== undefined && (
              <WaterFlowOverlay terrain={terrain} exaggeration={exaggeration} flowState={flowState} renderKey={flowRenderKey} />
            )}
          </group>
          {!sandboxActive && (
            <>
              <GeoFeatures terrain={terrain} exaggeration={exaggeration} showBorders={showBorders} showRivers={showRivers} show13thBasin={show13thBasin} show19thBasin={show19thBasin} show21stBasin={show21stBasin} showLakes={showLakes} show21cLakes={show21cLakes} riverInflow={riverInflow} userLocation={userLocation} canalHighlights={canalHighlights} highlightedCanalNames={highlightedCanalNames} canalTourActive={canalTourActive} onNukusClick={onNukusClick} />
              {showWaterExtent && <WaterExtentLayer terrain={terrain} exaggeration={exaggeration} year={waterExtentYear} />}
              {showPopDensity && <PopulationDensityLayer terrain={terrain} exaggeration={exaggeration} onDataLoaded={setPopData} hexSize={popHexSize} hexHeightExag={popHexHeight} />}
              {showMigration && <MigrationLayer terrain={terrain} exaggeration={exaggeration} year={migrationYear ?? waterExtentYear} />}
              {showChoropleth && <ChoroplethLayer terrain={terrain} exaggeration={exaggeration} year={waterExtentYear} indicatorId={choroplethIndicator} choroplethExaggeration={choroplethExaggeration} />}
              {showLandcover && <LandcoverLayer terrain={terrain} exaggeration={exaggeration} visibleClasses={landcoverVisibleClasses} onDataLoaded={setLcData} onAvailableClasses={onLandcoverAvailableClasses} />}
              {showSchools && <SchoolsLayer terrain={terrain} exaggeration={exaggeration} />}
              {showVocabulary && <VocabularyLayer terrain={terrain} exaggeration={exaggeration} />}
              {showDwellings && <DwellingsLayer terrain={terrain} exaggeration={exaggeration} />}
              {showPlaces && <PlacesLayer terrain={terrain} exaggeration={exaggeration} />}
              {showGroundwater && <GroundwaterLayer terrain={terrain} exaggeration={exaggeration} />}
              {showPrecipitation && <PrecipitationLayer terrain={terrain} exaggeration={exaggeration} />}
              {showSalinity && <SalinityLayer terrain={terrain} exaggeration={exaggeration} />}
              {showWaterways && <WaterwaysLayer terrain={terrain} exaggeration={exaggeration} typeFilter={waterwayTypeFilter || 'all'} traceMode={!!waterwayTraceMode} clearTraceSignal={waterwayClearTraceSignal || 0} />}
              <WaterPlaygroundOverlay terrain={terrain} exaggeration={exaggeration} active={!!waterPlaygroundActive} />
              {waterPlaygroundActive && <NoahsArk terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} />}
            </>
          )}
          {sandboxActive && sandboxSimState && sandboxRenderKey !== undefined && (
            <SandboxOverlay terrain={terrain} exaggeration={exaggeration} simState={sandboxSimState} renderKey={sandboxRenderKey} />
          )}
          {dustActive && dustState && dustRenderKey !== undefined && (
            <DustOverlay terrain={terrain} exaggeration={exaggeration} state={dustState} renderKey={dustRenderKey} />
          )}
          {lifeActive && (
            <LifeOverlay terrain={terrain} exaggeration={exaggeration} waterLevel={waterLevel} waterBounds={waterBounds} active={!!lifeActive} />
          )}
          {!sandboxActive && scenarioActions && scenarioActions.length > 0 && (
            <ScenarioOverlay actions={scenarioActions} terrain={terrain} exaggeration={exaggeration} />
          )}
          {!sandboxActive && showWaterExtent && showOverlayMetrics !== false && (
            <group position={[0, 6, -2]}>
            <Html center distanceFactor={15} style={{ pointerEvents: 'none' }}>
              <div style={{
                textAlign: 'center',
                color: '#ffffff',
                textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                <div style={{ fontSize: '72px', fontWeight: 700, lineHeight: 1 }}>
                  {waterExtentYear}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 400, color: '#8ec8e8', marginTop: '4px' }}>
                  Water Level: {waterLevel} m
                </div>
                {currentMetrics && currentMetrics.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '6px 12px',
                    marginTop: '8px',
                    maxWidth: '400px',
                  }}>
                    {currentMetrics.map(m => (
                      <div key={m.name} style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: m.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {m.name.replace(/\s*\(.*\)/, '')}: <span style={{ color: '#fff', fontWeight: 600 }}>
                          {typeof m.value === 'number' ? (m.value >= 1000 ? m.value.toLocaleString() : m.value) : m.value}
                        </span>{' '}
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>{m.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Html>
            </group>
          )}
          {!sandboxActive && <GameMode terrain={terrain} exaggeration={exaggeration} active={!!gameModeActive} character={gameCharacter} onAddWater={onGameAddWater} orbitRef={orbitRef} />}
          {!sandboxActive && <gridHelper args={[20, 20, '#1a2332', '#1a2332']} position={[0, -0.01, 0]} />}
        </>
      )}

      {bowlWorldActive && onBowlWorldComplete && (
        <Suspense fallback={null}>
          <BowlWorld active={bowlWorldActive} onComplete={onBowlWorldComplete} orbitRef={orbitRef} />
        </Suspense>
      )}

      {aryqWorldActive && onAryqWorldComplete && (
        <Suspense fallback={null}>
          <AryqWorld active={aryqWorldActive} onComplete={onAryqWorldComplete} orbitRef={orbitRef} />
        </Suspense>
      )}

      {!narrativeActive && !flyoverAnimating && !gameModeActive && !aryqWorldActive && <CameraAnimator started={started} skip={sandboxActive} orbitRef={orbitRef} />}
      <ExploreViewMemory started={started} orbitRef={orbitRef} disabled={narrativeActive || flyoverAnimating || gameModeActive || aryqWorldActive || !!riverFlyover || !!recording} />
      {narrativeActive && narrativeCameraPosition && narrativeCameraTarget && (
        <NarrativeCameraController
          active={narrativeActive}
          position={narrativeCameraPosition}
          target={narrativeCameraTarget}
        />
      )}
      <ScreenshotHelper onReady={(fn) => { screenshotFn.current = fn; }} />
      {recording && onWaterLevelChange && onRecordingDone && (
        <VideoAnimator
          recording={recording}
          onWaterLevelChange={onWaterLevelChange}
          onDone={onRecordingDone}
        />
      )}

      {!aryqWorldActive && (
        <RiverFlyover
          recording={!!riverFlyover}
          terrain={terrain}
          exaggeration={exaggeration}
          onDone={onRiverFlyoverDone || (() => {})}
          onAnimatingChange={setFlyoverAnimating}
        />
      )}

      <MapControls
        enabled={!narrativeActive && !flyoverAnimating}
        orbitRef={orbitRef}
        gameModeActive={gameModeActive || aryqWorldActive}
        sandboxActive={sandboxActive}
      />

      {!aryqWorldActive && !sandboxActive && (
        <>
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport labelColor="white" axisHeadScale={0.8} />
          </GizmoHelper>
          {showObjectLibrary && onObjectSelect && (
            <ObjectLibrary3D terrain={terrain} exaggeration={exaggeration} onSelect={onObjectSelect} />
          )}
          {agmarShowProposalSites && (
            <AgmarProposalMarkers terrain={terrain} exaggeration={exaggeration} />
          )}
        </>
      )}
    </Canvas>
  );
});

TerrainViewer.displayName = 'TerrainViewer';

export default TerrainViewer;
