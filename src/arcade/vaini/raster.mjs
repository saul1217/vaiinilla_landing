// Tiny deterministic pixel rasterizer: a 480x270 RGBA buffer with alpha blending.

export const W = 480;
export const H = 270;

export function createCanvas(w = W, h = H) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

const cache = new Map();
export function rgb(hex) {
  let c = cache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, c);
  }
  return c;
}

export function px(cv, x, y, hex, a = 1) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h || a <= 0) return;
  const [r, g, b] = rgb(hex);
  const i = (y * cv.w + x) * 4;
  const d = cv.data;
  if (a >= 1) {
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  } else {
    d[i] = d[i] + (r - d[i]) * a;
    d[i + 1] = d[i + 1] + (g - d[i + 1]) * a;
    d[i + 2] = d[i + 2] + (b - d[i + 2]) * a;
    d[i + 3] = 255;
  }
}

export function rect(cv, x, y, w, h, hex, a = 1) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(cv, x + i, y + j, hex, a);
}

export function disc(cv, cx, cy, r, hex, a = 1) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) px(cv, x, y, hex, a);
    }
}

export function ellipse(cv, cx, cy, rx, ry, hex, a = 1) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(cv, x, y, hex, a);
    }
}

/** Thick line with round caps (a capsule), used for arms, trunks, racket handles. */
export function stroke(cv, x0, y0, x1, y1, r, hex, a = 1) {
  const minX = Math.floor(Math.min(x0, x1) - r), maxX = Math.ceil(Math.max(x0, x1) + r);
  const minY = Math.floor(Math.min(y0, y1) - r), maxY = Math.ceil(Math.max(y0, y1) + r);
  const vx = x1 - x0, vy = y1 - y0, len2 = vx * vx + vy * vy || 1;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2));
      const dx = x - (x0 + vx * t), dy = y - (y0 + vy * t);
      if (dx * dx + dy * dy <= r * r) px(cv, x, y, hex, a);
    }
}

export function poly(cv, pts, hex, a = 1) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) px(cv, x, y, hex, a);
    }
}

/** Seeded PRNG so every frame and every loop is identical. */
export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
