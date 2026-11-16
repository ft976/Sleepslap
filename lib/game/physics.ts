import type { FlyerEntity, FlyerHeadKey, Point2D } from './types';

export const MAX_AIM_ANGLE_DEG = 35;
export const BASE_FLYER_SPEED_PX = 205;
export const SPEED_STEP_PER_3_POINTS = 36;
export const MAX_FLYER_SPEED_PX = 480;
export const KNOCKOUT_DURATION_MS = 250;
export const RESPAWN_DELAY_MS = 300;
export const MICRO_SHAKE_DURATION_MS = 120;
export const MICRO_SHAKE_AMPLITUDE_PX = 4;
export const BEST_SCORE_STORAGE_KEY = 'sleep_slap_best_score';

export const BGM_VOLUME = 0.38;
export const BGM_MIN_GAP_MS = 2000;
export const BGM_MAX_GAP_MS = 4000;

/**
 * Computes a random gap between 2000ms and 4000ms (2-4 seconds) between background tracks.
 */
export function computeBgmGapMs(randomFactor = Math.random()): number {
  const clamped = Math.max(0, Math.min(1, randomFactor));
  return Math.round(BGM_MIN_GAP_MS + clamped * (BGM_MAX_GAP_MS - BGM_MIN_GAP_MS));
}

/**
 * Picks the next random BGM index from the playlist, ensuring no back-to-back repeats if >1 track.
 */
export function pickNextBgmIndex(
  currentIndex: number,
  totalTracks: number,
  randomFactor = Math.random()
): number {
  if (totalTracks <= 1) return 0;
  const clamped = Math.max(0, Math.min(0.999999, randomFactor));
  const offset = 1 + Math.floor(clamped * (totalTracks - 1));
  return (currentIndex + offset) % totalTracks;
}

/**
 * Clamps the aiming angle in degrees strictly to [-35, +35].
 * 0 deg points straight up (negative Y). Negative = left, Positive = right.
 */
export function clampAngleDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-MAX_AIM_ANGLE_DEG, Math.min(MAX_AIM_ANGLE_DEG, deg));
}

export const DEFAULT_BED_IMAGE_ASPECT = 738 / 416;

export interface BedLayout {
  drawW: number;
  drawH: number;
  leftX: number;
  topY: number;
  faceCx: number;
  faceCy: number;
  faceSize: number;
  aimOrigin: Point2D;
}

/**
 * Computes responsive bed placement, sleeper head center, and aim origin
 * anchored directly to the sleeping person's chest.
 */
export function getBedLayout(
  canvasWidth: number,
  canvasHeight: number,
  bedAspect = DEFAULT_BED_IMAGE_ASPECT
): BedLayout {
  const drawW = Math.min(canvasWidth * 0.68, canvasHeight * 0.36);
  const drawH = drawW * bedAspect;
  // Center the bed & sleeper horizontally while leaving room on right for nightstand extension
  const leftX = (canvasWidth - drawW) * 0.44;
  const topY = canvasHeight - drawH * 0.99;

  return {
    drawW,
    drawH,
    leftX,
    topY,
    faceCx: leftX + drawW * 0.515,
    faceCy: topY + drawH * 0.323,
    faceSize: drawW * 0.328,
    aimOrigin: {
      x: leftX + drawW * 0.505,
      y: topY + drawH * 0.435,
    },
  };
}

/**
 * Computes the aiming origin at the sleeping character's chest on the bed.
 */
export function computeAimOrigin(canvasWidth: number, canvasHeight: number): Point2D {
  return getBedLayout(canvasWidth, canvasHeight).aimOrigin;
}

/**
 * Computes aiming angle in degrees from vertical-up based on pointer drag offset
 * or pointer position relative to aim origin.
 * Dragging horizontally adjusts tilt smoothly in [-35, +35].
 */
export function computeAimAngleFromDrag(
  deltaX: number,
  sensitivityPxPerDeg = 2.6
): number {
  const rawDeg = deltaX / sensitivityPxPerDeg;
  return clampAngleDeg(rawDeg);
}

/**
 * Computes aiming angle directly from origin to a target point above/around origin.
 */
export function computeAimAngleFromPoint(
  origin: Point2D,
  pointer: Point2D
): number {
  const dx = pointer.x - origin.x;
  const dy = origin.y - pointer.y;
  if (dy <= 20) {
    // If finger is near/below bed, map horizontal offset from center directly
    return computeAimAngleFromDrag(dx, 3.2);
  }
  const rad = Math.atan2(dx, dy);
  const deg = (rad * 180) / Math.PI;
  return clampAngleDeg(deg);
}

/**
 * Computes unit direction vector for an aiming angle (0 deg = straight up).
 */
export function angleDegToRayDir(angleDeg: number): Point2D {
  const rad = (clampAngleDeg(angleDeg) * Math.PI) / 180;
  return {
    x: Math.sin(rad),
    y: -Math.cos(rad),
  };
}

/**
 * Computes the endpoint where the aiming ray hits the top edge (y = 0).
 */
export function computeRayTopEndpoint(
  origin: Point2D,
  angleDeg: number
): Point2D {
  const dir = angleDegToRayDir(angleDeg);
  const t = Math.abs(dir.y) > 1e-6 ? -origin.y / dir.y : 0;
  return {
    x: origin.x + dir.x * t,
    y: 0,
  };
}

/**
 * Computes horizontal flyer speed and allowed spawn directions for the current score.
 * Every 3 points increases speed and unlocks bidirectional (left or right) spawns.
 */
export function computeDifficultyForScore(
  score: number,
  randomValue = 0.5
): { speedPx: number; direction: 1 | -1 } {
  const tier = Math.max(0, Math.floor(score / 3));
  const speedPx = Math.min(
    MAX_FLYER_SPEED_PX,
    BASE_FLYER_SPEED_PX + tier * SPEED_STEP_PER_3_POINTS
  );

  // Before 3 points, spawn mostly left-to-right (or alternate); at >= 3 points, allow either edge
  let direction: 1 | -1 = 1;
  if (tier >= 1) {
    direction = randomValue < 0.5 ? 1 : -1;
  } else {
    direction = randomValue < 0.7 ? 1 : -1;
  }

  return { speedPx, direction };
}

/**
 * Spawns a flying stick-figure slapper in the upper third (18% - 32% of canvas height).
 */
export function createFlyer(params: {
  id: number;
  score: number;
  canvasWidth: number;
  canvasHeight: number;
  headRandom?: number;
  yRandom?: number;
  dirRandom?: number;
}): FlyerEntity {
  const headRandom = params.headRandom ?? Math.random();
  const yRandom = params.yRandom ?? Math.random();
  const dirRandom = params.dirRandom ?? Math.random();

  const headKey: FlyerHeadKey = headRandom < 0.5 ? 'flyer_head_1' : 'flyer_head_2';
  const { speedPx, direction } = computeDifficultyForScore(params.score, dirRandom);

  const minY = params.canvasHeight * 0.18;
  const maxY = params.canvasHeight * 0.32;
  const y = minY + yRandom * (maxY - minY);
  const margin = 52;
  const x = direction === 1 ? -margin : params.canvasWidth + margin;

  return {
    id: params.id,
    headKey,
    x,
    y,
    vx: speedPx * direction,
    direction,
    bobPhase: yRandom * Math.PI * 2,
    knockedOut: false,
    koElapsedMs: 0,
    koDurationMs: KNOCKOUT_DURATION_MS,
    koSpinRad: 0,
    koVy: 0,
    koVx: 0,
  };
}

/**
 * Returns the multi-circle hit targets representing the flying character's
 * head, torso, and outstretched gloved hands.
 */
export function getFlyerHitCircles(
  flyer: Pick<FlyerEntity, 'x' | 'y' | 'direction'>
): Array<{ cx: number; cy: number; r: number }> {
  const dir = flyer.direction;
  return [
    // Head cutout center (slightly forward of body)
    { cx: flyer.x + dir * 24, cy: flyer.y - 4, r: 28 },
    // Neck / upper torso
    { cx: flyer.x - dir * 2, cy: flyer.y + 4, r: 22 },
    // Trailing torso / legs
    { cx: flyer.x - dir * 32, cy: flyer.y + 6, r: 20 },
    // Outstretched gloved hands forward/downward
    { cx: flyer.x + dir * 34, cy: flyer.y + 20, r: 20 },
  ];
}

/**
 * Tests ray intersection from `origin` along unit direction `dir` (t >= 0) against a circle.
 * Returns the closest hit distance `t` and hit point, or null if no hit.
 */
export function intersectRayCircle(
  origin: Point2D,
  dir: Point2D,
  cx: number,
  cy: number,
  radius: number
): { t: number; point: Point2D } | null {
  const fx = origin.x - cx;
  const fy = origin.y - cy;

  const a = dir.x * dir.x + dir.y * dir.y;
  const b = 2 * (fx * dir.x + fy * dir.y);
  const c = fx * fx + fy * fy - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const hitT = t1 >= 0 ? t1 : t2 >= 0 ? t2 : -1;
  if (hitT < 0) return null;

  return {
    t: hitT,
    point: {
      x: origin.x + dir.x * hitT,
      y: origin.y + dir.y * hitT,
    },
  };
}

/**
 * Checks whether the aiming ray from `origin` at `angleDeg` intersects the active flying character.
 */
export function checkAimHit(
  origin: Point2D,
  angleDeg: number,
  flyer: FlyerEntity | null
): { hit: boolean; point: Point2D | null } {
  if (!flyer || flyer.knockedOut) {
    return { hit: false, point: null };
  }

  const dir = angleDegToRayDir(angleDeg);
  const circles = getFlyerHitCircles(flyer);

  let bestT = Infinity;
  let bestPoint: Point2D | null = null;

  for (const circle of circles) {
    const res = intersectRayCircle(origin, dir, circle.cx, circle.cy, circle.r);
    if (res && res.t < bestT) {
      bestT = res.t;
      bestPoint = res.point;
    }
  }

  return {
    hit: bestPoint !== null,
    point: bestPoint,
  };
}

/**
 * Advances flyer motion by dtSeconds.
 * Wraps horizontally when flying off-screen, or advances 180-deg tumble knockout.
 * Returns true if the flyer is still active/visible, false if knockout finished.
 */
export function stepFlyer(
  flyer: FlyerEntity,
  dtSeconds: number,
  canvasWidth: number
): boolean {
  const dtMs = dtSeconds * 1000;

  if (flyer.knockedOut) {
    flyer.koElapsedMs += dtMs;
    flyer.x += flyer.koVx * dtSeconds;
    flyer.y += flyer.koVy * dtSeconds;
    flyer.koVy += 720 * dtSeconds;
    const progress = Math.min(1, flyer.koElapsedMs / flyer.koDurationMs);
    flyer.koSpinRad = progress * Math.PI; // 180 degree flip
    return flyer.koElapsedMs < flyer.koDurationMs;
  }

  flyer.x += flyer.vx * dtSeconds;
  flyer.bobPhase += dtSeconds * 5.2;

  const wrapMargin = 72;
  if (flyer.direction === 1 && flyer.x > canvasWidth + wrapMargin) {
    flyer.x = -wrapMargin;
  } else if (flyer.direction === -1 && flyer.x < -wrapMargin) {
    flyer.x = canvasWidth + wrapMargin;
  }

  return true;
}

/**
 * Marks a flyer as knocked out after a successful hit.
 */
export function knockOutFlyer(flyer: FlyerEntity, impactPoint: Point2D): void {
  flyer.knockedOut = true;
  flyer.koElapsedMs = 0;
  flyer.koDurationMs = KNOCKOUT_DURATION_MS;
  flyer.koSpinRad = 0;
  const pushDir = flyer.x >= impactPoint.x ? 1 : -1;
  flyer.koVx = pushDir * 140 + flyer.vx * 0.25;
  flyer.koVy = -190;
}

/**
 * Loads persisted best score safely from localStorage (returns 0 if unavailable).
 */
export function loadBestScore(storage?: Pick<Storage, 'getItem'> | null): number {
  try {
    const store =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return 0;
    const raw = store.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Advances miss counter and determines whether the 3-miss loss threshold is reached.
 */
export function applyMissOutcome(
  currentMisses: number,
  maxMisses = 3
): { misses: number; isGameOver: boolean } {
  const misses = Math.max(0, currentMisses + 1);
  return {
    misses,
    isGameOver: misses >= maxMisses,
  };
}

/**
 * Persists best score safely to localStorage.
 */
export function saveBestScore(
  score: number,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  try {
    const store =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.setItem(BEST_SCORE_STORAGE_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}
