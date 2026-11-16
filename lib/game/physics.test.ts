import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_MANIFEST,
  BGM_TRACKS,
  CRUISING_KEYS,
} from './types';
import {
  BASE_FLYER_SPEED_PX,
  BGM_MAX_GAP_MS,
  BGM_MIN_GAP_MS,
  BGM_VOLUME,
  KNOCKOUT_DURATION_MS,
  MAX_AIM_ANGLE_DEG,
  applyMissOutcome,
  checkAimHit,
  clampAngleDeg,
  computeAimAngleFromDrag,
  computeAimOrigin,
  computeBgmGapMs,
  computeDifficultyForScore,
  computeRayTopEndpoint,
  createFlyer,
  getBedLayout,
  knockOutFlyer,
  loadBestScore,
  pickNextBgmIndex,
  saveBestScore,
  stepFlyer,
} from './physics';
import {
  createZipBytes,
  matchAudioFilenameToKey,
  parseZipEntries,
} from './zip';

test('clampAngleDeg restricts aiming ray to [-35, +35] degrees', () => {
  assert.equal(clampAngleDeg(0), 0);
  assert.equal(clampAngleDeg(-50), -MAX_AIM_ANGLE_DEG);
  assert.equal(clampAngleDeg(80), MAX_AIM_ANGLE_DEG);
  assert.equal(clampAngleDeg(18.5), 18.5);
  assert.equal(computeAimAngleFromDrag(-500), -35);
  assert.equal(computeAimAngleFromDrag(500), 35);
});

test('getBedLayout centers sleeper face horizontally in the frame', () => {
  const layout = getBedLayout(390, 844);
  assert.ok(Math.abs(layout.faceCx - 195) < 12);
});

test('applyMissOutcome triggers game over on 3rd miss', () => {
  assert.deepEqual(applyMissOutcome(0), { misses: 1, isGameOver: false });
  assert.deepEqual(applyMissOutcome(1), { misses: 2, isGameOver: false });
  assert.deepEqual(applyMissOutcome(2), { misses: 3, isGameOver: true });
});

test('computeRayTopEndpoint reaches y=0 at expected x offset', () => {
  const origin = { x: 200, y: 500 };
  const straightUp = computeRayTopEndpoint(origin, 0);
  assert.equal(Math.round(straightUp.x), 200);
  assert.equal(straightUp.y, 0);

  const rightTilt = computeRayTopEndpoint(origin, 35);
  assert.ok(rightTilt.x > 200);
  assert.equal(rightTilt.y, 0);
});

test('checkAimHit detects direct hit and clear miss accurately', () => {
  const origin = computeAimOrigin(430, 764);
  const flyer = createFlyer({
    id: 1,
    score: 0,
    canvasWidth: 430,
    canvasHeight: 764,
    headRandom: 0.2,
    yRandom: 0.5,
    dirRandom: 0.1,
  });

  // Place flyer directly above origin
  flyer.x = origin.x;
  flyer.y = 200;

  const hitResult = checkAimHit(origin, 0, flyer);
  assert.equal(hitResult.hit, true);
  assert.ok(hitResult.point !== null);
  assert.ok(hitResult.point.y < origin.y);

  // Tilt far right (+35 deg) so ray misses flyer positioned at origin.x
  const missResult = checkAimHit(origin, 35, flyer);
  assert.equal(missResult.hit, false);
  assert.equal(missResult.point, null);
});

test('progressive difficulty increases speed every 3 points and allows left/right spawns', () => {
  const tier0 = computeDifficultyForScore(0, 0.8);
  const tier1 = computeDifficultyForScore(3, 0.8);
  const tier2 = computeDifficultyForScore(6, 0.2);

  assert.equal(tier0.speedPx, BASE_FLYER_SPEED_PX);
  assert.ok(tier1.speedPx > tier0.speedPx);
  assert.ok(tier2.speedPx > tier1.speedPx);
  assert.equal(tier1.direction, -1);
  assert.equal(tier2.direction, 1);
});

test('stepFlyer wraps horizontally and completes 180-degree KO tumble in KNOCKOUT_DURATION_MS', () => {
  const flyer = createFlyer({
    id: 2,
    score: 0,
    canvasWidth: 400,
    canvasHeight: 700,
    dirRandom: 0.1,
  });
  flyer.x = 480;
  const alive = stepFlyer(flyer, 0.016, 400);
  assert.equal(alive, true);
  assert.ok(flyer.x < 0);

  knockOutFlyer(flyer, { x: flyer.x, y: flyer.y });
  assert.equal(flyer.knockedOut, true);

  const midKo = stepFlyer(flyer, KNOCKOUT_DURATION_MS / 2000, 400);
  assert.equal(midKo, true);
  assert.ok(Math.abs(flyer.koSpinRad - Math.PI / 2) < 0.1);

  const endKo = stepFlyer(flyer, KNOCKOUT_DURATION_MS / 1000, 400);
  assert.equal(endKo, false);
  assert.equal(flyer.koSpinRad, Math.PI);
});

test('best score persistence reads and writes cleanly', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(loadBestScore(mockStorage), 0);
  saveBestScore(14, mockStorage);
  assert.equal(loadBestScore(mockStorage), 14);
});


test('AUDIO_MANIFEST contains all 8 cruising lines, slap SFX, hit punchline, and miss reaction', () => {
  assert.equal(CRUISING_KEYS.length, 8);
  for (const key of CRUISING_KEYS) {
    assert.ok(AUDIO_MANIFEST[key].filename.endsWith('.mp3'));
    assert.ok(AUDIO_MANIFEST[key].script.length > 0);
  }
  assert.equal(AUDIO_MANIFEST.slap_sfx.filename, 'slap_sfx.mp3');
  assert.equal(AUDIO_MANIFEST.hit_punchline.script, 'Are maiya!');
  assert.equal(AUDIO_MANIFEST.miss_reaction.script, 'Chal chal chal!');
});

test('matchAudioFilenameToKey maps manifest filenames and common aliases cleanly', () => {
  assert.equal(matchAudioFilenameToKey('audio/cruising_1.mp3'), 'cruising_1');
  assert.equal(matchAudioFilenameToKey('cruising-4.wav'), 'cruising_4');
  assert.equal(matchAudioFilenameToKey('7.mp3'), 'cruising_7');
  assert.equal(matchAudioFilenameToKey('slap_sfx.mp3'), 'slap_sfx');
  assert.equal(matchAudioFilenameToKey('hit_punchline.wav'), 'hit_punchline');
  assert.equal(matchAudioFilenameToKey('miss_reaction.mp3'), 'miss_reaction');
  assert.equal(
    matchAudioFilenameToKey('mkb_amitabh_bachchan_fa595f97.mp3'),
    'gameover_audio'
  );
  assert.equal(matchAudioFilenameToKey('readme.txt'), null);
});

test('createZipBytes and parseZipEntries round-trip audio entries losslessly', async () => {
  const sampleA = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const sampleB = new TextEncoder().encode('hello-sleep-slap');
  const zip = createZipBytes([
    { name: 'audio/cruising_1.wav', data: sampleA },
    { name: 'README.txt', data: sampleB },
  ]);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const parsed = await parseZipEntries(ab);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'audio/cruising_1.wav');
  assert.deepEqual(parsed[0].data, sampleA);
  assert.equal(parsed[1].name, 'README.txt');
  assert.deepEqual(parsed[1].data, sampleB);
});

test('BGM playlist contains all 7 Myinstants tracks configured with appropriate volume and 2-4s gap', () => {
  assert.equal(BGM_TRACKS.length, 7);
  for (const track of BGM_TRACKS) {
    assert.ok(track.startsWith('/assets/audio/bgm/'));
    assert.ok(track.endsWith('.mp3'));
  }

  // Volume must be noticeably softer than main SFX (0.95)
  assert.ok(BGM_VOLUME >= 0.3 && BGM_VOLUME <= 0.45);

  // Gap between tracks must strictly range from 2000ms to 4000ms
  assert.equal(BGM_MIN_GAP_MS, 2000);
  assert.equal(BGM_MAX_GAP_MS, 4000);

  assert.equal(computeBgmGapMs(0), 2000);
  assert.equal(computeBgmGapMs(0.5), 3000);
  assert.equal(computeBgmGapMs(1), 4000);

  // Next track selection avoids back-to-back duplicate if > 1 track
  for (let current = 0; current < 7; current++) {
    const nextA = pickNextBgmIndex(current, 7, 0.0);
    const nextB = pickNextBgmIndex(current, 7, 0.99);
    assert.notEqual(nextA, current);
    assert.notEqual(nextB, current);
    assert.ok(nextA >= 0 && nextA < 7);
    assert.ok(nextB >= 0 && nextB < 7);
  }
});
