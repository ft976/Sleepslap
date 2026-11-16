'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Pause, Play, RotateCcw, X } from 'lucide-react';
import { GameAudioEngine } from '@/lib/game/audio';
import {
  MICRO_SHAKE_AMPLITUDE_PX,
  MICRO_SHAKE_DURATION_MS,
  RESPAWN_DELAY_MS,
  applyMissOutcome,
  checkAimHit,
  clampAngleDeg,
  computeAimAngleFromDrag,
  computeAimOrigin,
  createFlyer,
  knockOutFlyer,
  loadBestScore,
  saveBestScore,
  stepFlyer,
} from '@/lib/game/physics';
import {
  getDefaultPortraits,
  loadBundledBedAndSleeper,
} from '@/lib/game/portraits';
import { renderGameCanvas, type HeadImageSource } from '@/lib/game/renderer';
import {
  MAX_MISSES,
  type FlyerEntity,
  type FlyerHeadKey,
  type GameStatus,
  type HeadKey,
  type Particle,
  type StarburstEffect,
  type WhooshEffect,
} from '@/lib/game/types';

const MAX_PARTICLES = 64;
const CONFETTI_COLORS = ['#FF4D2D', '#FFA800', '#FFE047', '#FFFFFF', '#222222'];

function createParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 6,
      rotation: 0,
      vRot: 0,
      color: '#FFA800',
      life: 0,
      maxLife: 0.4,
      shape: 'shard',
    });
  }
  return pool;
}

export default function SleepSlapGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<GameAudioEngine | null>(null);

  const [gameState, setGameState] = useState<GameStatus>('title');
  const [score, setScore] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [activeFlyerHead, setActiveFlyerHead] =
    useState<FlyerHeadKey>('flyer_head_1');

  const [headPreviews, setHeadPreviews] = useState<Record<HeadKey, string>>({
    sleeper_head: '',
    flyer_head_1: '',
    flyer_head_2: '',
  });

  // Mutable simulation state decoupled from 60Hz React renders
  const simRef = useRef<{
    status: GameStatus;
    width: number;
    height: number;
    dpr: number;
    timeSec: number;
    score: number;
    misses: number;
    bestScore: number;
    nextFlyerId: number;
    flyer: FlyerEntity | null;
    respawnTimerMs: number;
    isAiming: boolean;
    aimPointerId: number | null;
    aimStartX: number;
    aimStartY: number;
    aimAngleDeg: number;
    particles: Particle[];
    particleCursor: number;
    starburst: StarburstEffect;
    whoosh: WhooshEffect;
    shakeRemainingMs: number;
    sleepReboundTimerMs: number;
    headImages: Record<HeadKey, HeadImageSource> | null;
    bedImage: HeadImageSource | null;
  }>({
    status: 'title',
    width: 390,
    height: 764,
    dpr: 1,
    timeSec: 0,
    score: 0,
    misses: 0,
    bestScore: 0,
    nextFlyerId: 1,
    flyer: null,
    respawnTimerMs: 0,
    isAiming: false,
    aimPointerId: null,
    aimStartX: 0,
    aimStartY: 0,
    aimAngleDeg: 0,
    particles: createParticlePool(),
    particleCursor: 0,
    starburst: { active: false, x: 0, y: 0, elapsedMs: 0, durationMs: 280, seed: 0 },
    whoosh: { active: false, originX: 0, originY: 0, angleDeg: 0, elapsedMs: 0, durationMs: 240 },
    shakeRemainingMs: 0,
    sleepReboundTimerMs: 0,
    headImages: null,
    bedImage: null,
  });

  // Sync body dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
    simRef.current.status = gameState;
  }, [gameState]);

  const spawnNextFlyer = useCallback((currentScore: number) => {
    const sim = simRef.current;
    const flyer = createFlyer({
      id: sim.nextFlyerId++,
      score: currentScore,
      canvasWidth: sim.width,
      canvasHeight: sim.height,
    });
    sim.flyer = flyer;
    setActiveFlyerHead(flyer.headKey);
    audioRef.current?.playCruisingLine();
  }, []);

  const spawnConfettiBurst = useCallback((x: number, y: number) => {
    const sim = simRef.current;
    const count = 20;
    for (let i = 0; i < count; i++) {
      const p = sim.particles[sim.particleCursor];
      sim.particleCursor = (sim.particleCursor + 1) % MAX_PARTICLES;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 130 + Math.random() * 230;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.size = 5 + Math.random() * 6;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 14;
      p.color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.22;
      p.shape = i % 3 === 0 ? 'line' : i % 3 === 1 ? 'shard' : 'spark';
    }
  }, []);

  const startGame = useCallback(() => {
    audioRef.current?.stopAllVoices();
    audioRef.current?.unlock();
    audioRef.current?.startBgm();
    const sim = simRef.current;
    sim.score = 0;
    sim.misses = 0;
    sim.flyer = null;
    sim.respawnTimerMs = 0;
    sim.isAiming = false;
    sim.aimPointerId = null;
    sim.aimAngleDeg = 0;
    sim.starburst.active = false;
    sim.whoosh.active = false;
    sim.shakeRemainingMs = 0;

    setScore(0);
    setMisses(0);
    setGameState('playing');
    document.body.dataset.state = 'playing';
    sim.status = 'playing';

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    spawnNextFlyer(0);
  }, [spawnNextFlyer]);

  const resetToTitle = useCallback(() => {
    audioRef.current?.stopAllVoices();
    audioRef.current?.stopBgm();
    const sim = simRef.current;
    sim.score = 0;
    sim.misses = 0;
    sim.flyer = null;
    sim.respawnTimerMs = 0;
    sim.isAiming = false;
    sim.aimPointerId = null;
    sim.aimAngleDeg = 0;
    sim.starburst.active = false;
    sim.whoosh.active = false;
    sim.shakeRemainingMs = 0;

    setScore(0);
    setMisses(0);
    setGameState('title');
    document.body.dataset.state = 'title';
    sim.status = 'title';
  }, []);

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'playing') {
        audioRef.current?.stopCruising();
        audioRef.current?.pauseBgm();
        simRef.current.isAiming = false;
        simRef.current.aimPointerId = null;
        return 'paused';
      }
      if (prev === 'paused') {
        audioRef.current?.unlock();
        audioRef.current?.resumeBgm();
        return 'playing';
      }
      return prev;
    });
  }, []);

  const releaseSlap = useCallback(() => {
    const sim = simRef.current;
    if (!sim.isAiming || sim.status !== 'playing') return;

    const angleDeg = sim.aimAngleDeg;
    sim.isAiming = false;
    sim.aimPointerId = null;

    const origin = computeAimOrigin(sim.width, sim.height);
    const result = checkAimHit(origin, angleDeg, sim.flyer);

    if (result.hit && result.point && sim.flyer) {
      // ON HIT
      audioRef.current?.playHit();
      knockOutFlyer(sim.flyer, result.point);

      sim.starburst = {
        active: true,
        x: result.point.x,
        y: result.point.y,
        elapsedMs: 0,
        durationMs: 280,
        seed: sim.score + 1,
      };
      spawnConfettiBurst(result.point.x, result.point.y);

      sim.shakeRemainingMs = MICRO_SHAKE_DURATION_MS;
      sim.sleepReboundTimerMs = 180;
      sim.respawnTimerMs = RESPAWN_DELAY_MS;

      const nextScore = sim.score + 1;
      sim.score = nextScore;
      setScore(nextScore);

      if (nextScore > sim.bestScore) {
        sim.bestScore = nextScore;
        setBestScore(nextScore);
        saveBestScore(nextScore);
      }
    } else {
      // ON MISS
      const outcome = applyMissOutcome(sim.misses, MAX_MISSES);
      sim.misses = outcome.misses;
      setMisses(outcome.misses);

      sim.whoosh = {
        active: true,
        originX: origin.x,
        originY: origin.y,
        angleDeg,
        elapsedMs: 0,
        durationMs: 240,
      };

      if (outcome.isGameOver) {
        sim.flyer = null;
        sim.respawnTimerMs = 0;
        sim.isAiming = false;
        sim.aimPointerId = null;
        sim.status = 'gameover';
        document.body.dataset.state = 'gameover';
        setGameState('gameover');
        audioRef.current?.playGameOver();
      } else {
        audioRef.current?.playMiss();
      }
    }
  }, [spawnConfettiBurst]);

  // Initialize portraits, audio engine, localStorage best score, and ?autostart=1
  useEffect(() => {
    const portraits = getDefaultPortraits();
    simRef.current.headImages = {
      sleeper_head: portraits.canvases.sleeper_head,
      flyer_head_1: portraits.canvases.flyer_head_1,
      flyer_head_2: portraits.canvases.flyer_head_2,
    };
    const engine = new GameAudioEngine();
    engine.preloadAll();
    audioRef.current = engine;

    const savedBest = loadBestScore();
    simRef.current.bestScore = savedBest;

    const rafId = requestAnimationFrame(() => {
      setHeadPreviews({
        sleeper_head: portraits.dataUrls.sleeper_head,
        flyer_head_1: portraits.dataUrls.flyer_head_1,
        flyer_head_2: portraits.dataUrls.flyer_head_2,
      });
      setBestScore(savedBest);

      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('autostart') === '1'
      ) {
        startGame();
      }
    });

    let cancelled = false;
    void loadBundledBedAndSleeper().then(
      ({
        bedImage,
        sleeperCanvas,
        sleeperDataUrl,
        flyer1Canvas,
        flyer1DataUrl,
        flyer2Canvas,
        flyer2DataUrl,
      }) => {
        if (cancelled) return;
        if (bedImage) {
          simRef.current.bedImage = bedImage;
        }
        if (simRef.current.headImages) {
          if (sleeperCanvas) simRef.current.headImages.sleeper_head = sleeperCanvas;
          if (flyer1Canvas) simRef.current.headImages.flyer_head_1 = flyer1Canvas;
          if (flyer2Canvas) simRef.current.headImages.flyer_head_2 = flyer2Canvas;
        }
        setHeadPreviews((prev) => ({
          ...prev,
          ...(sleeperDataUrl ? { sleeper_head: sleeperDataUrl } : {}),
          ...(flyer1DataUrl ? { flyer_head_1: flyer1DataUrl } : {}),
          ...(flyer2DataUrl ? { flyer_head_2: flyer2DataUrl } : {}),
        }));
      }
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      engine.stopAllVoices();
      engine.stopBgm();
    };
  }, [startGame]);

  // Keyboard shortcuts (Enter/Space on title, P/Escape pause, Arrow/Space accessible aim)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {

      if (simRef.current.status === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (simRef.current.status === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (simRef.current.status === 'playing') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          simRef.current.isAiming = true;
          simRef.current.aimAngleDeg = clampAngleDeg(
            simRef.current.aimAngleDeg - 6
          );
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          simRef.current.isAiming = true;
          simRef.current.aimAngleDeg = clampAngleDeg(
            simRef.current.aimAngleDeg + 6
          );
        } else if (e.key === ' ') {
          e.preventDefault();
          if (!simRef.current.isAiming) {
            simRef.current.isAiming = true;
          } else {
            releaseSlap();
          }
        }
      }
    };

    const clearHeldInput = () => {
      simRef.current.isAiming = false;
      simRef.current.aimPointerId = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', clearHeldInput);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', clearHeldInput);
    };
  }, [releaseSlap, startGame, togglePause]);

  // ResizeObserver + 60fps Canvas Loop
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(280, Math.round(rect.width));
      const height = Math.max(480, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      simRef.current.width = width;
      simRef.current.height = height;
      simRef.current.dpr = dpr;
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      const dtMs = dt * 1000;
      const sim = simRef.current;

      if (sim.status !== 'paused') {
        sim.timeSec += dt;
      }

      if (sim.status === 'playing') {
        // Flyer movement & KO tumble
        if (sim.flyer) {
          const alive = stepFlyer(sim.flyer, dt, sim.width);
          if (!alive) {
            sim.flyer = null;
          }
        }

        // Respawn countdown after hit (450ms)
        if (sim.respawnTimerMs > 0) {
          sim.respawnTimerMs -= dtMs;
          if (sim.respawnTimerMs <= 0 && !sim.flyer) {
            sim.respawnTimerMs = 0;
            spawnNextFlyer(sim.score);
          }
        }

        // Starburst FX
        if (sim.starburst.active) {
          sim.starburst.elapsedMs += dtMs;
          if (sim.starburst.elapsedMs >= sim.starburst.durationMs) {
            sim.starburst.active = false;
          }
        }

        // Miss Whoosh FX
        if (sim.whoosh.active) {
          sim.whoosh.elapsedMs += dtMs;
          if (sim.whoosh.elapsedMs >= sim.whoosh.durationMs) {
            sim.whoosh.active = false;
          }
        }

        // Pooled Confetti Particles
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const p = sim.particles[i];
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 420 * dt;
          p.rotation += p.vRot * dt;
        }

        if (sim.shakeRemainingMs > 0) {
          sim.shakeRemainingMs = Math.max(0, sim.shakeRemainingMs - dtMs);
        }
        if (sim.sleepReboundTimerMs > 0) {
          sim.sleepReboundTimerMs = Math.max(0, sim.sleepReboundTimerMs - dtMs);
        }
      }

      canvas.dataset.flyerX = sim.flyer && !sim.flyer.knockedOut ? String(Math.round(sim.flyer.x)) : '';
      canvas.dataset.flyerY = sim.flyer && !sim.flyer.knockedOut ? String(Math.round(sim.flyer.y)) : '';

      const ctx = canvas.getContext('2d');
      if (ctx && sim.headImages) {
        renderGameCanvas(ctx, sim.dpr, {
          width: sim.width,
          height: sim.height,
          timeSec: sim.timeSec,
          isAiming: sim.isAiming && sim.status === 'playing',
          aimAngleDeg: sim.aimAngleDeg,
          flyer: sim.flyer,
          starburst: sim.starburst,
          whoosh: sim.whoosh,
          particles: sim.particles,
          shakeRemainingMs: sim.shakeRemainingMs,
          shakeDurationMs: MICRO_SHAKE_DURATION_MS,
          shakeAmplitudePx: MICRO_SHAKE_AMPLITUDE_PX,
          headImages: sim.headImages,
          bedImage: sim.bedImage,
          sleepReboundTimerMs: sim.sleepReboundTimerMs,
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [spawnNextFlyer]);

  // Pointer Aiming Handlers (Touch & Mouse on bottom half of screen)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (simRef.current.status !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    audioRef.current?.unlock();
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Require press on bottom half (or anywhere below 45% height around bed)
    if (localY < rect.height * 0.45) return;

    canvas.setPointerCapture(e.pointerId);
    const sim = simRef.current;
    sim.isAiming = true;
    sim.aimPointerId = e.pointerId;
    sim.aimStartX = localX;
    sim.aimStartY = localY;
    sim.aimAngleDeg = 0;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim.isAiming || sim.aimPointerId !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    sim.aimAngleDeg = computeAimAngleFromDrag(localX - sim.aimStartX, 2.1);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim.isAiming || sim.aimPointerId !== e.pointerId) return;
    releaseSlap();
  };

  return (
    <main className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#EAEAEA] sm:bg-[#DEDEDE]">
      {/* Portrait Mobile Frame (max-width: 430px, 100dvh, 9:16 aspect ratio) */}
      <div
        ref={containerRef}
        className="relative h-[100dvh] w-full max-w-[430px] overflow-hidden bg-[#EAEAEA] sm:h-[min(96dvh,844px)] sm:aspect-[9/16] sm:rounded-[28px] sm:border sm:border-black/10 sm:shadow-[0_24px_60px_rgba(0,0,0,0.14)]"
        style={{ touchAction: 'none' }}
      >
        {/* High-DPI Game Canvas */}
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          data-score={score}
          data-misses={misses}
          data-best={bestScore}
          data-active-flyer={activeFlyerHead}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className="block h-full w-full cursor-crosshair touch-none"
        />

        {/* Top HUD Bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-4">
          {/* Top-Left: Reset / Exit Circle Button (38px visual inside 44px tap target) */}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              resetToTitle();
            }}
            aria-label="Reset game"
            title="Reset game"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#222222]"
          >
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[rgba(0,0,0,0.22)] text-white transition-transform active:scale-95">
              <X className="h-[18px] w-[18px] stroke-[2.6]" />
            </span>
          </button>

          {/* Top-Center: Score (42px #222222) + BEST 0 (12px #666666) + 3-Miss Life Pips */}
          <div className="flex flex-col items-center pt-0.5 text-center">
            <div
              data-testid="hud-score"
              className="text-[42px] font-extrabold leading-none tracking-tight text-[#222222] tabular-nums"
            >
              {score}
            </div>
            <div
              data-testid="hud-best"
              className="mt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-[#666666] tabular-nums"
            >
              BEST {bestScore}
            </div>
            <div
              data-testid="hud-misses"
              aria-label={`Misses ${misses} of ${MAX_MISSES}`}
              className="mt-1.5 flex items-center gap-1.5"
            >
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: MAX_MISSES }).map((_, i) => {
                  const alive = i < MAX_MISSES - misses;
                  return (
                    <Heart
                      key={i}
                      className={`h-3.5 w-3.5 transition-all ${
                        alive
                          ? 'fill-[#DC2626] text-[#181818] stroke-[2.2]'
                          : 'fill-transparent text-[#999999] stroke-[2] opacity-55'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#555555] tabular-nums">
                Misses {misses}/{MAX_MISSES}
              </span>
            </div>
          </div>

          {/* Top-Right: Pause/Resume Toggle (38px visual inside 44px tap target) */}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              if (gameState === 'title') startGame();
              else if (gameState !== 'gameover') togglePause();
            }}
            aria-label={gameState === 'paused' ? 'Resume game' : 'Pause game'}
            title={gameState === 'paused' ? 'Resume' : 'Pause'}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#222222]"
          >
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[rgba(0,0,0,0.22)] text-white transition-transform active:scale-95">
              {gameState === 'paused' ? (
                <Play className="h-[18px] w-[18px] fill-white stroke-[2]" />
              ) : (
                <Pause className="h-[18px] w-[18px] fill-white stroke-[2]" />
              )}
            </span>
          </button>
        </div>

        {/* Bottom-Right Corner: 26px Mini-Avatar Badge */}
        {gameState !== 'title' && headPreviews[activeFlyerHead] && (
          <div
            data-testid="active-flyer-badge"
            aria-label="Active flying character"
            className="pointer-events-none absolute right-4 bottom-4 z-20 flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#222222] bg-white shadow-sm"
          >
            <img
              src={headPreviews[activeFlyerHead]}
              alt="Active flying character"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Title Overlay (Diegetic In-World Awakening over the breathing sleeper) */}
        {gameState === 'title' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center px-6 pt-28">
            <div className="flex flex-col items-center text-center">
              {/* Hand-drawn comic SVG emblem */}
              <svg
                viewBox="0 0 280 86"
                className="h-20 w-[260px]"
                aria-hidden="true"
              >
                <path
                  d="M14 14 L268 8 L260 72 L10 78 Z"
                  fill="#FFFFFF"
                  stroke="#181818"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 78 L262 72 L258 80 L14 84 Z"
                  fill="#181818"
                />
                <text
                  x="140"
                  y="52"
                  textAnchor="middle"
                  fill="#181818"
                  fontSize="34"
                  fontWeight="900"
                  letterSpacing="2"
                >
                  SLEEP SLAP
                </text>
              </svg>

              <p className="mt-2 max-w-[260px] text-sm font-semibold text-[#444444]">
                Slap the late-night roasters out of the sky while you try to sleep.
              </p>

              <button
                type="button"
                data-start="true"
                onClick={startGame}
                className="pointer-events-auto mt-5 inline-flex h-12 items-center justify-center rounded-2xl border-2 border-[#181818] bg-[#222222] px-8 text-base font-extrabold tracking-wide text-white shadow-[0_4px_0_#111111] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#111111]"
              >
                Tap to Play
              </button>

              <div className="mt-3 text-center text-xs font-semibold tracking-wide text-[#555555]">
                Hold &amp; drag bottom half to aim · Release to slap
              </div>
            </div>
          </div>
        )}

        {/* Game Over Modal Overlay (3 Misses) */}
        {gameState === 'gameover' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameover-title"
            data-testid="gameover-dialog"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6"
          >
            <div className="w-full max-w-[300px] rounded-2xl border-2 border-[#181818] bg-[#F7F7F7] p-5 text-center shadow-xl">
              <h2
                id="gameover-title"
                className="text-2xl font-extrabold tracking-tight text-[#222222]"
              >
                Woken Up!
              </h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#DC2626]">
                Missed {MAX_MISSES} targets
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                    Score
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold text-[#222222] tabular-nums">
                    {score}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                    Best
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold text-[#222222] tabular-nums">
                    {bestScore}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={startGame}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#181818] bg-[#222222] text-sm font-extrabold text-white shadow-[0_3px_0_#111111] transition-transform active:translate-y-[1px] hover:bg-black"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Try Again</span>
                </button>
                <button
                  type="button"
                  onClick={resetToTitle}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/15 bg-white text-sm font-bold text-[#222222] hover:bg-black/5"
                >
                  <span>Back to Title</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pause Modal Overlay */}
        {gameState === 'paused' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 px-6"
          >
            <div className="w-full max-w-[300px] rounded-2xl border-2 border-[#181818] bg-[#F7F7F7] p-5 text-center shadow-xl">
              <h2
                id="pause-title"
                className="text-2xl font-extrabold tracking-tight text-[#222222]"
              >
                Paused
              </h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#666666] tabular-nums">
                Score {score} · Best {bestScore}
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#222222] text-sm font-bold text-white hover:bg-black"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  type="button"
                  onClick={startGame}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/15 bg-white text-sm font-bold text-[#222222] hover:bg-black/5"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Restart Run</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
