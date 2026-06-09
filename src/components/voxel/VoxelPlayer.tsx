import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { getColumnHeight, breakTopBlock, placeTopBlock } from '@/lib/voxel/voxel-world';
import type { BlockId } from '@/lib/voxel/block-types';
import { useGamepad } from '@/hooks/useGamepad';
import { playSfx } from '@/lib/voxel/voxel-audio';
import { dispatchMissionEvent } from '@/hooks/useVoxelMissions';
import { setStatsRaw, getStatsSnapshot } from '@/hooks/useVoxelStats';
import { touchInput, isTouchDevice } from '@/lib/voxel/touch-input';

interface Props {
  world: VoxelWorld;
  onWorldMutated: () => void;
  onMined: (block: BlockId) => void;
  getSelectedBlock: () => BlockId | null;
  consumeSelected: () => BlockId | null;
  onLockChange?: (locked: boolean) => void;
  playerRef?: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
}

const GRAVITY = 22;
const JUMP_V = 8.5;
const WALK_SPEED = 6;
const SPRINT_MULT = 1.6;
const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;
const REACH = 8;

const VoxelPlayer = ({ world, onWorldMutated, onMined, getSelectedBlock, consumeSelected, onLockChange, playerRef }: Props) => {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const onGround = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const lockedRef = useRef(false);
  const lastClickTime = useRef(0);
  const gp = useGamepad();
  const lastGpClick = useRef({ break: false, place: false, inv: false });

  useEffect(() => {
    const i = Math.floor(world.width / 2);
    const j = Math.floor(world.depth / 2);
    const h = getColumnHeight(world, i, j);
    camera.position.set(0.5, h + EYE_HEIGHT + 0.1, 0.5);
    camera.rotation.set(0, 0, 0);
  }, [camera, world]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          window.dispatchEvent(new CustomEvent('voxel:hotbar-select', { detail: n - 1 }));
        }
      }
      if (e.code === 'KeyE') window.dispatchEvent(new CustomEvent('voxel:toggle-inventory'));
      if (e.code === 'KeyQ') window.dispatchEvent(new CustomEvent('voxel:toggle-quests'));
      if (e.code === 'KeyB') window.dispatchEvent(new CustomEvent('voxel:toggle-build'));
      if (e.code === 'KeyF') window.dispatchEvent(new CustomEvent('voxel:interact'));
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const pickColumn = useCallback((): { i: number; j: number; faceY: number } | null => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const step = 0.25;
    for (let t = 0; t < REACH; t += step) {
      const p = origin.clone().addScaledVector(dir, t);
      const i = Math.floor(p.x + halfW);
      const j = Math.floor(p.z + halfD);
      if (i < 0 || i >= world.width || j < 0 || j >= world.depth) continue;
      const h = getColumnHeight(world, i, j);
      if (h === 0) continue;
      const topY = h;
      if (p.y <= topY) return { i, j, faceY: topY };
    }
    return null;
  }, [camera, world]);

  const doBreak = useCallback(() => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const handled = { value: false };
    window.dispatchEvent(new CustomEvent('voxel:left-click', {
      detail: { pos: camera.position.toArray(), dir: dir.toArray(), handled },
    }));
    if (handled.value) return;

    const hit = pickColumn();
    if (!hit) return;
    const removed = breakTopBlock(world, hit.i, hit.j);
    if (removed && removed !== 'air') {
      onMined(removed);
      dispatchMissionEvent({ type: 'mine', block: removed });
      onWorldMutated();
    }
  }, [camera, pickColumn, world, onMined, onWorldMutated]);

  const doPlace = useCallback(() => {
    const block = getSelectedBlock();
    if (!block) return;
    const hit = pickColumn();
    if (!hit) return;
    const surfaceBlock = world.palette[world.cells[(hit.j * world.width + hit.i) * world.maxStackHeight + (world.heights[hit.j * world.width + hit.i] - 1)]];
    const ok = placeTopBlock(world, hit.i, hit.j, block);
    if (ok) {
      consumeSelected();
      dispatchMissionEvent({ type: 'place', block });
      if (block === 'sapling' && (surfaceBlock === 'sand' || surfaceBlock === 'salt')) {
        dispatchMissionEvent({ type: 'plant-sapling' });
        window.dispatchEvent(new CustomEvent('voxel:sapling-planted', { detail: { i: hit.i, j: hit.j } }));
      }
      onWorldMutated();
    }
  }, [pickColumn, world, getSelectedBlock, consumeSelected, onWorldMutated]);

  useEffect(() => {
    const onInteract = () => {
      const hit = pickColumn();
      if (hit) {
        const idx = hit.j * world.width + hit.i;
        const h = world.heights[idx];
        if (h > 0) {
          const top = world.palette[world.cells[idx * world.maxStackHeight + h - 1]];
          if (top === 'water') {
            const s = getStatsSnapshot();
            setStatsRaw({ thirst: s.thirst + 30 });
            dispatchMissionEvent({ type: 'drink' });
            playSfx('drink');
            return;
          }
        }
      }
      window.dispatchEvent(new CustomEvent('voxel:try-eat'));
    };
    window.addEventListener('voxel:interact', onInteract);
    return () => window.removeEventListener('voxel:interact', onInteract);
  }, [pickColumn, world]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (e: MouseEvent) => {
      if (!lockedRef.current) return;
      const now = performance.now();
      if (now - lastClickTime.current < 80) return;
      lastClickTime.current = now;
      if (e.button === 0) doBreak();
      else if (e.button === 2) doPlace();
    };
    const onContext = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('contextmenu', onContext);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, [gl, doBreak, doPlace]);

  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  useFrame((_, delta) => {
    const gs = gp.stateRef.current;
    const touch = touchInput.active;
    if (!lockedRef.current && !gs.connected && !touch) return;
    const dt = Math.min(0.05, delta);

    moveDir.set(0, 0, 0);
    if (keys.current['KeyW']) moveDir.z -= 1;
    if (keys.current['KeyS']) moveDir.z += 1;
    if (keys.current['KeyA']) moveDir.x -= 1;
    if (keys.current['KeyD']) moveDir.x += 1;

    if (gs.connected) {
      moveDir.x += gs.leftStick.x;
      moveDir.z += gs.leftStick.y;
      const lookSens = 1.8 * dt;
      camera.rotateY(-gs.rightStick.x * lookSens);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.rotateOnWorldAxis(right, -gs.rightStick.y * lookSens);
    }

    if (touch) {
      moveDir.x += touchInput.move.x;
      moveDir.z += touchInput.move.y;
      const lookSens = 0.0035;
      if (touchInput.look.x || touchInput.look.y) {
        camera.rotateY(-touchInput.look.x * lookSens);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.rotateOnWorldAxis(right, -touchInput.look.y * lookSens);
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        e.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, e.x));
        camera.quaternion.setFromEuler(e);
        touchInput.look.x = 0; touchInput.look.y = 0;
      }
      if (touchInput.breakQueued) { touchInput.breakQueued = false; doBreak(); }
      if (touchInput.placeQueued) { touchInput.placeQueued = false; doPlace(); }
    }

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const sprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || (gs.connected && gs.buttons.x) || touchInput.sprint;
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);

    camera.getWorldDirection(tmpForward);
    tmpForward.y = 0; tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.x = (tmpRight.x * moveDir.x + tmpForward.x * -moveDir.z) * speed;
    velocity.current.z = (tmpRight.z * moveDir.x + tmpForward.z * -moveDir.z) * speed;

    const jumpPressed = keys.current['Space'] || (gs.connected && gs.buttons.a) || touchInput.jumpQueued;
    if (touchInput.jumpQueued) touchInput.jumpQueued = false;
    if (jumpPressed && onGround.current) {
      velocity.current.y = JUMP_V;
      onGround.current = false;
      playSfx('jump');
    }

    velocity.current.y -= GRAVITY * dt;

    const pos = camera.position;
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    const ground = (x: number, z: number) => {
      const i = Math.floor(x + halfW);
      const j = Math.floor(z + halfD);
      return getColumnHeight(world, i, j);
    };
    const sampleGround = (x: number, z: number) =>
      Math.max(
        ground(x + PLAYER_RADIUS, z + PLAYER_RADIUS),
        ground(x - PLAYER_RADIUS, z + PLAYER_RADIUS),
        ground(x + PLAYER_RADIUS, z - PLAYER_RADIUS),
        ground(x - PLAYER_RADIUS, z - PLAYER_RADIUS),
      );

    const STEP_UP = 1.05;
    const curGround = sampleGround(pos.x, pos.z);
    const standing = pos.y - EYE_HEIGHT <= curGround + 0.05;

    let nx = pos.x + velocity.current.x * dt;
    let nz = pos.z;
    if (standing && sampleGround(nx, nz) - curGround > STEP_UP) nx = pos.x;

    nz = pos.z + velocity.current.z * dt;
    if (standing && sampleGround(nx, nz) - sampleGround(nx, pos.z) > STEP_UP) nz = pos.z;

    let ny = pos.y + velocity.current.y * dt;
    const finalGround = sampleGround(nx, nz);
    if (ny - EYE_HEIGHT < finalGround) {
      ny = finalGround + EYE_HEIGHT;
      if (velocity.current.y < 0) velocity.current.y = 0;
      onGround.current = true;
    } else if (ny - EYE_HEIGHT > finalGround + 0.02) {
      onGround.current = false;
    }

    const margin = 1;
    nx = Math.max(-halfW + margin, Math.min(halfW - margin, nx));
    nz = Math.max(-halfD + margin, Math.min(halfD - margin, nz));

    pos.set(nx, ny, nz);

    // Gamepad: RB = break, LB = place, Y = toggle inventory, A = jump (handled above).
    if (gs.connected) {
      const breakPressed = !!gs.buttons.rb;
      const placePressed = !!gs.buttons.lb;
      const invPressed = !!gs.buttons.y;
      if (breakPressed && !lastGpClick.current.break) doBreak();
      if (placePressed && !lastGpClick.current.place) doPlace();
      if (invPressed && !lastGpClick.current.inv) window.dispatchEvent(new CustomEvent('voxel:toggle-inventory'));
      lastGpClick.current.break = breakPressed;
      lastGpClick.current.place = placePressed;
      lastGpClick.current.inv = invPressed;
    }

    if (playerRef) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      playerRef.current.x = pos.x;
      playerRef.current.z = pos.z;
      playerRef.current.yaw = -e.y;
    }
  });

  useEffect(() => {
    if (isTouchDevice()) {
      lockedRef.current = true;
      onLockChange?.(true);
    }
  }, [onLockChange]);

  if (isTouchDevice()) return null;

  return (
    <PointerLockControls
      onLock={() => { lockedRef.current = true; onLockChange?.(true); }}
      onUnlock={() => { lockedRef.current = false; onLockChange?.(false); }}
    />
  );
};

export default VoxelPlayer;
