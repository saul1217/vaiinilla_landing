// Effects shared by every scene. All motion is periodic in the 10 s loop.
import { W, H, px, rect, disc, stroke, mulberry, TAU, clamp01, rgb } from "./raster.js";

export const DURATION = 10;

export const hash = (x, y) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Seconds since the most recent event (events repeat every 10 s). */
export const since = (t, times) => {
  let best = Infinity;
  for (const e of times) for (const k of [-10, 0, 10]) { const d = t - (e + k); if (d >= 0 && d < best) best = d; }
  return best;
};

/** Periodic phase in [0,1) that completes `cycles` whole cycles per loop. */
export const cyc = (t, cycles, off = 0) => (((t / DURATION) * cycles + off) % 1 + 1) % 1;
export const wave = (t, cycles, off = 0) => Math.sin(TAU * ((t / DURATION) * cycles + off));

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

/** Vertical gradient with Bayer dithering between colour stops [[y, hex], ...]. */
export function gradient(cv, stops, x0 = 0, x1 = W) {
  for (let k = 0; k < stops.length - 1; k++) {
    const [y0, c0] = stops[k], [y1, c1] = stops[k + 1];
    for (let y = y0; y < y1; y++) {
      const f = clamp01((y - y0) / (y1 - y0));
      for (let x = x0; x < x1; x++) px(cv, x, y, f > bayer(x, y) ? c1 : c0);
    }
  }
}

/** Soft light pool: blends toward `hex` with a radial falloff (warm lamps, fire, neon). */
export function glow(cv, cx, cy, r, hex, strength = 0.5, squashY = 1) {
  const [lr, lg, lb] = rgb(hex);
  const d = cv.data;
  for (let y = Math.max(0, Math.floor(cy - r * squashY)); y <= Math.min(H - 1, Math.ceil(cy + r * squashY)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const dist = Math.hypot(x - cx, (y - cy) / squashY) / r;
      if (dist >= 1) continue;
      // quantised falloff keeps the pixel-art banding
      const a = Math.round((1 - dist) ** 2 * 14) / 14 * strength;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, d[i] + (lr - d[i] * 0.4) * a);
      d[i + 1] = Math.min(255, d[i + 1] + (lg - d[i + 1] * 0.4) * a);
      d[i + 2] = Math.min(255, d[i + 2] + (lb - d[i + 2] * 0.4) * a);
    }
}

/** Multiply the whole frame toward a colour (night, dusk). */
export function grade(cv, fn) {
  const d = cv.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b, a] = fn(x, y);
    if (a <= 0) continue;
    const i = (y * W + x) * 4;
    d[i] += (r - d[i]) * a; d[i + 1] += (g - d[i + 1]) * a; d[i + 2] += (b - d[i + 2]) * a;
  }
}

/** Rain streaks falling on a slant. Speed chosen so each drop completes whole cycles per loop. */
export function rain(cv, t, { count = 160, seed = 1, x0 = 0, x1 = W, y0 = 0, y1 = H, len = 6, slant = 2, hex = "#9fb8ff", alpha = 0.55, cycles = 12 } = {}) {
  const r = mulberry(seed);
  for (let i = 0; i < count; i++) {
    const bx = x0 + r() * (x1 - x0), ph = r(), k = cycles + Math.floor(r() * 4);
    const u = cyc(t, k, ph);
    const y = y0 + u * (y1 - y0 + len) - len;
    const x = bx + u * slant * 10;
    stroke(cv, x, y, x - slant, y + len, 0.45, hex, alpha * (0.6 + r() * 0.4));
  }
}

/** Snow flakes drifting with sway. */
export function snow(cv, t, { count = 120, seed = 2, x0 = 0, x1 = W, y0 = 0, y1 = H, cycles = 2, hex = "#ffffff" } = {}) {
  const r = mulberry(seed);
  for (let i = 0; i < count; i++) {
    const bx = x0 + r() * (x1 - x0), ph = r(), k = cycles + Math.floor(r() * 2), big = r() > 0.8;
    const u = cyc(t, k, ph);
    const y = y0 + u * (y1 - y0);
    const x = bx + 4 * Math.sin(TAU * (u * 2 + ph));
    if (x < x0 || x >= x1) continue;
    px(cv, x, y, hex, 0.9);
    if (big) { px(cv, x + 1, y, hex, 0.6); px(cv, x, y + 1, hex, 0.6); }
  }
}

/** Steam / smoke wisps rising from (x, y). */
export function steam(cv, t, x, y, { puffs = 5, height = 22, hex = "#ffffff", alpha = 0.35, cycles = 5, width = 3, seed = 9 } = {}) {
  const r = mulberry(seed);
  for (let i = 0; i < puffs; i++) {
    const ph = i / puffs + r() * 0.05;
    const u = cyc(t, cycles, ph);
    const yy = y - u * height;
    const xx = x + Math.sin(TAU * (u * 1.2 + ph)) * width * u * 2;
    disc(cv, xx, yy, 1 + u * 2.2, hex, alpha * (1 - u));
  }
}

/** Twinkling points (fairy lights, stars, sparkles). */
export function twinkle(cv, t, points, { hex = "#fff2b0", cycles = 3 } = {}) {
  points.forEach(([x, y, ph, col], i) => {
    const v = 0.5 + 0.5 * Math.sin(TAU * ((t / DURATION) * (cycles + (i % 3)) + ph));
    px(cv, x, y, col || hex, 0.35 + v * 0.65);
    if (v > 0.85) { px(cv, x - 1, y, col || hex, 0.4); px(cv, x + 1, y, col || hex, 0.4); px(cv, x, y - 1, col || hex, 0.4); px(cv, x, y + 1, col || hex, 0.4); }
  });
}

// ---------- 3x5 pixel font ----------
const G = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "111101111100100", Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111",
  9: "111101111001110", ".": "000000000000010", ":": "000010000010000", "-": "000000111000000", "!": "010010010000010",
  "'": "010010000000000", " ": "000000000000000", "+": "000010111010000", "/": "001001010100100", "?": "110001010000010", "¡": "010000010010010",  "♥": "000101111111010",
};
const ACCENT = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N" };
/** Pixel text; `scale` enlarges each font pixel into a scale×scale block (titles, HUD). */
export function text(cv, s, x, y, hex, a = 1, scale = 1) {
  const dot = (i, j) => (scale === 1 ? px(cv, x + i, y + j, hex, a) : rect(cv, x + i * scale, y + j * scale, scale, scale, hex, a));
  for (let ch of s.toUpperCase()) {
    if (ACCENT[ch]) {
      // accent sits above the cap line: an acute stroke, or a tilde for Ñ
      if (ch === "Ñ") { dot(0, -2); dot(1, -2); dot(2, -2); }
      else { dot(1, -1); dot(2, -2); }
      ch = ACCENT[ch];
    }
    const g = G[ch] || G[" "];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") dot(i, j);
    x += 4 * scale;
  }
}

/** Width in pixels of a text run at a given scale. */
export const textWidth = (s, scale = 1) => (s.length * 4 - 1) * scale;

/** Mug with a handle; returns the rim centre for steam. */
export function mug(cv, x, y, body = "#e86b4a", hi = "#ff9a7a") {
  rect(cv, x, y - 7, 7, 7, body);
  rect(cv, x + 1, y - 7, 1, 6, hi);
  stroke(cv, x + 7, y - 5, x + 9, y - 3, 0.9, body);
  rect(cv, x + 1, y - 8, 5, 1, "#5a3420");
  return [x + 3.5, y - 9];
}

/** Potted plant with swaying leaves. */
export function plant(cv, t, x, y, { pot = "#c2703d", leaf = "#3f9a4a", leafHi = "#6cc36a", size = 1 } = {}) {
  rect(cv, x - 4 * size, y - 6 * size, 8 * size, 6 * size, pot);
  rect(cv, x - 5 * size, y - 7 * size, 10 * size, 2, "#d98a52");
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45 + 0.08 * wave(t, 2, i * 0.13);
    const len = (8 + (i % 3) * 3) * size;
    stroke(cv, x, y - 7 * size, x + Math.cos(a) * len, y - 7 * size + Math.sin(a) * len, 1.4, i % 2 ? leaf : leafHi);
  }
}
