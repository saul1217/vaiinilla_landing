// Canvas drawing for the one-tap games. Game shapes follow Android drawArcadeFrame;
// on top: a living night backdrop (parallax stars + café skyline), a scrolling
// ground, trails, falling Apila chunks and the mascot's squash & stretch.
import { ApilaGame, BrincaGame, FlappyGame, GravedadGame, type ArcadeGame, type ArcadeStatus } from './games';
import { drawFx, type Fx } from './fx';

export const WELL = '#0a0a0c';
const CONTROL = '#232427';
const INK = '#f5f2e8';
const MASCOT_BOX = 44;
const FEET = 0.777;

function svgPath(d: string): { d: string; path?: Path2D } {
  return { d };
}
// Path2D does not exist in jsdom; build on first draw.
function path(p: { d: string; path?: Path2D }) {
  p.path ??= new Path2D(p.d);
  return p.path;
}

const BODY = svgPath('M23.7 18.9Q25.3 17.1 26.19 17.91L29.39 20.85Q30.87 22.2 32.34 20.85L35.55 17.91Q36.43 17.1 37.32 17.91L40.53 20.85Q42 22.2 43.47 20.85L46.68 17.91Q47.56 17.1 48.45 17.91L51.66 20.85Q53.13 22.2 54.6 20.85L57.81 17.91Q58.7 17.1 59.07 18.24L59.64 19.94Q59.9 20.7 60.46 21.27L77.33 38.14Q77.9 38.7 77.9 39.5L77.9 67.3Q77.9 72.5 72.7 72.5L27.3 72.5Q22.1 72.5 22.1 67.3L22.1 25.9Q22.1 20.7 23.7 18.9Z');
const FOLD = svgPath('M59.9 20.7L59.9 33.1Q59.9 38.7 65.49 38.7L77.9 38.7Z');
const BAR_TOP = svgPath('M30 29.1a1.8 1.8 0 0 1 1.8-1.8h19.21a1.8 1.8 0 0 1 0 3.6H31.8A1.8 1.8 0 0 1 30 29.1Z');
const BAR_BOTTOM = svgPath('M29.85 36.15a1.65 1.65 0 0 1 1.65-1.65h12.09a1.65 1.65 0 0 1 0 3.3H31.5a1.65 1.65 0 0 1-1.65-1.65Z');
const EYE_LEFT = svgPath('M43.1 52.5C43.1 56.54 42.35 57.9 40.1 57.9C37.85 57.9 37.1 56.54 37.1 52.5C37.1 48.46 37.85 47.1 40.1 47.1C42.35 47.1 43.1 48.46 43.1 52.5Z');
const EYE_RIGHT = svgPath('M62.9 52.5C62.9 56.54 62.15 57.9 59.9 57.9C57.65 57.9 56.9 56.54 56.9 52.5C56.9 48.46 57.65 47.1 59.9 47.1C62.15 47.1 62.9 48.46 62.9 52.5Z');

interface RunnerPose {
  box: number;
  runPhase: number;
  airborne: boolean;
  lean: number;
  upsideDown: boolean;
  accent: string;
  sx?: number;
  sy?: number;
  /** 0..1 blink (eyes shut) — used on death. */
  dizzy?: boolean;
}

/** drawVaiinillaMascotRunner (MascotArt.kt), scaled around the feet for squash & stretch. */
export function drawRunner(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, pose: RunnerPose) {
  const { box, runPhase, airborne, lean, upsideDown, accent } = pose;
  const s = box / 100;
  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(pose.sx ?? 1, (pose.sy ?? 1) * (upsideDown ? -1 : 1));
  if (upsideDown) ctx.translate(0, box * (FEET - 0.41) * 2);
  ctx.translate(-box * 0.5, -box * FEET);
  ctx.translate(50 * s, 82 * s);
  ctx.rotate((lean * Math.PI) / 180);
  ctx.translate(-50 * s, -82 * s);
  ctx.scale(s, s);

  const swing = Math.sin(runPhase);
  const leftFoot: [number, number] = airborne ? [36.5, 72.4] : [39.75 + swing * 5.2, 77.65 - Math.max(0, -swing) * 4.6];
  const rightFoot: [number, number] = airborne ? [63.5, 71.4] : [60.25 - swing * 5.2, 77.65 - Math.max(0, swing) * 4.6];
  const arm = ((airborne ? -46 : swing * 30) * Math.PI) / 180;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  const limb = (x: number, y: number, tx: number, ty: number, width: number, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tx - x, ty - y);
    ctx.stroke();
    ctx.restore();
  };
  limb(24.1, 52.5, 16.49, 61.65, 7, -arm);
  limb(75.9, 52.5, 83.51, 61.65, 7, arm);
  limb(39.75, 70.5, leftFoot[0], leftFoot[1], 11.7);
  limb(60.25, 70.5, rightFoot[0], rightFoot[1], 11.7);

  ctx.fillStyle = INK;
  ctx.fill(path(BODY));
  ctx.fillStyle = accent;
  ctx.fill(path(FOLD));
  ctx.fill(path(BAR_TOP));
  ctx.fill(path(BAR_BOTTOM));
  if (pose.dizzy) {
    ctx.strokeStyle = WELL;
    ctx.lineWidth = 2.6;
    for (const cx of [40.1, 59.9]) {
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, 49);
      ctx.lineTo(cx + 3.5, 56);
      ctx.moveTo(cx + 3.5, 49);
      ctx.lineTo(cx - 3.5, 56);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = WELL;
    const eye = airborne ? 1.14 : 1;
    for (const [p, cx] of [
      [EYE_LEFT, 40.1],
      [EYE_RIGHT, 59.9],
    ] as const) {
      ctx.save();
      ctx.translate(cx, 52.5);
      ctx.scale(1, eye);
      ctx.translate(-cx, -52.5);
      ctx.fill(path(p));
      ctx.restore();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}

/** Android's dashed ground, now scrolling with the run. */
function dashedGround(ctx: CanvasRenderingContext2D, width: number, y: number, scroll: number) {
  ctx.strokeStyle = 'rgba(245, 242, 232, 0.28)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const offset = -(((scroll % 30) + 30) % 30);
  for (let x = 10 + offset; x < width - 10; x += 30) {
    const a = Math.max(10, x);
    const b = Math.min(x + 14, width - 10);
    if (b > a) {
      ctx.moveTo(a, y);
      ctx.lineTo(b, y);
    }
  }
  ctx.stroke();
}

// Deterministic hash so the backdrop is the same every frame.
const hash = (i: number, k: number) => {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(k | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Night sky: two parallax star layers, a low glow, and a café skyline far away. */
function backdrop(ctx: CanvasRenderingContext2D, width: number, height: number, scroll: number, time: number, accent: string, ground: number, lift = 0) {
  const glow = ctx.createLinearGradient(0, 0, 0, height);
  glow.addColorStop(0, '#0a0a0c');
  glow.addColorStop(1, '#141612');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  for (const [layer, speed, count, size] of [
    [1, 0.05, 26, 1],
    [2, 0.12, 14, 1.6],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const span = width + 40;
      const x = ((hash(i, layer) * span - scroll * speed) % span + span) % span - 20;
      const y = (hash(i, layer + 7) * height * 0.7 + lift * speed * 3) % height;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7));
      ctx.globalAlpha = tw * (layer === 1 ? 0.35 : 0.55);
      ctx.fillStyle = i % 9 === 0 ? accent : INK;
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.globalAlpha = 1;

  // skyline: cafés and a sign with a blinking dot
  const P = 180;
  const base = ground;
  const off = ((scroll * 0.22) % P + P) % P;
  ctx.fillStyle = '#15161a';
  for (let rep = -1; rep <= Math.ceil(width / P) + 1; rep++) {
    const x0 = rep * P - off;
    for (const [bx, bw, bh] of [
      [0, 34, 20],
      [38, 22, 30],
      [64, 40, 16],
      [108, 28, 36],
      [140, 36, 24],
    ] as const) {
      ctx.fillRect(x0 + bx, base - bh, bw, bh);
    }
    ctx.fillStyle = Math.sin(time * 3 + rep) > 0.2 ? accent : '#3a3f2a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x0 + 121, base - 42, 3, 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d1f22';
    for (let w = 0; w < 4; w++) if (hash(rep + 20, w) > 0.45) ctx.fillRect(x0 + 44 + w * 8, base - 11, 4, 4);
    ctx.fillStyle = '#15161a';
  }
}

export interface FrameState {
  game: ArcadeGame;
  status: ArcadeStatus | 'dying';
  width: number;
  height: number;
  runPhase: number;
  time: number;
  scroll: number;
  accent: string;
  fx: Fx;
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameState) {
  const { game, status, width, height, runPhase, time, scroll, accent, fx } = f;
  const box = MASCOT_BOX;
  const dying = status === 'dying' || status === 'dead';

  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

  const ground =
    game instanceof BrincaGame || game instanceof GravedadGame ? game.floorY(height) + 15 : game instanceof ApilaGame ? height - 22 + game.cam : height - 24;
  backdrop(ctx, width, height, game instanceof ApilaGame ? time * 8 : scroll, time, accent, ground, game instanceof ApilaGame ? game.cam : 0);

  // trail behind the mascot
  if (fx.trail.length > 1) {
    for (let i = 0; i < fx.trail.length; i++) {
      const t = fx.trail[i]!;
      ctx.globalAlpha = (i / fx.trail.length) * 0.35;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(t.x - (fx.trail.length - i) * 4, t.y, 2 + (i / fx.trail.length) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (game instanceof FlappyGame) {
    dashedGround(ctx, width, height - 24, scroll);
    for (const c of game.columns) {
      roundRect(ctx, c.x, -6, 46, c.gapTop + 6, 10, CONTROL);
      roundRect(ctx, c.x, c.gapTop + c.gap, 46, height - c.gapTop - c.gap - 18, 10, CONTROL);
      ctx.fillStyle = accent;
      ctx.fillRect(c.x + 5, c.gapTop - 6, 36, 5);
      ctx.fillRect(c.x + 5, c.gapTop + c.gap + 1, 36, 5);
    }
    const tilt = status === 'idle' ? 0 : Math.max(-29, Math.min(52, (game.vy / 600) * 57.2958));
    const bob = status === 'idle' ? Math.sin(time * 3.3) * 6 : 0;
    drawRunner(ctx, 70, game.y + bob + box * FEET * 0.5, { box, runPhase, airborne: true, lean: tilt, upsideDown: false, accent, sx: fx.sx, sy: fx.sy, dizzy: dying });
  } else if (game instanceof BrincaGame) {
    const gy = game.floorY(height) + 15;
    dashedGround(ctx, width, gy, scroll);
    for (const o of game.obstacles) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(o.x - 2, gy - 1, o.w + 4, 3);
      roundRect(ctx, o.x, gy - o.h, o.w, o.h, 4, INK);
      ctx.fillStyle = accent;
      ctx.fillRect(o.x + 2, gy - (o.h - 3), o.w - 4, 3);
    }
    // speed lines once it gets fast
    if (status === 'play' && game.speed > 220) {
      ctx.strokeStyle = 'rgba(245, 242, 232, 0.12)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const y = 40 + hash(i, 3) * (gy - 70);
        const x = ((hash(i, 4) * width - scroll * 1.6) % width + width) % width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 26, y);
        ctx.stroke();
      }
    }
    const air = game.y < game.floorY(height) - 0.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    const shadowW = Math.max(6, 16 - (game.floorY(height) - game.y) * 0.08);
    ctx.beginPath();
    ctx.ellipse(70, gy + 1, shadowW, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const tilt = Math.max(-30, Math.min(30, (game.vy / 1400) * 57.2958));
    drawRunner(ctx, 70, game.y + 15, { box, runPhase, airborne: air, lean: tilt, upsideDown: false, accent, sx: fx.sx, sy: fx.sy, dizzy: dying });
  } else if (game instanceof ApilaGame) {
    dashedGround(ctx, width, height - 22 + game.cam, 0);
    game.stack.forEach((b, i) => {
      const by = height - 46 - i * game.blockH + game.cam;
      if (by <= height + 20) {
        roundRect(ctx, b.x, by, b.w, game.blockH - 3, 4, i % 5 === 4 ? accent : INK);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(b.x + 2, by + game.blockH - 7, b.w - 4, 3);
      }
    });
    for (const c of fx.chunks) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(c.rot);
      roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 4, INK);
      ctx.restore();
    }
    if (game.fall) roundRect(ctx, game.fall.x, game.fall.y, game.fall.w, game.blockH - 3, 4, INK);
    const top = game.top();
    if (status !== 'idle') {
      const my = game.topY(height) - game.blockH - 24;
      if (!game.fall) {
        // drop guide
        ctx.fillStyle = 'rgba(184, 216, 107, 0.08)';
        ctx.fillRect(game.pos, my + game.blockH, top.w, 24);
        roundRect(ctx, game.pos, my, top.w, game.blockH - 3, 4, game.stack.length % 5 === 4 ? accent : INK);
      }
      drawRunner(ctx, game.pos + top.w / 2, my, { box: box * 0.8, runPhase, airborne: true, lean: 0, upsideDown: false, accent, sx: fx.sx, sy: fx.sy, dizzy: dying });
    } else {
      const bob = Math.sin(time * 3.3) * 3;
      drawRunner(ctx, width / 2, game.topY(height) - game.blockH + 4 + bob, { box: box * 0.85, runPhase, airborne: true, lean: 0, upsideDown: false, accent, sx: fx.sx, sy: fx.sy });
    }
  } else if (game instanceof GravedadGame) {
    const ceil = game.ceilY() - 16;
    const floor = game.floorY(height) + 15;
    ctx.strokeStyle = CONTROL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, ceil);
    ctx.lineTo(width - 10, ceil);
    ctx.stroke();
    dashedGround(ctx, width, floor, scroll);
    ctx.fillStyle = 'rgba(245, 242, 232, 0.86)';
    for (const o of game.obstacles) {
      const base = o.side > 0 ? floor : ceil;
      const n = Math.max(2, Math.floor(o.w / 14));
      const tip = o.side > 0 ? base - 20 : base + 20;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x0 = o.x + (o.w * i) / n;
        ctx.moveTo(x0, base);
        ctx.lineTo(x0 + o.w / n / 2, tip);
        ctx.lineTo(x0 + o.w / n, base);
      }
      ctx.fill();
    }
    const onCeil = game.gdir < 0;
    drawRunner(ctx, 70, game.y + (onCeil ? -14 : 15), { box, runPhase, airborne: game.vy !== 0, lean: 0, upsideDown: onCeil, accent, sx: fx.sx, sy: fx.sy, dizzy: dying });
  }

  drawFx(ctx, fx);
  ctx.restore();

  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.7, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
