import type { HeadKey } from './types';

export interface PortraitCache {
  canvases: Record<HeadKey, HTMLCanvasElement>;
  dataUrls: Record<HeadKey, string>;
}

let cachedPortraits: PortraitCache | null = null;

function drawCutoutStickerBorder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 5, ry + 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.stroke();
  ctx.restore();
}

function drawSleeperPortrait(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;
  const cy = size / 2 + 4;
  drawCutoutStickerBorder(ctx, cx, cy, 42, 46);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ears
  ctx.fillStyle = '#E5B28A';
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 3.2;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 36, cy + 4, 8, 12, dir * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Head silhouette (slightly oval)
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 34, 40, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#EDC09B';
  ctx.fill();
  ctx.stroke();

  // Subtle cheek shading
  ctx.beginPath();
  ctx.ellipse(cx - 18, cy + 12, 8, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 18, cy + 12, 8, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 120, 100, 0.22)';
  ctx.fill();

  // Messy dark hair on top
  ctx.beginPath();
  ctx.moveTo(cx - 35, cy - 8);
  ctx.quadraticCurveTo(cx - 38, cy - 36, cx - 18, cy - 42);
  ctx.lineTo(cx - 14, cy - 50);
  ctx.lineTo(cx - 2, cy - 41);
  ctx.lineTo(cx + 9, cy - 52);
  ctx.lineTo(cx + 16, cy - 41);
  ctx.lineTo(cx + 30, cy - 44);
  ctx.quadraticCurveTo(cx + 39, cy - 26, cx + 35, cy - 8);
  ctx.quadraticCurveTo(cx + 22, cy - 22, cx + 6, cy - 18);
  ctx.quadraticCurveTo(cx - 8, cy - 25, cx - 20, cy - 16);
  ctx.closePath();
  ctx.fillStyle = '#1E1D22';
  ctx.fill();
  ctx.stroke();

  // Tired eyebrows
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 12);
  ctx.quadraticCurveTo(cx - 14, cy - 15, cx - 6, cy - 11);
  ctx.moveTo(cx + 6, cy - 11);
  ctx.quadraticCurveTo(cx + 14, cy - 15, cx + 22, cy - 12);
  ctx.stroke();

  // Sleepy half-closed eyes behind glasses
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 2.2;
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 13;
    const ey = cy - 2;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 7.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil looking slightly up toward target
    ctx.beginPath();
    ctx.arc(ex, ey - 1, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = '#181818';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';

    // Heavy upper eyelid
    ctx.beginPath();
    ctx.moveTo(ex - 8, ey - 2);
    ctx.lineTo(ex + 8, ey - 2);
    ctx.stroke();
  }

  // Black rectangular glasses
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#111111';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.roundRect(cx - 27, cy - 10, 23, 16, 3);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(cx + 4, cy - 10, 23, 16, 3);
  ctx.fill();
  ctx.stroke();

  // Glasses bridge & temples
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 3);
  ctx.lineTo(cx + 4, cy - 3);
  ctx.moveTo(cx - 34, cy - 4);
  ctx.lineTo(cx - 27, cy - 4);
  ctx.moveTo(cx + 27, cy - 4);
  ctx.lineTo(cx + 34, cy - 4);
  ctx.stroke();

  // Nose
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 1);
  ctx.quadraticCurveTo(cx + 4, cy + 11, cx - 2, cy + 13);
  ctx.stroke();

  // Slightly annoyed / sleepy smirk
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 24);
  ctx.quadraticCurveTo(cx, cy + 22, cx + 10, cy + 25);
  ctx.stroke();

  ctx.restore();
}

function drawFlyer1Portrait(ctx: CanvasRenderingContext2D, size: number) {
  // Bearded man with short hair and a stern expression
  const cx = size / 2;
  const cy = size / 2 + 4;
  drawCutoutStickerBorder(ctx, cx, cy, 42, 46);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 3.2;

  // Ears
  ctx.fillStyle = '#D99E73';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 35, cy + 2, 7.5, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Broad jaw head
  ctx.beginPath();
  ctx.roundRect(cx - 33, cy - 38, 66, 78, [30, 30, 24, 24]);
  ctx.fillStyle = '#E2AA80';
  ctx.fill();
  ctx.stroke();

  // Full trimmed dark beard & mustache
  ctx.beginPath();
  ctx.moveTo(cx - 33, cy + 6);
  ctx.quadraticCurveTo(cx - 34, cy + 40, cx, cy + 42);
  ctx.quadraticCurveTo(cx + 34, cy + 40, cx + 33, cy + 6);
  ctx.lineTo(cx + 26, cy + 14);
  ctx.quadraticCurveTo(cx + 16, cy + 20, cx + 12, cy + 16);
  ctx.quadraticCurveTo(cx, cy + 13, cx - 12, cy + 16);
  ctx.quadraticCurveTo(cx - 16, cy + 20, cx - 26, cy + 14);
  ctx.closePath();
  ctx.fillStyle = '#242022';
  ctx.fill();
  ctx.stroke();

  // Short cropped hair
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy - 12);
  ctx.quadraticCurveTo(cx - 34, cy - 42, cx, cy - 44);
  ctx.quadraticCurveTo(cx + 34, cy - 42, cx + 34, cy - 12);
  ctx.quadraticCurveTo(cx + 20, cy - 26, cx, cy - 24);
  ctx.quadraticCurveTo(cx - 20, cy - 26, cx - 34, cy - 12);
  ctx.closePath();
  ctx.fillStyle = '#242022';
  ctx.fill();
  ctx.stroke();

  // Stern furrowed eyebrows
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 13);
  ctx.lineTo(cx - 6, cy - 7);
  ctx.moveTo(cx + 24, cy - 13);
  ctx.lineTo(cx + 6, cy - 7);
  ctx.stroke();

  // Intense eyes
  ctx.lineWidth = 2.4;
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 13;
    const ey = cy - 2;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#181818';
    ctx.fill();
  }

  // Nose
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 3);
  ctx.lineTo(cx - 3, cy + 11);
  ctx.lineTo(cx + 4, cy + 12);
  ctx.stroke();

  // Stern shouting/scolding mouth inside beard
  ctx.beginPath();
  ctx.ellipse(cx, cy + 25, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#702626';
  ctx.fill();
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Top teeth flash
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 22);
  ctx.lineTo(cx + 8, cy + 22);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

function drawFlyer2Portrait(ctx: CanvasRenderingContext2D, size: number) {
  // Clean-shaven young man with spiky dark hair and an annoyed expression
  const cx = size / 2;
  const cy = size / 2 + 5;
  drawCutoutStickerBorder(ctx, cx, cy, 41, 45);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 3.2;

  // Ears
  ctx.fillStyle = '#E8B994';
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + dir * 33, cy + 4, 7, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Clean-shaven youthful oval face
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 32, 38, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F0C5A2';
  ctx.fill();
  ctx.stroke();

  // Spiky dark hair
  ctx.beginPath();
  ctx.moveTo(cx - 33, cy - 6);
  ctx.lineTo(cx - 38, cy - 25);
  ctx.lineTo(cx - 24, cy - 28);
  ctx.lineTo(cx - 26, cy - 48);
  ctx.lineTo(cx - 10, cy - 36);
  ctx.lineTo(cx, cy - 54);
  ctx.lineTo(cx + 12, cy - 37);
  ctx.lineTo(cx + 28, cy - 47);
  ctx.lineTo(cx + 25, cy - 27);
  ctx.lineTo(cx + 38, cy - 23);
  ctx.lineTo(cx + 33, cy - 6);
  ctx.quadraticCurveTo(cx + 16, cy - 21, cx, cy - 18);
  ctx.quadraticCurveTo(cx - 16, cy - 21, cx - 33, cy - 6);
  ctx.closePath();
  ctx.fillStyle = '#1A1A20';
  ctx.fill();
  ctx.stroke();

  // Annoyed angled eyebrows
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 11);
  ctx.lineTo(cx - 6, cy - 6);
  ctx.moveTo(cx + 22, cy - 11);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.stroke();

  // Annoyed side-eye / squinted gaze
  ctx.lineWidth = 2.4;
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 13;
    const ey = cy + 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 7, 5.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ex + 1.5, ey, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = '#181818';
    ctx.fill();
  }

  // Nose
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.quadraticCurveTo(cx + 5, cy + 11, cx - 1, cy + 14);
  ctx.stroke();

  // Annoyed crooked frown
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 25);
  ctx.quadraticCurveTo(cx - 2, cy + 20, cx + 11, cy + 26);
  ctx.stroke();

  ctx.restore();
}

function makeCanvas(drawFn: (ctx: CanvasRenderingContext2D, size: number) => void): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, size);
  }
  return canvas;
}

export function getDefaultPortraits(): PortraitCache {
  if (cachedPortraits) return cachedPortraits;

  const sleeperCanvas = makeCanvas(drawSleeperPortrait);
  const flyer1Canvas = makeCanvas(drawFlyer1Portrait);
  const flyer2Canvas = makeCanvas(drawFlyer2Portrait);

  cachedPortraits = {
    canvases: {
      sleeper_head: sleeperCanvas,
      flyer_head_1: flyer1Canvas,
      flyer_head_2: flyer2Canvas,
    },
    dataUrls: {
      sleeper_head: sleeperCanvas.toDataURL('image/png'),
      flyer_head_1: flyer1Canvas.toDataURL('image/png'),
      flyer_head_2: flyer2Canvas.toDataURL('image/png'),
    },
  };

  return cachedPortraits;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function buildCleanFaceCutout(img: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  dataUrl: string;
} {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Source crop focuses on the face + ornate headpiece (excluding flat bottom shoulders)
    const sx = img.naturalWidth * 0.19;
    const sy = img.naturalHeight * 0.05;
    const sw = img.naturalWidth * 0.66;
    const sh = img.naturalHeight * 0.64;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size * 0.45, size * 0.47, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, sx, sy, sw, sh, 4, 4, size - 8, size - 8);
    ctx.restore();

    // Subtle crisp outline so it integrates cleanly with the cartoon bed ink style
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size * 0.45, size * 0.47, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#181818';
    ctx.stroke();
    ctx.restore();
  }
  return { canvas, dataUrl: canvas.toDataURL('image/png') };
}

function stripWhiteBackground(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || w === 0 || h === 0) return canvas;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBgPixel = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const a = data[p + 3];
    if (a < 20) return true;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return minC >= 230 && maxC - minC <= 22;
  };

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    if (!isBgPixel(idx)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x);
    enqueue((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueue(y * w);
    enqueue(y * w + (w - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) enqueue(idx - 1);
    if (x < w - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - w);
    if (y < h - 1) enqueue(idx + w);
  }

  // Softly feather dark-fringe anti-aliased edge pixels touching transparent background
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const p = idx * 4;
      if (data[p + 3] === 0) continue;
      if (
        data[(idx - 1) * 4 + 3] === 0 ||
        data[(idx + 1) * 4 + 3] === 0 ||
        data[(idx - w) * 4 + 3] === 0 ||
        data[(idx + w) * 4 + 3] === 0
      ) {
        const minC = Math.min(data[p], data[p + 1], data[p + 2]);
        const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
        if (minC >= 205 && maxC - minC <= 26) {
          data[p + 3] = Math.round(data[p + 3] * 0.35);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function buildFlyerHeadCutout(
  img: HTMLImageElement,
  cropBottomRatio = 0.9
): {
  canvas: HTMLCanvasElement;
  dataUrl: string;
} {
  const size = 160;
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = size;
  rawCanvas.height = size;
  const rawCtx = rawCanvas.getContext('2d');
  if (!rawCtx) {
    return { canvas: rawCanvas, dataUrl: '' };
  }

  const nw = img.naturalWidth || size;
  const nh = Math.round((img.naturalHeight || size) * cropBottomRatio);
  const pad = 8;
  const box = size - pad * 2;
  const scale = Math.min(box / nw, box / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  rawCtx.fillStyle = '#000000';
  rawCtx.fillRect(0, 0, size, size);
  rawCtx.drawImage(img, 0, 0, nw, nh, dx, dy, dw, dh);

  const imageData = rawCtx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const total = size * size;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBlackBg = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const sum = r + g + b;
    return maxC <= 22 || (maxC <= 28 && sum <= 54);
  };

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    if (!isBlackBg(idx)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < size; x++) {
    enqueue(x);
    enqueue((size - 1) * size + x);
  }
  for (let y = 1; y < size - 1; y++) {
    enqueue(y * size);
    enqueue(y * size + (size - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0;
    const x = idx % size;
    const y = (idx - x) / size;
    if (x > 0) enqueue(idx - 1);
    if (x < size - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - size);
    if (y < size - 1) enqueue(idx + size);
  }

  // Smoothly feather 1px border halo pixels touching transparent background
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      const p = idx * 4;
      if (data[p + 3] === 0) continue;
      if (
        data[(idx - 1) * 4 + 3] === 0 ||
        data[(idx + 1) * 4 + 3] === 0 ||
        data[(idx - size) * 4 + 3] === 0 ||
        data[(idx + size) * 4 + 3] === 0
      ) {
        const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
        if (maxC <= 46) {
          data[p + 3] = Math.round(data[p + 3] * 0.4);
        }
      }
    }
  }

  rawCtx.putImageData(imageData, 0, 0);

  // Taper bottom chin edge slightly so neck/collar ends cleanly on stick-figure torso
  const outCanvas = document.createElement('canvas');
  outCanvas.width = size;
  outCanvas.height = size;
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    outCtx.save();
    outCtx.beginPath();
    outCtx.ellipse(size / 2, size * 0.47, size * 0.47, size * 0.44, 0, 0, Math.PI * 2);
    outCtx.clip();
    outCtx.drawImage(rawCanvas, 0, 0);
    outCtx.restore();
  }

  return { canvas: outCanvas, dataUrl: outCanvas.toDataURL('image/png') };
}

export async function loadBundledBedAndSleeper(): Promise<{
  bedImage: HTMLCanvasElement | null;
  sleeperCanvas: HTMLCanvasElement | null;
  sleeperDataUrl: string | null;
  flyer1Canvas: HTMLCanvasElement | null;
  flyer1DataUrl: string | null;
  flyer2Canvas: HTMLCanvasElement | null;
  flyer2DataUrl: string | null;
}> {
  const [bedRes, faceRes, flyer1Res, flyer2Res] = await Promise.allSettled([
    loadImageElement('/assets/custom_bed.png'),
    loadImageElement('/assets/sleeper_face.png'),
    loadImageElement('/assets/aistudio/1000063587_2_02810674.jpg'),
    loadImageElement('/assets/aistudio/1000064567_2_1a20d90a.jpg'),
  ]);

  const bedImage =
    bedRes.status === 'fulfilled' ? stripWhiteBackground(bedRes.value) : null;
  let sleeperCanvas: HTMLCanvasElement | null = null;
  let sleeperDataUrl: string | null = null;
  let flyer1Canvas: HTMLCanvasElement | null = null;
  let flyer1DataUrl: string | null = null;
  let flyer2Canvas: HTMLCanvasElement | null = null;
  let flyer2DataUrl: string | null = null;

  if (faceRes.status === 'fulfilled') {
    const cutout = buildCleanFaceCutout(faceRes.value);
    sleeperCanvas = cutout.canvas;
    sleeperDataUrl = cutout.dataUrl;
  }

  if (flyer1Res.status === 'fulfilled') {
    const cutout1 = buildFlyerHeadCutout(flyer1Res.value, 0.86);
    flyer1Canvas = cutout1.canvas;
    flyer1DataUrl = cutout1.dataUrl;
  }

  if (flyer2Res.status === 'fulfilled') {
    const cutout2 = buildFlyerHeadCutout(flyer2Res.value, 0.92);
    flyer2Canvas = cutout2.canvas;
    flyer2DataUrl = cutout2.dataUrl;
  }

  return {
    bedImage,
    sleeperCanvas,
    sleeperDataUrl,
    flyer1Canvas,
    flyer1DataUrl,
    flyer2Canvas,
    flyer2DataUrl,
  };
}
