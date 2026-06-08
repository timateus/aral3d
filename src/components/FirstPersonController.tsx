import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainData } from '@/lib/geotiff-loader';
import { useGamepad } from '@/hooks/useGamepad';
import { firstPersonBridge } from '@/lib/first-person-bridge';
import { cellKey, getItemDef, CUBE_SIZE } from '@/lib/map-builder-items';

interface Props {
  active: boolean;
  terrain: TerrainData;
  exaggeration: number;
  onPositionChange?: (lat: number, lon: number) => void;
  onTriggerChange?: (held: boolean) => void;
  thirdPerson?: boolean;
}

const EYE_HEIGHT = 0.18;
const WALK_SPEED = 2.8;
const SPRINT_MULT = 2.2;
const LOOK_SENS_MOUSE = 0.0025;
const LOOK_SENS_PAD = 1.8;

const FirstPersonController = ({ active, terrain, exaggeration, onPositionChange, onTriggerChange, thirdPerson = false }: Props) => {
  const { camera, gl } = useThree();
  const { stateRef: gpRef } = useGamepad();
  const yaw = useRef(0);
  const pitch = useRef(-0.05);
  const pos = useRef(new THREE.Vector3(0, EYE_HEIGHT, 0));
  const initialized = useRef(false);
  const savedCam = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const prevTrigger = useRef(false);

  const meshWidth = 10;
  const meshHeight = 10 * (terrain.height / terrain.width);

  const sampleHeight = (x: number, z: number) => {
    const nx = x / meshWidth + 0.5;
    const ny = -z / meshHeight + 0.5;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;
    const px = Math.min(terrain.width - 1, Math.max(0, Math.floor(nx * (terrain.width - 1))));
    const py = Math.min(terrain.height - 1, Math.max(0, Math.floor((1 - ny) * (terrain.height - 1))));
    let elev = terrain.elevations[py * terrain.width + px] || terrain.minElevation;
    if (terrain.noDataValue !== null && elev === terrain.noDataValue) elev = terrain.minElevation;
    const range = terrain.maxElevation - terrain.minElevation || 1;
    return ((elev - terrain.minElevation) / range) * (10 * (exaggeration / 100));
  };

  const worldXZToLatLon = (x: number, z: number) => {
    const b = terrain.bounds;
    if (!b) return null;
    const nx = x / meshWidth + 0.5;
    const ny = -z / meshHeight + 0.5;
    const lon = b.minLon + nx * (b.maxLon - b.minLon);
    const lat = b.minLat + ny * (b.maxLat - b.minLat);
    return { lat, lon };
  };

  const latLonToWorldXZ = (lat: number, lon: number) => {
    const b = terrain.bounds;
    if (!b) return null;
    const nx = (lon - b.minLon) / (b.maxLon - b.minLon);
    const ny = (lat - b.minLat) / (b.maxLat - b.minLat);
    return {
      x: (nx - 0.5) * meshWidth,
      z: -((ny - 0.5) * meshHeight),
    };
  };

  useEffect(() => {
    if (!active) return;
    savedCam.current = { p: camera.position.clone(), q: camera.quaternion.clone() };
    if (!initialized.current) {
      pos.current.set(0, 0, 0);
      yaw.current = 0;
      pitch.current = -0.1;
      initialized.current = true;
    }
    return () => {
      if (savedCam.current) {
        camera.position.copy(savedCam.current.p);
        camera.quaternion.copy(savedCam.current.q);
      }
      prevTrigger.current = false;
      firstPersonBridge.player = null;
      firstPersonBridge.school.autoWalk = false;
      onTriggerChange?.(false);
    };
  }, [active, camera, onTriggerChange]);

  useEffect(() => {
    if (!active) return;
    const dn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      keys.current[e.code] = true;
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === 'Space' || e.code === 'KeyX') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      keys.current[e.key.toLowerCase()] = false;
    };
    document.addEventListener('keydown', dn, true);
    document.addEventListener('keyup', up, true);
    return () => {
      document.removeEventListener('keydown', dn, true);
      document.removeEventListener('keyup', up, true);
      keys.current = {};
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const onClick = () => {
      if (!el.isConnected) return;
      if (document.pointerLockElement !== el) {
        try { el.requestPointerLock?.(); } catch {}
      }
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * LOOK_SENS_MOUSE;
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * LOOK_SENS_MOUSE, -1.2, 1.2);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hud], button, a, input, select, textarea')) return;
      if (e.button === 0) keys.current.__mouse = true;
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) keys.current.__mouse = false;
    };
    el.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      if (document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [active, gl]);

  useFrame((_, dt) => {
    if (!active) return;
    const gp = gpRef.current;

    if (gp.connected) {
      const rx = gp.rightStick.x;
      const ry = gp.rightStick.y;
      if (rx || ry) {
        yaw.current -= rx * LOOK_SENS_PAD * dt;
        pitch.current = THREE.MathUtils.clamp(pitch.current - ry * LOOK_SENS_PAD * dt, -1.2, 1.2);
      }
    }
    if (keys.current.ArrowLeft) yaw.current += 1.6 * dt;
    if (keys.current.ArrowRight) yaw.current -= 1.6 * dt;
    if (keys.current.ArrowUp) pitch.current = Math.min(1.2, pitch.current + 1.2 * dt);
    if (keys.current.ArrowDown) pitch.current = Math.max(-1.2, pitch.current - 1.2 * dt);

    let fwd = 0;
    let str = 0;
    if (keys.current.KeyW || keys.current.w) fwd += 1;
    if (keys.current.KeyS || keys.current.s) fwd -= 1;
    if (keys.current.KeyA || keys.current.a) str -= 1;
    if (keys.current.KeyD || keys.current.d) str += 1;
    if (gp.connected) {
      fwd += -gp.leftStick.y;
      str += gp.leftStick.x;
    }

    if (thirdPerson && firstPersonBridge.school.active && firstPersonBridge.school.autoWalk && firstPersonBridge.school.target) {
      const targetWorld = latLonToWorldXZ(firstPersonBridge.school.target.lat, firstPersonBridge.school.target.lon);
      if (targetWorld) {
        const dx = targetWorld.x - pos.current.x;
        const dz = targetWorld.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.18) {
          const desiredYaw = Math.atan2(-dx, -dz);
          let deltaYaw = desiredYaw - yaw.current;
          while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
          while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
          yaw.current += THREE.MathUtils.clamp(deltaYaw, -2.2 * dt, 2.2 * dt);
          fwd = 1;
          str = 0;
        } else {
          firstPersonBridge.school.autoWalk = false;
        }
      }
    }

    const sprint = keys.current.ShiftLeft || keys.current.ShiftRight || keys.current.shift || (gp.connected && gp.buttons.lb);
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);
    if (fwd || str) {
      const mag = Math.min(1, Math.hypot(fwd, str));
      const dirX = -Math.sin(yaw.current) * fwd + Math.cos(yaw.current) * str;
      const dirZ = -Math.cos(yaw.current) * fwd - Math.sin(yaw.current) * str;
      const len = Math.hypot(dirX, dirZ) || 1;
      pos.current.x += (dirX / len) * speed * dt * mag;
      pos.current.z += (dirZ / len) * speed * dt * mag;
    }

    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -meshWidth / 2 + 0.05, meshWidth / 2 - 0.05);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -meshHeight / 2 + 0.05, meshHeight / 2 - 0.05);

    let groundY = sampleHeight(pos.current.x, pos.current.z);
    const ll = worldXZToLatLon(pos.current.x, pos.current.z);
    if (ll) {
      const k = cellKey(ll.lat, ll.lon);
      let blockCount = 0;
      for (const it of firstPersonBridge.placedItems) {
        if (getItemDef(it.type).kind !== 'block') continue;
        if (cellKey(it.lat, it.lon) === k) blockCount++;
      }
      groundY += blockCount * CUBE_SIZE;
      firstPersonBridge.player = ll;
      if (thirdPerson && firstPersonBridge.school.active && firstPersonBridge.school.target) {
        const dx = ll.lon - firstPersonBridge.school.target.lon;
        const dy = ll.lat - firstPersonBridge.school.target.lat;
        if (!firstPersonBridge.school.arrived && Math.hypot(dx, dy) < 0.12) {
          firstPersonBridge.school.arrived = true;
          firstPersonBridge.school.autoWalk = false;
        }
      }
    }
    pos.current.y = groundY + EYE_HEIGHT;

    if (thirdPerson) {
      const camOffsetX = Math.sin(yaw.current) * 0.7;
      const camOffsetZ = Math.cos(yaw.current) * 0.7;
      camera.position.set(pos.current.x + camOffsetX, pos.current.y + 0.42, pos.current.z + camOffsetZ);
      camera.lookAt(pos.current.x, pos.current.y + 0.1, pos.current.z);
    } else {
      camera.position.copy(pos.current);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
      camera.quaternion.copy(quat);
    }

    const aheadDist = thirdPerson ? 0.35 : 0.5;
    const ax = pos.current.x + -Math.sin(yaw.current) * aheadDist;
    const az = pos.current.z + -Math.cos(yaw.current) * aheadDist;
    const aimLL = worldXZToLatLon(ax, az);
    if (aimLL) firstPersonBridge.aim = aimLL;

    if (onPositionChange && ll) onPositionChange(ll.lat, ll.lon);

    const held =
      !!keys.current.__mouse ||
      !!keys.current.KeyX ||
      !!keys.current.x ||
      (gp.connected && (gp.buttons.a || gp.buttons.rt > 0.4));
    if (held !== prevTrigger.current) {
      prevTrigger.current = held;
      onTriggerChange?.(held);
    }
  });

  return null;
};

export default FirstPersonController;
