import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { VoxelWorld } from '@/lib/voxel/voxel-world';
import { getColumnHeight, breakTopBlock, placeTopBlock } from '@/lib/voxel/voxel-world';
import type { BlockId } from '@/lib/voxel/block-types';
import { BLOCKS } from '@/lib/voxel/block-types';
import { useGamepad } from '@/hooks/useGamepad';
import { playSfx } from '@/lib/voxel/voxel-audio';
import { dispatchMissionEvent } from '@/hooks/useVoxelMissions';
import { setStatsRaw, getStatsSnapshot } from '@/hooks/useVoxelStats';

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
  const lastGpClick = useRef({ break: false, place: false, jump: false });

  // Spawn at world center, on top of terrain.
  useEffect(() => {
    const i = Math.floor(world.width / 2);
    const j = Math.floor(world.depth / 2);
    const h = getColumnHeight(world, i, j);
    camera.position.set(0.5, h + EYE_HEIGHT + 0.1, 0.5);
    camera.rotation.set(0, 0, 0);
  }, [camera, world]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      // Hotbar select 1-9
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          window.dispatchEvent(new CustomEvent('voxel:hotbar-select', { detail: n - 1 }));
        }
      }
      if (e.code === 'KeyE') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-inventory'));
      }
      if (e.code === 'KeyQ') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-quests'));
      }
      if (e.code === 'KeyB') {
        window.dispatchEvent(new CustomEvent('voxel:toggle-build'));
      }
      if (e.code === 'KeyF') {
        window.dispatchEvent(new CustomEvent('voxel:interact'));
      }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // World ray pick: returns {i, j, hitFromAbove} of the column under crosshair, within REACH.
  const pickColumn = useCallback((): { i: number; j: number; faceY: number } | null => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const halfW = world.width / 2;
    const halfD = world.depth / 2;
    // March step
    const step = 0.25;
    for (let t = 0; t < REACH; t += step) {
      const p = origin.clone().addScaledVector(dir, t);
      const i = Math.floor(p.x + halfW);
      const j = Math.floor(p.z + halfD);
      if (i < 0 || i >= world.width || j < 0 || j >= world.depth) continue;
      const h = getColumnHeight(world, i, j);
      if (h === 0) continue;
      const topY = h; // top surface y
      if (p.y <= topY) return { i, j, faceY: topY };
    }
    return null;
  }, [camera, world]);

  const doBreak = useCallback(() => {
    const hit = pickColumn();
    if (!hit) return;
    const removed = breakTopBlock(world, hit.i, hit.j);
    if (removed && removed !== 'air') {
      onMined(removed);
      dispatchMissionEvent({ type: 'mine', block: removed });
      onWorldMutated();
    }
  }, [pickColumn, world, onMined, onWorldMutated]);

  const doPlace = useCallback(() => {
    const block = getSelectedBlock();
    if (!block) return;
    const hit = pickColumn();
    if (!hit) return;
    // Detect surface block for sapling-on-sand mission
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

  // F = interact (drink/eat)
  useEffect(() => {
    const onInteract = () => {
      // Drink from water column under crosshair
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
      // Otherwise, try to eat flatbread/milk/fish from inventory
      window.dispatchEvent(new CustomEvent('voxel:try-eat'));
    };
    window.addEventListener('voxel:interact', onInteract);
    return () => window.removeEventListener('voxel:interact', onInteract);
  }, [pickColumn, world]);

  // Click handlers (need pointer lock)
  useEffect(() => {
    const canvas = gl.domElement;
    const onClick = (e: MouseEvent) => {
      if (!lockedRef.current) return;
      // Throttle rapid clicks
      const now = performance.now();
      if (now - lastClickTime.current < 80) return;
      lastClickTime.current = now;
      if (e.button === 0) doBreak();
      else if (e.button === 2) doPlace();
    };
    const onContext = (e: Event) => { e.preventDefault(); };
    canvas.addEventListener('mousedown', onClick);
    canvas.addEventListener('contextmenu', onContext);
    return () => {
      canvas.removeEventListener('mousedown', onClick);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, [gl, doBreak, doPlace]);

  // Physics + movement
  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const moveDir = new THREE.Vector3();

  useFrame((_, delta) => {
    const gs = gp.stateRef.current;
    if (!lockedRef.current && !gs.connected) return;
    const dt = Math.min(0.05, delta);

    // Movement input
    moveDir.set(0, 0, 0);
    if (keys.current['KeyW']) moveDir.z -= 1;
    if (keys.current['KeyS']) moveDir.z += 1;
    if (keys.current['KeyA']) moveDir.x -= 1;
    if (keys.current['KeyD']) moveDir.x += 1;

    // Gamepad left stick
    if (gs.connected) {
      moveDir.x += gs.leftStick.x;
      moveDir.z += gs.leftStick.y;
      // Right stick yaw / pitch
      const lookSens = 1.8 * dt;
      camera.rotateY(-gs.rightStick.x * lookSens);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.rotateOnWorldAxis(right, -gs.rightStick.y * lookSens);
    }

    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const sprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || gs.buttons.lb;
    const speed = WALK_SPEED * (sprint ? SPRINT_MULT : 1);

    // Camera-relative basis (XZ plane only)
    camera.getWorldDirection(tmpForward);
    tmpForward.y = 0; tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, new THREE.Vector3(0, 1, 0)).normalize();

    velocity.current.x = (tmpRight.x * moveDir.x + tmpForward.x * -moveDir.z) * speed;
    velocity.current.z = (tmpRight.z * moveDir.x + tmpForward.z * -moveDir.z) * speed;

    // Jump
    const jumpPressed = keys.current['Space'] || gs.buttons.a;
    if (jumpPressed && onGround.current) {
      velocity.current.y = JUMP_V;
      onGround.current = false;
      playSfx('jump');
    }

    // Gravity
    velocity.current.y -= GRAVITY * dt;

    // Tentative new position with per-axis collision + step-up
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

    const STEP_UP = 1.05; // climb a single block automatically
    const curGround = sampleGround(pos.x, pos.z);
    const standing = pos.y - EYE_HEIGHT <= curGround + 0.05;

    // Axis-separated movement so we slide along walls instead of getting stuck
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

    // Stay in bounds
    const margin = 1;
    nx = Math.max(-halfW + margin, Math.min(halfW - margin, nx));
    nz = Math.max(-halfD + margin, Math.min(halfD - margin, nz));

    pos.set(nx, ny, nz);

    // Gamepad button-edge actions
    if (gs.connected) {
      const rtPressed = gs.buttons.rt > 0.5;
      const ltPressed = gs.buttons.lt > 0.5;
      if (rtPressed && !lastGpClick.current.break) doBreak();
      if (ltPressed && !lastGpClick.current.place) doPlace();
      lastGpClick.current.break = rtPressed;
      lastGpClick.current.place = ltPressed;
    }

    // Publish position for minimap / external HUDs
    if (playerRef) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      playerRef.current.x = pos.x;
      playerRef.current.z = pos.z;
      playerRef.current.yaw = -e.y; // canvas Y rotates opposite to world yaw
    }
  });

  return (
    <PointerLockControls
      onLock={() => { lockedRef.current = true; onLockChange?.(true); }}
      onUnlock={() => { lockedRef.current = false; onLockChange?.(false); }}
    />
  );
};

export default VoxelPlayer;
