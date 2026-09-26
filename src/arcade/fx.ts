// Juice for the one-tap games: particles, floating text, shake, flash and the
// mascot's squash & stretch. Pure state + canvas drawing, fed by game events.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  shape: 'dot' | 'square' | 'spark';
  rot: number;
  vr: number;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
  big: boolean;
}

export interface Chunk {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
}

export interface Fx {
  parts: Particle[];
  pops: Popup[];
  chunks: Chunk[];
  trail: { x: number; y: number }[];
  shake: number;
  flash: number;
  flashColor: string;
  /** Mascot scale: sx/sy spring back to 1. */
  sx: number;
  sy: number;
  vsx: number;
  vsy: number;
  scorePop: number;
  ring: { x: number; y: number; t: number } | null;
}

export function createFx(): Fx {
  return { parts: [], pops: [], chunks: [], trail: [], shake: 0, flash: 0, flashColor: '#ffffff', sx: 1, sy: 1, vsx: 0, vsy: 0, scorePop: 0, ring: null };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function burst(
  fx: Fx,
  x: number,
  y: number,
  count: number,
  opts: Partial<Pick<Particle, 'color' | 'size' | 'gravity' | 'shape'>> & { speed?: number; spread?: number; angle?: number; life?: number; colors?: string[] } = {},
) {
  const speed = opts.speed ?? 120;
  const spread = opts.spread ?? Math.PI * 2;
  const angle = opts.angle ?? -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * rand(0.4, 1);
    const life = (opts.life ?? 0.6) * rand(0.6, 1.1);
    fx.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      max: life,
      size: (opts.size ?? 3) * rand(0.6, 1.2),
      color: opts.colors ? opts.colors[i % opts.colors.length]! : opts.color ?? '#f5f2e8',
      gravity: opts.gravity ?? 260,
      shape: opts.shape ?? 'dot',
      rot: Math.random() * Math.PI,
      vr: rand(-10, 10),
    });
  }
  if (fx.parts.length > 260) fx.parts.splice(0, fx.parts.length - 260);
}

export function popup(fx: Fx, text: string, x: number, y: number, color = '#f5f2e8', big = false) {
  fx.pops.push({ text, x, y, life: big ? 1.2 : 0.8, color, big });
  if (fx.pops.length > 5) fx.pops.shift();
}

export function squash(fx: Fx, sx: number, sy: number) {
  fx.sx = sx;
  fx.sy = sy;
  fx.vsx = 0;
  fx.vsy = 0;
}

export function stepFx(fx: Fx, dt: number) {
  for (const p of fx.parts) {
    p.life -= dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 1.5 * dt;
    p.rot += p.vr * dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const pop of fx.pops) {
    pop.life -= dt;
    pop.y -= (pop.big ? 26 : 38) * dt;
  }
  fx.pops = fx.pops.filter((pop) => pop.life > 0);
  for (const c of fx.chunks) {
    c.vy += 1600 * dt;
    c.y += c.vy * dt;
    c.x += c.vx * dt;
    c.rot += c.vr * dt;
  }
  fx.chunks = fx.chunks.filter((c) => c.y < 600);
  fx.shake = Math.max(0, fx.shake - dt * 40);
  fx.flash = Math.max(0, fx.flash - dt * 2.6);
  fx.scorePop = Math.max(0, fx.scorePop - dt * 4);
  // critically-damped-ish spring back to 1
  const k = 520;
  const d = 22;
  fx.vsx += (k * (1 - fx.sx) - d * fx.vsx) * dt;
  fx.vsy += (k * (1 - fx.sy) - d * fx.vsy) * dt;
  fx.sx += fx.vsx * dt;
  fx.sy += fx.vsy * dt;
  if (fx.ring) {
    fx.ring.t += dt;
    if (fx.ring.t > 0.45) fx.ring = null;
  }
}

export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const p of fx.parts) {
    const a = Math.min(1, (p.life / p.max) * 1.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.shape === 'square') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      ctx.restore();
    } else if (p.shape === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * (p.life / p.max)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (fx.ring) {
    const u = fx.ring.t / 0.45;
    ctx.strokeStyle = `rgba(184, 216, 107, ${1 - u})`;
    ctx.lineWidth = 3 * (1 - u) + 1;
    ctx.beginPath();
    ctx.arc(fx.ring.x, fx.ring.y, 10 + u * 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  for (const pop of fx.pops) {
    const max = pop.big ? 1.2 : 0.8;
    const age = max - pop.life;
    const scale = pop.big ? Math.min(1, age * 7) * (1 + Math.max(0, 0.25 - age) * 1.2) : 1;
    ctx.globalAlpha = Math.min(1, pop.life * 3);
    ctx.save();
    ctx.translate(pop.x, pop.y);
    ctx.scale(scale, scale);
    ctx.font = `800 ${pop.big ? 20 : 14}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(pop.text, 1, 2);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}
