import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ArrowLeft, ChevronRight, Navigation2, ExternalLink, Film } from 'lucide-react';
import { sfx } from '@/lib/ui-sfx';
import { useGamepad } from '@/hooks/useGamepad';
import { consumeGamepadButton } from '@/lib/gamepad-dedupe';

// School 12, Kegeyli — lat 42.748792, lon 59.583295 (for label/narrative only).
const SCHOOL_POS = new THREE.Vector3(0, 0, -40);

interface Props {
  onExit: () => void;
  onPrev?: () => void;
}

interface SceneState {
  npcTriggered: boolean;
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[400, 400, 1, 1]} />
      <meshStandardMaterial color="#c9b486" roughness={1} />
    </mesh>
  );
}

function Path() {
  return (
    <mesh position={[0, 0.01, -20]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.4, 80]} />
      <meshStandardMaterial color="#8a7553" />
    </mesh>
  );
}

function School() {
  return (
    <group position={SCHOOL_POS}>
      {/* main building */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 6, 8]} />
        <meshStandardMaterial color="#e9d9b8" />
      </mesh>
      {/* roof */}
      <mesh position={[0, 6.3, 0]} castShadow>
        <boxGeometry args={[14.6, 0.6, 8.6]} />
        <meshStandardMaterial color="#5b4a39" />
      </mesh>
      {/* door */}
      <mesh position={[0, 1.4, 4.05]}>
        <boxGeometry args={[1.8, 2.8, 0.1]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
      {/* windows */}
      {[-4.5, -2, 2, 4.5].map((x) => (
        <mesh key={x} position={[x, 3.5, 4.05]}>
          <boxGeometry args={[1.4, 1.4, 0.05]} />
          <meshStandardMaterial color="#7ec8e3" emissive="#7ec8e3" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* sign */}
      <mesh position={[0, 7.6, 0]}>
        <boxGeometry args={[10, 1.2, 0.2]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}

function NPC({ position }: { position: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = position.y + Math.sin(s.clock.elapsedTime * 2) * 0.06;
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
        <meshStandardMaterial color="#d97757" />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color="#f1c79a" />
      </mesh>
      {/* ! marker */}
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.18]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 2.42, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Character({
  posRef,
  yawRef,
  autoRef,
  onArrive,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  yawRef: React.MutableRefObject<number>;
  autoRef: React.MutableRefObject<boolean>;
  onArrive: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const { stateRef: gpRef } = useGamepad();
  const keys = useRef<Record<string, boolean>>({});
  const arrived = useRef(false);

  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    document.addEventListener('keydown', d);
    document.addEventListener('keyup', u);
    return () => { document.removeEventListener('keydown', d); document.removeEventListener('keyup', u); };
  }, []);

  useFrame((_, dt) => {
    const gp = gpRef.current;
    const speed = 6;

    // Look turning
    if (keys.current['ArrowLeft']) yawRef.current += 1.8 * dt;
    if (keys.current['ArrowRight']) yawRef.current -= 1.8 * dt;
    if (gp.connected && gp.rightStick.x) yawRef.current -= gp.rightStick.x * 2.2 * dt;

    let fwd = 0, str = 0;
    if (keys.current['KeyW']) fwd += 1;
    if (keys.current['KeyS']) fwd -= 1;
    if (keys.current['KeyA']) str -= 1;
    if (keys.current['KeyD']) str += 1;
    if (gp.connected) {
      fwd += -gp.leftStick.y;
      str += gp.leftStick.x;
    }

    // Auto-walk towards school
    if (autoRef.current && !arrived.current) {
      const target = new THREE.Vector2(SCHOOL_POS.x - posRef.current.x, SCHOOL_POS.z - posRef.current.z);
      const dist = target.length();
      if (dist > 12) {
        const desiredYaw = Math.atan2(-target.x, -target.y);
        let delta = desiredYaw - yawRef.current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        yawRef.current += THREE.MathUtils.clamp(delta, -2 * dt, 2 * dt);
        fwd = 1;
      } else {
        autoRef.current = false;
      }
    }

    if (fwd || str) {
      const mag = Math.min(1, Math.hypot(fwd, str));
      const dirX = -Math.sin(yawRef.current) * fwd + Math.cos(yawRef.current) * str;
      const dirZ = -Math.cos(yawRef.current) * fwd - Math.sin(yawRef.current) * str;
      const len = Math.hypot(dirX, dirZ) || 1;
      posRef.current.x += (dirX / len) * speed * dt * mag;
      posRef.current.z += (dirZ / len) * speed * dt * mag;
    }

    posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -180, 180);
    posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -180, 180);

    if (group.current) {
      group.current.position.copy(posRef.current);
      group.current.rotation.y = yawRef.current;
    }

    // 3rd person camera behind character
    const camOffsetX = Math.sin(yawRef.current) * 6;
    const camOffsetZ = Math.cos(yawRef.current) * 6;
    camera.position.set(posRef.current.x + camOffsetX, posRef.current.y + 4, posRef.current.z + camOffsetZ);
    camera.lookAt(posRef.current.x, posRef.current.y + 1.2, posRef.current.z);

    // Trigger NPC when close to school door
    const distToSchool = Math.hypot(posRef.current.x - SCHOOL_POS.x, posRef.current.z - (SCHOOL_POS.z + 6));
    if (!arrived.current && distToSchool < 4) {
      arrived.current = true;
      onArrive();
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
        <meshStandardMaterial color="#4a90e2" />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color="#f1c79a" />
      </mesh>
      {/* facing indicator */}
      <mesh position={[0, 1.95, -0.36]}>
        <boxGeometry args={[0.12, 0.12, 0.05]} />
        <meshStandardMaterial color="#000" />
      </mesh>
    </group>
  );
}

function DistanceTracker({
  posRef,
  onUpdate,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  onUpdate: (d: number, bearing: number) => void;
}) {
  useFrame(() => {
    const dx = SCHOOL_POS.x - posRef.current.x;
    const dz = SCHOOL_POS.z - posRef.current.z;
    onUpdate(Math.hypot(dx, dz), Math.atan2(dx, dz));
  });
  return null;
}

const SchoolTwelveOverlay = ({ onExit, onPrev }: Props) => {
  const posRef = useRef(new THREE.Vector3(0, 0, 30));
  const yawRef = useRef(Math.PI);
  const autoRef = useRef(false);
  const [dist, setDist] = useState(60);
  const [bearing, setBearing] = useState(0);
  const [npcOpen, setNpcOpen] = useState(false);
  const [autoWalking, setAutoWalking] = useState(false);

  const triggerAuto = () => {
    autoRef.current = !autoRef.current;
    setAutoWalking(autoRef.current);
    sfx.make();
  };

  // Gamepad: Y = auto-walk toggle, B = exit, LB = prev
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p) { pad = p; break; } }
      if (pad) {
        if (consumeGamepadButton('school-y', !!pad.buttons[3]?.pressed)) triggerAuto();
        if (consumeGamepadButton('school-lb', !!pad.buttons[4]?.pressed) && onPrev) { sfx.navPrev(); onPrev(); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onPrev]);

  // Compass arrow rotation (degrees): bearing in world (yaw=0 looks -z, school at -z = bearing 0)
  // Relative to character yaw to point in HUD space
  const compassDeg = ((bearing - yawRef.current) * 180) / Math.PI;

  return (
    <div className="fixed inset-0 z-[80] bg-[#06080e]" data-hud>
      <Canvas shadows camera={{ fov: 60, near: 0.1, far: 500 }} style={{ background: '#dbe7f0' }}>
        <hemisphereLight args={['#ffffff', '#7a6a4a', 0.85]} />
        <directionalLight position={[40, 60, 30]} intensity={1.1} castShadow />
        <fog attach="fog" args={['#dbe7f0', 60, 200]} />
        <Ground />
        <Path />
        <School />
        <NPC position={new THREE.Vector3(SCHOOL_POS.x - 3, 0, SCHOOL_POS.z + 8)} />
        <Character posRef={posRef} yawRef={yawRef} autoRef={autoRef} onArrive={() => { sfx.make(); setNpcOpen(true); }} />
        <DistanceTracker posRef={posRef} onUpdate={(d, b) => { setDist(d); setBearing(b); }} />
      </Canvas>

      {/* Exit + Prev */}
      <div className="absolute top-5 left-5 z-50 flex gap-2">
        <button
          onClick={() => { sfx.exit(); onExit(); }}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/70 border border-white/20 text-white hover:bg-black/90 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> exit
        </button>
        {onPrev && (
          <button
            onClick={() => { sfx.navPrev(); onPrev(); }}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.3em] bg-black/70 border border-white/20 text-white hover:bg-black/90 transition-colors"
          >
            ← prev · LB
          </button>
        )}
      </div>

      {/* Title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 text-center pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">level 6</div>
        <h1 className="text-2xl font-extralight tracking-[0.4em] uppercase text-white/95">
          Kegeyli School 12
        </h1>
        <div className="text-[9px] font-mono text-white/40 mt-1">42.748792°N, 59.583295°E</div>
      </div>

      {/* Compass / arrow + distance */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        <div
          className="w-20 h-20 rounded-full border-2 border-white/40 bg-black/40 backdrop-blur flex items-center justify-center"
          title="direction to school"
        >
          <Navigation2
            className="w-10 h-10 text-amber-300"
            style={{ transform: `rotate(${compassDeg}deg)` }}
          />
        </div>
        <div className="font-mono text-xs text-white/80 bg-black/60 px-2 py-1 border border-white/20">
          {Math.round(dist)} m
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        <button
          onClick={triggerAuto}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-[0.25em] border-2 transition-all ${
            autoWalking
              ? 'bg-amber-400 text-black border-amber-300'
              : 'bg-black/70 text-white border-white/40 hover:bg-black/90'
          }`}
        >
          <Navigation2 className="w-4 h-4" />
          {autoWalking ? 'auto-walking…' : 'auto-walk to school'}
          <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold border border-current rounded">Y</span>
        </button>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 pointer-events-none">
        WASD / left stick · arrows or right stick to look · Y · auto-walk
      </div>

      {/* NPC dialog */}
      {npcOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setNpcOpen(false)}>
          <div
            className="max-w-lg w-full mx-4 bg-[#0c1018] border-2 border-amber-400/60 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-amber-300/80 mb-2">student of school 12</div>
            <h2 className="text-xl text-white font-extralight tracking-wider mb-4">"Salem! What would you like to do?"</h2>
            <div className="space-y-2">
              <a
                href="https://qilqalicity.lovable.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/20 hover:border-amber-400/60 hover:bg-white/10 transition-all group"
              >
                <div>
                  <div className="text-white font-mono text-sm uppercase tracking-wider">Play · Qilqali City</div>
                  <div className="text-[10px] text-white/50 font-mono">qilqalicity.lovable.app</div>
                </div>
                <ExternalLink className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="https://roar-and-guard.lovable.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/20 hover:border-amber-400/60 hover:bg-white/10 transition-all group"
              >
                <div>
                  <div className="text-white font-mono text-sm uppercase tracking-wider">Play · Roar &amp; Guard</div>
                  <div className="text-[10px] text-white/50 font-mono">roar-and-guard.lovable.app</div>
                </div>
                <ExternalLink className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform" />
              </a>
              <button
                disabled
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/10 opacity-50 cursor-not-allowed"
              >
                <div className="text-left">
                  <div className="text-white font-mono text-sm uppercase tracking-wider">Watch the film</div>
                  <div className="text-[10px] text-white/50 font-mono">coming soon</div>
                </div>
                <Film className="w-4 h-4 text-white/40" />
              </button>
            </div>
            <button
              onClick={() => setNpcOpen(false)}
              className="mt-5 w-full text-[10px] font-mono uppercase tracking-[0.3em] text-white/50 hover:text-white py-2"
            >
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolTwelveOverlay;
