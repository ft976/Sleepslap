import {
  computeAimOrigin,
  computeRayTopEndpoint,
  getBedLayout,
} from './physics';
import type {
  FlyerEntity,
  HeadKey,
  Particle,
  StarburstEffect,
  WhooshEffect,
} from './types';

export type HeadImageSource = HTMLImageElement | HTMLCanvasElement;

export interface RenderState {
  width: number;
  height: number;
  timeSec: number;
  isAiming: boolean;
  aimAngleDeg: number;
  flyer: FlyerEntity | null;
  starburst: StarburstEffect;
  whoosh: WhooshEffect;
  particles: Particle[];
  shakeRemainingMs: number;
  shakeDurationMs: number;
  shakeAmplitudePx: number;
  headImages: Record<HeadKey, HeadImageSource>;
  bedImage?: HeadImageSource | null;
  sleepReboundTimerMs: number;
}

const INK_COLOR = '#161616';
const INK_WIDTH = 3.5;

function drawCutoutHead(
  ctx: CanvasRenderingContext2D,
  img: HeadImageSource,
  cx: number,
  cy: number,
  diameter: number,
  rotationRad = 0,
  flipX = false,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (rotationRad !== 0) ctx.rotate(rotationRad);
  if (flipX) ctx.scale(-1, 1);

  const w =
    img instanceof HTMLImageElement
      ? img.naturalWidth || diameter
      : img.width || diameter;
  const h =
    img instanceof HTMLImageElement
      ? img.naturalHeight || diameter
      : img.height || diameter;
  const aspect = w > 0 && h > 0 ? w / h : 1;

  let drawW = diameter;
  let drawH = diameter;
  if (aspect > 1) {
    drawH = diameter / aspect;
  } else {
    drawW = diameter * aspect;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function drawBedroomDecor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  layout: ReturnType<typeof getBedLayout>,
  recoilY: number
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Floor plane, baseboard trim & subtle wood floor seams behind the bed
  const floorY = layout.topY + layout.drawH * 0.625;
  ctx.fillStyle = '#E1DFDA';
  ctx.fillRect(0, floorY, width, height - floorY);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.045)';
  ctx.lineWidth = 1.5;
  for (let row = 1; row <= 4; row++) {
    const y = floorY + ((height - floorY) * row) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#C6C2B9';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(width, floorY);
  ctx.stroke();

  // 2. Cozy Night-Sky Bedroom Window with Curtains & Wooden Sill on the left wall
  const winW = 46;
  const winH = 54;
  const winX = Math.max(12, layout.leftX - 18);
  const winY = layout.topY + layout.drawH * 0.11;
  if (winX + winW < layout.leftX + layout.drawW * 0.25) {
    ctx.save();
    // Window night sky glass
    ctx.fillStyle = '#252E46';
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 5);
    ctx.fill();
    ctx.stroke();

    // Crescent moon & stars
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(winX + 22, winY + 21, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#252E46';
    ctx.beginPath();
    ctx.arc(winX + 25.5, winY + 18.5, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Stars (separate beginPath per star so arcs don't connect into a polygon)
    ctx.fillStyle = '#FFFBEB';
    for (const [sx, sy, sr] of [
      [winX + 33, winY + 14, 1.6],
      [winX + 14, winY + 34, 1.4],
      [winX + 31, winY + 36, 1.3],
      [winX + 16, winY + 14, 1.1],
    ] as const) {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Window pane crossbars
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH * 0.56);
    ctx.lineTo(winX + winW, winY + winH * 0.56);
    ctx.stroke();

    // Draped curtains on left & right edges
    ctx.fillStyle = '#C8BEB0';
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winX - 2, winY - 2);
    ctx.lineTo(winX + 10, winY - 2);
    ctx.quadraticCurveTo(winX + 6, winY + winH * 0.5, winX + 11, winY + winH);
    ctx.lineTo(winX - 2, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(winX + winW + 2, winY - 2);
    ctx.lineTo(winX + winW - 10, winY - 2);
    ctx.quadraticCurveTo(winX + winW - 6, winY + winH * 0.5, winX + winW - 11, winY + winH);
    ctx.lineTo(winX + winW + 2, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wooden window sill & curtain rod with finials
    ctx.fillStyle = '#624632';
    ctx.beginPath();
    ctx.roundRect(winX - 5, winY + winH - 2, winW + 10, 6, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(winX - 7, winY - 3);
    ctx.lineTo(winX + winW + 7, winY - 3);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#181818';
    for (const fx of [winX - 7, winX + winW + 7]) {
      ctx.beginPath();
      ctx.arc(fx, winY - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Cozy woven oval rug with braided ring & fringe tassels grounding the centered bed
  const rugCx = layout.leftX + layout.drawW * 0.51;
  const rugCy = layout.topY + layout.drawH * 0.835 + recoilY * 0.25;
  const rugRx = layout.drawW * 0.65;
  const rugRy = layout.drawH * 0.148;

  ctx.save();
  // Soft drop shadow
  ctx.beginPath();
  ctx.ellipse(rugCx + 2, rugCy + 4, rugRx, rugRy, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fill();

  // Rug fringe tassels on left & right sides
  ctx.strokeStyle = '#7E7467';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    const oy = i * 6;
    ctx.beginPath();
    ctx.moveTo(rugCx - rugRx + 2, rugCy + oy + 5);
    ctx.lineTo(rugCx - rugRx - 7, rugCy + oy + 6);
    ctx.moveTo(rugCx + rugRx - 2, rugCy + oy - 4);
    ctx.lineTo(rugCx + rugRx + 7, rugCy + oy - 5);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(rugCx, rugCy, rugRx, rugRy, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = '#D8D0C3';
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#181818';
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(rugCx, rugCy, rugRx * 0.86, rugRy * 0.8, -0.05, 0, Math.PI * 2);
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9E9384';
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.ellipse(rugCx, rugCy, rugRx * 0.68, rugRy * 0.6, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = '#CFC5B5';
  ctx.fill();
  ctx.restore();

  // 4. Compact Left Bedside Table / Stool with Late-Night Mug & Book Stack
  const stoolCx = Math.max(28, layout.leftX - 10);
  const stoolTopY = layout.topY + layout.drawH * 0.60 + recoilY * 0.6;
  if (stoolCx + 18 < layout.leftX + layout.drawW * 0.16) {
    ctx.save();
    // Soft floor shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.beginPath();
    ctx.ellipse(stoolCx, stoolTopY + 37, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 2.4;
    // Wooden legs (3-legged round bedside table)
    ctx.beginPath();
    ctx.moveTo(stoolCx - 11, stoolTopY + 5);
    ctx.lineTo(stoolCx - 14, stoolTopY + 36);
    ctx.moveTo(stoolCx + 11, stoolTopY + 5);
    ctx.lineTo(stoolCx + 14, stoolTopY + 36);
    ctx.moveTo(stoolCx, stoolTopY + 7);
    ctx.lineTo(stoolCx, stoolTopY + 38);
    ctx.stroke();

    // Tabletop rim + surface
    ctx.fillStyle = '#4B3424';
    ctx.beginPath();
    ctx.ellipse(stoolCx, stoolTopY + 5, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#624632';
    ctx.beginPath();
    ctx.ellipse(stoolCx, stoolTopY + 2, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Small comic book stack
    ctx.fillStyle = '#8FA3B5';
    ctx.beginPath();
    ctx.roundRect(stoolCx - 14, stoolTopY - 4, 15, 5, 1.5);
    ctx.fill();
    ctx.stroke();

    // Ceramic bedtime mug
    ctx.fillStyle = '#F4F1EA';
    ctx.beginPath();
    ctx.roundRect(stoolCx + 2, stoolTopY - 9, 9, 10, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stoolCx + 11.5, stoolTopY - 4, 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Seamlessly finish the right edge of the Nightstand & Alarm Clock in custom_bed.png
  const nsEdgeX = layout.leftX + layout.drawW - 1.5;
  const nsTopY = layout.topY + layout.drawH * 0.415 + recoilY;
  const nsLipBotY = layout.topY + layout.drawH * 0.448 + recoilY;
  const nsBotY = layout.topY + layout.drawH * 0.631 + recoilY;
  const nsExtW = 32;

  ctx.save();
  // Soft shadow under nightstand extension
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.beginPath();
  ctx.ellipse(nsEdgeX + nsExtW * 0.5, nsBotY + 3, nsExtW * 0.55, 5, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Complete the sliced red digital alarm clock (flush bevel without left seam)
  const clkTopY = layout.topY + layout.drawH * 0.373 + recoilY;
  const clkBotY = layout.topY + layout.drawH * 0.432 + recoilY;
  ctx.fillStyle = '#732623';
  ctx.beginPath();
  ctx.moveTo(nsEdgeX - 2, clkTopY);
  ctx.lineTo(nsEdgeX + 6, clkTopY + 2);
  ctx.lineTo(nsEdgeX + 6, clkBotY - 1);
  ctx.lineTo(nsEdgeX - 2, clkBotY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nsEdgeX, clkTopY);
  ctx.lineTo(nsEdgeX + 6, clkTopY + 2);
  ctx.lineTo(nsEdgeX + 6, clkBotY - 1);
  ctx.lineTo(nsEdgeX, clkBotY - 1);
  ctx.stroke();

  // Back right nightstand leg
  ctx.fillStyle = '#382518';
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(nsEdgeX + nsExtW - 8, nsBotY - 7, 5.5, 9, 2);
  ctx.fill();
  ctx.stroke();

  // Nightstand right side panel (flush fill on left, crisp ink only on outer edges)
  ctx.fillStyle = '#4A3324';
  ctx.beginPath();
  ctx.moveTo(nsEdgeX - 2, nsLipBotY);
  ctx.lineTo(nsEdgeX + nsExtW - 2, nsLipBotY - 4);
  ctx.lineTo(nsEdgeX + nsExtW - 2, nsBotY - 5);
  ctx.lineTo(nsEdgeX - 2, nsBotY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(nsEdgeX, nsLipBotY);
  ctx.lineTo(nsEdgeX + nsExtW - 2, nsLipBotY - 4);
  ctx.lineTo(nsEdgeX + nsExtW - 2, nsBotY - 5);
  ctx.lineTo(nsEdgeX, nsBotY);
  ctx.stroke();

  // Nightstand 3D tabletop surface + front bevel (matches custom_bed.png lip)
  ctx.fillStyle = '#6B4D39';
  ctx.beginPath();
  ctx.moveTo(nsEdgeX - 2, nsTopY);
  ctx.lineTo(nsEdgeX + nsExtW, nsTopY - 6);
  ctx.lineTo(nsEdgeX + nsExtW, nsTopY + 2);
  ctx.lineTo(nsEdgeX - 2, nsTopY + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#583E2D';
  ctx.beginPath();
  ctx.moveTo(nsEdgeX - 2, nsTopY + 5);
  ctx.lineTo(nsEdgeX + nsExtW, nsTopY + 1);
  ctx.lineTo(nsEdgeX + nsExtW, nsLipBotY - 4);
  ctx.lineTo(nsEdgeX - 2, nsLipBotY);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nsEdgeX, nsTopY);
  ctx.lineTo(nsEdgeX + nsExtW, nsTopY - 6);
  ctx.lineTo(nsEdgeX + nsExtW, nsLipBotY - 4);
  ctx.lineTo(nsEdgeX, nsLipBotY);
  ctx.stroke();
  ctx.restore();

  // 6. Warm Glowing Bedside Lamp with Pull-Chain sitting on the nightstand
  const lampX = nsEdgeX + nsExtW * 0.56;
  const lampBaseY = nsTopY;
  ctx.save();
  const glow = ctx.createRadialGradient(
    lampX,
    lampBaseY - 28,
    4,
    lampX,
    lampBaseY - 24,
    46
  );
  glow.addColorStop(0, 'rgba(255, 224, 130, 0.54)');
  glow.addColorStop(1, 'rgba(255, 224, 130, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lampX, lampBaseY - 24, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2.3;
  // Lamp base
  ctx.fillStyle = '#9C7A5B';
  ctx.beginPath();
  ctx.ellipse(lampX, lampBaseY, 8.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lamp stem
  ctx.beginPath();
  ctx.moveTo(lampX, lampBaseY - 2);
  ctx.lineTo(lampX, lampBaseY - 17);
  ctx.stroke();

  // Pull chain
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(lampX + 5, lampBaseY - 16);
  ctx.lineTo(lampX + 5, lampBaseY - 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(lampX + 5, lampBaseY - 8.5, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FCD34D';
  ctx.fill();

  // Conical warm lampshade
  ctx.lineWidth = 2.3;
  ctx.fillStyle = '#FDE6A6';
  ctx.beginPath();
  ctx.moveTo(lampX - 7.5, lampBaseY - 33);
  ctx.lineTo(lampX + 7.5, lampBaseY - 33);
  ctx.lineTo(lampX + 12.5, lampBaseY - 16);
  ctx.lineTo(lampX - 12.5, lampBaseY - 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 7. Small Potted Plant beside the nightstand on the floor
  const plantX = Math.min(width - 18, nsEdgeX + nsExtW + 17);
  const plantY = nsBotY + 14;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.beginPath();
  ctx.ellipse(plantX, plantY + 2, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6B8F71';
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2;
  for (const ang of [-0.5, -0.15, 0.22, 0.55]) {
    ctx.save();
    ctx.translate(plantX, plantY - 12);
    ctx.rotate(ang + Math.sin(timeSec * 1.6 + ang) * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, -8.5, 4, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#C97A57';
  ctx.beginPath();
  ctx.moveTo(plantX - 8.5, plantY - 12);
  ctx.lineTo(plantX + 8.5, plantY - 12);
  ctx.lineTo(plantX + 6, plantY + 2);
  ctx.lineTo(plantX - 6, plantY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 8. Cozy Fuzzy Slippers clearly visible on the front-center of the rug
  const slipX = layout.leftX + layout.drawW * 0.52;
  const slipY = layout.topY + layout.drawH * 0.89 + recoilY * 0.2;
  ctx.save();
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 2.2;
  for (const [ox, oy, rot] of [
    [0, 0, -0.22],
    [16, 6, -0.08],
  ] as const) {
    ctx.save();
    ctx.translate(slipX + ox, slipY + oy);
    ctx.rotate(rot);
    ctx.fillStyle = '#6F8091';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F2EFE9';
    ctx.beginPath();
    ctx.ellipse(-4, 0, 4.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // 9. Soft floating "Zzz" drift near the sleeper
  ctx.save();
  ctx.fillStyle = '#555555';
  ctx.font = '800 13px sans-serif';
  for (let i = 0; i < 2; i++) {
    const phase = (timeSec * 0.45 + i * 0.5) % 1;
    const zx = layout.faceCx + 36 + phase * 18;
    const zy = layout.faceCy - 32 - phase * 26;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.55;
    ctx.fillText(i === 0 ? 'z' : 'Z', zx, zy);
  }
  ctx.restore();

  ctx.restore();
}

function drawBedAndSleeper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  sleeperHead: HeadImageSource,
  bedImage: HeadImageSource | null | undefined,
  reboundProgress: number,
  isAiming: boolean,
  aimAngleDeg: number
) {
  const breath = Math.sin(timeSec * 2.2) * 1.8;
  const recoilY = Math.sin(reboundProgress * Math.PI) * 5;

  if (bedImage) {
    const imgW =
      bedImage instanceof HTMLImageElement
        ? bedImage.naturalWidth || 416
        : bedImage.width || 416;
    const imgH =
      bedImage instanceof HTMLImageElement
        ? bedImage.naturalHeight || 738
        : bedImage.height || 738;

    const layout = getBedLayout(width, height, imgH / imgW);

    drawBedroomDecor(ctx, width, height, timeSec, layout, recoilY);

    ctx.save();
    ctx.drawImage(
      bedImage,
      layout.leftX,
      layout.topY + recoilY,
      layout.drawW,
      layout.drawH
    );

    // Draw aiming ray emerging from the sleeping person's chest behind their face cutout
    if (isAiming) {
      drawAimingRay(ctx, width, height, aimAngleDeg);
    }

    // Replace the stick-figure's cartoon head on the pillow with the uploaded face cutout
    drawCutoutHead(
      ctx,
      sleeperHead,
      layout.faceCx,
      layout.faceCy + recoilY + breath * 0.45,
      layout.faceSize,
      Math.sin(timeSec * 1.4) * 0.025
    );
    ctx.restore();
    return;
  }

  const cx = width * 0.5;
  const baseY = height * 0.80;
  const scale = Math.min(width / 390, height / 760) * 1.05;

  ctx.save();
  ctx.translate(cx, baseY + recoilY);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft ground shadow under bed
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(2, 54, 128, 22, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fill();
  ctx.restore();

  // Isometric bed corners (top-left headboard -> bottom-right footboard)
  const hl = { x: -112, y: -32 }; // headboard left
  const hr = { x: -24, y: -64 }; // headboard right
  const fl = { x: 28, y: 42 };   // footboard left
  const fr = { x: 116, y: 10 };  // footboard right

  // 1. Black bed legs
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 6;
  const legs = [
    { x: hl.x + 6, y: hl.y + 24, len: 28 },
    { x: fl.x + 6, y: fl.y + 22, len: 28 },
    { x: fr.x - 6, y: fr.y + 22, len: 28 },
    { x: hr.x - 4, y: hr.y + 20, len: 22 },
  ];
  for (const leg of legs) {
    ctx.beginPath();
    ctx.moveTo(leg.x, leg.y);
    ctx.lineTo(leg.x, leg.y + leg.len);
    ctx.stroke();
  }

  // 2. Dark-gray headboard (#4A4A4A)
  ctx.beginPath();
  ctx.moveTo(hl.x, hl.y);
  ctx.lineTo(hl.x, hl.y - 54);
  ctx.quadraticCurveTo(hl.x + 4, hl.y - 62, hl.x + 12, hl.y - 64);
  ctx.lineTo(hr.x - 6, hr.y - 60);
  ctx.quadraticCurveTo(hr.x, hr.y - 60, hr.x, hr.y - 50);
  ctx.lineTo(hr.x, hr.y);
  ctx.closePath();
  ctx.fillStyle = '#4A4A4A';
  ctx.fill();
  ctx.lineWidth = INK_WIDTH;
  ctx.strokeStyle = INK_COLOR;
  ctx.stroke();

  // Headboard side thickness highlight
  ctx.beginPath();
  ctx.moveTo(hl.x, hl.y - 52);
  ctx.lineTo(hl.x - 8, hl.y - 48);
  ctx.lineTo(hl.x - 8, hl.y + 24);
  ctx.lineTo(hl.x, hl.y + 24);
  ctx.closePath();
  ctx.fillStyle = '#383838';
  ctx.fill();
  ctx.stroke();

  // 3. Mattress base & side skirt
  ctx.beginPath();
  ctx.moveTo(hl.x, hl.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fr.x, fr.y + 24);
  ctx.lineTo(fl.x, fl.y + 24);
  ctx.lineTo(hl.x, hl.y + 24);
  ctx.closePath();
  ctx.fillStyle = '#C4C4C4';
  ctx.fill();
  ctx.stroke();

  // Top mattress surface (under pillow)
  ctx.beginPath();
  ctx.moveTo(hl.x, hl.y);
  ctx.lineTo(hr.x, hr.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.closePath();
  ctx.fillStyle = '#F2F2F2';
  ctx.fill();
  ctx.stroke();

  // 4. Light-gray pillow (#D8D8D8) at top-left of bed
  ctx.beginPath();
  ctx.moveTo(hl.x + 14, hl.y - 2);
  ctx.quadraticCurveTo(hl.x + 48, hl.y - 28, hr.x - 2, hr.y - 6);
  ctx.quadraticCurveTo(hr.x + 14, hr.y + 12, hl.x + 42, hl.y + 18);
  ctx.quadraticCurveTo(hl.x + 14, hl.y + 14, hl.x + 14, hl.y - 2);
  ctx.closePath();
  ctx.fillStyle = '#D8D8D8';
  ctx.fill();
  ctx.stroke();

  // 5. Medium-gray blanket (#9E9E9E) covering lower 70% of bed
  const bTopL = { x: -64, y: -6 + breath * 0.35 };
  const bTopR = { x: 18, y: -36 + breath * 0.35 };
  ctx.beginPath();
  ctx.moveTo(bTopL.x, bTopL.y);
  ctx.quadraticCurveTo(-22, -26 + breath * 0.6, bTopR.x, bTopR.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fr.x, fr.y + 20);
  ctx.lineTo(fl.x, fl.y + 20);
  ctx.lineTo(fl.x, fl.y);
  ctx.lineTo(bTopL.x, bTopL.y + 22);
  ctx.closePath();
  ctx.fillStyle = '#9E9E9E';
  ctx.fill();
  ctx.stroke();

  // Blanket fold edge on top
  ctx.beginPath();
  ctx.moveTo(bTopL.x, bTopL.y);
  ctx.quadraticCurveTo(-22, -26 + breath * 0.6, bTopR.x, bTopR.y);
  ctx.lineTo(bTopR.x + 10, bTopR.y + 9);
  ctx.quadraticCurveTo(-14, -14 + breath * 0.6, bTopL.x + 8, bTopL.y + 12);
  ctx.closePath();
  ctx.fillStyle = '#B5B5B5';
  ctx.fill();
  ctx.stroke();

  // 6. Black stick-figure sleeping body drawn OVER the blanket
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = INK_WIDTH;

  // Neck & Spine
  ctx.beginPath();
  ctx.moveTo(-48, -22 + breath * 0.3);
  ctx.lineTo(14, 10 + breath * 0.4);
  ctx.stroke();

  // Outstretched legs over covers
  ctx.beginPath();
  // Leg 1
  ctx.moveTo(14, 10 + breath * 0.4);
  ctx.lineTo(58, 16);
  ctx.lineTo(68, 8);
  // Leg 2
  ctx.moveTo(14, 10 + breath * 0.4);
  ctx.lineTo(44, 28);
  ctx.lineTo(54, 21);
  ctx.stroke();

  // Bent arm resting on chest + shoulder
  ctx.beginPath();
  ctx.moveTo(-34, -14 + breath * 0.35);
  ctx.lineTo(-32, 6 + breath * 0.5);
  ctx.lineTo(-10, 4 + breath * 0.6);
  ctx.stroke();

  // Other arm tucked near pillow/head
  ctx.beginPath();
  ctx.moveTo(-36, -16 + breath * 0.35);
  ctx.lineTo(-18, -26 + breath * 0.4);
  ctx.lineTo(-26, -34 + breath * 0.35);
  ctx.stroke();

  // 7. Cutout Image 1: Sleeper Head resting on pillow
  drawCutoutHead(
    ctx,
    sleeperHead,
    -56,
    -38 + breath * 0.55,
    66,
    -0.18 + Math.sin(timeSec * 1.4) * 0.025
  );

  ctx.restore();
}

function drawFlyingStickFigure(
  ctx: CanvasRenderingContext2D,
  flyer: FlyerEntity,
  headImg: HeadImageSource
) {
  const dir = flyer.direction; // 1 = right, -1 = left
  const bobY = flyer.knockedOut ? 0 : Math.sin(flyer.bobPhase) * 4;
  const alpha = flyer.knockedOut
    ? Math.max(0, 1 - flyer.koElapsedMs / flyer.koDurationMs)
    : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(flyer.x, flyer.y + bobY);

  if (flyer.knockedOut) {
    ctx.rotate(flyer.koSpinRad * dir);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = INK_WIDTH;

  // Superman-style horizontal flying body:
  // Trailing torso and legs behind the neck (-dir), outstretched arms forward/downward (+dir)
  const neckX = dir * 10;
  const neckY = 2;
  const hipX = -dir * 26;
  const hipY = 6;

  // Trailing legs
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX - dir * 24, hipY - 5);
  ctx.lineTo(hipX - dir * 32, hipY - 2);
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX - dir * 22, hipY + 9);
  ctx.lineTo(hipX - dir * 30, hipY + 12);
  ctx.stroke();

  // Horizontal torso
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  // Two outstretched stick arms reaching forward/downward toward sleeper
  const hand1X = dir * 34;
  const hand1Y = 22;
  const hand2X = dir * 24;
  const hand2Y = 28;

  ctx.beginPath();
  ctx.moveTo(neckX - dir * 4, neckY + 2);
  ctx.lineTo(dir * 18, 12);
  ctx.lineTo(hand1X, hand1Y);

  ctx.moveTo(neckX - dir * 6, neckY + 4);
  ctx.lineTo(dir * 12, 17);
  ctx.lineTo(hand2X, hand2Y);
  ctx.stroke();

  // Small white cartoon gloved hands with black outlines
  for (const [hx, hy] of [
    [hand1X, hand1Y],
    [hand2X, hand2Y],
  ]) {
    ctx.beginPath();
    ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke();
  }

  // Cutout Head (flips 180° upside down during KO via parent ctx.rotate)
  drawCutoutHead(
    ctx,
    headImg,
    dir * 24,
    -6,
    56,
    0,
    dir === -1 && !flyer.knockedOut,
    alpha
  );

  ctx.restore();
}

function drawAimingRay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angleDeg: number
) {
  const origin = computeAimOrigin(width, height);
  const topEnd = computeRayTopEndpoint(origin, angleDeg);

  ctx.save();
  ctx.lineCap = 'round';

  // Crisp black dashed aiming line
  ctx.beginPath();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#222222';
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(topEnd.x, topEnd.y);
  ctx.stroke();

  // Origin ring anchor at sleeper's head/chest
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#222222';
  ctx.fill();

  ctx.restore();
}

function drawStarburst(
  ctx: CanvasRenderingContext2D,
  burst: StarburstEffect
) {
  if (!burst.active) return;

  const progress = Math.min(1, burst.elapsedMs / burst.durationMs);
  const scale = progress < 0.25 ? progress / 0.25 : 1 + (progress - 0.25) * 0.45;
  const alpha = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;

  ctx.save();
  ctx.translate(burst.x, burst.y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawSpikyPolygon = (
    spikes: number,
    outerR: number,
    innerR: number,
    fill: string,
    stroke: string | null,
    rotOffset: number
  ) => {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes + rotOffset;
      const jitter = ((i + burst.seed) % 3) * 0.08;
      const r = (i % 2 === 0 ? outerR : innerR) * (1 + jitter);
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };

  // Outer red/orange comic burst
  drawSpikyPolygon(11, 56, 26, '#FF4D2D', INK_COLOR, 0.15);
  // Middle bright orange-yellow burst
  drawSpikyPolygon(9, 41, 18, '#FFA800', null, 0.35);
  // Inner crisp yellow-white core
  drawSpikyPolygon(7, 25, 11, '#FFF3B0', null, 0.6);

  ctx.restore();
}

function drawWhoosh(ctx: CanvasRenderingContext2D, whoosh: WhooshEffect) {
  if (!whoosh.active) return;
  const progress = Math.min(1, whoosh.elapsedMs / whoosh.durationMs);
  const alpha = (1 - progress) * 0.55;
  const rad = (whoosh.angleDeg * Math.PI) / 180;

  ctx.save();
  ctx.translate(whoosh.originX, whoosh.originY);
  ctx.rotate(rad);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';

  const travelY = -120 - progress * 240;
  for (const offset of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(offset, travelY + 48);
    ctx.lineTo(offset, travelY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;

    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.shape === 'shard') {
      ctx.fillStyle = p.color;
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
      ctx.fill();
      ctx.stroke();
    } else if (p.shape === 'line') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  state: RenderState
): void {
  const { width, height } = state;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clean, solid soft light-gray background (#EAEAEA)
  ctx.fillStyle = '#EAEAEA';
  ctx.fillRect(0, 0, width, height);

  // Apply brief micro-shake (4px, 120ms) on impact
  if (state.shakeRemainingMs > 0 && state.shakeDurationMs > 0) {
    const intensity =
      (state.shakeRemainingMs / state.shakeDurationMs) * state.shakeAmplitudePx;
    const ox = (Math.random() * 2 - 1) * intensity;
    const oy = (Math.random() * 2 - 1) * intensity;
    ctx.translate(ox, oy);
  }

  // 1. Bottom Target: Bed, Aiming Ray (from sleeping person's chest), and Sleeper Cutout
  const reboundProgress =
    state.sleepReboundTimerMs > 0 ? 1 - state.sleepReboundTimerMs / 180 : 0;
  drawBedAndSleeper(
    ctx,
    width,
    height,
    state.timeSec,
    state.headImages.sleeper_head,
    state.bedImage,
    reboundProgress,
    state.isAiming,
    state.aimAngleDeg
  );

  // Fallback aiming ray when using procedural fallback bed
  if (!state.bedImage && state.isAiming) {
    drawAimingRay(ctx, width, height, state.aimAngleDeg);
  }

  // 3. Miss Air-Whoosh Trail
  drawWhoosh(ctx, state.whoosh);

  // 4. Flying Stick-Figure Slapper
  if (state.flyer) {
    const flyerHead = state.headImages[state.flyer.headKey];
    drawFlyingStickFigure(ctx, state.flyer, flyerHead);
  }

  // 5. Starburst Impact & Confetti Shards
  drawStarburst(ctx, state.starburst);
  drawParticles(ctx, state.particles);

  ctx.restore();
}
