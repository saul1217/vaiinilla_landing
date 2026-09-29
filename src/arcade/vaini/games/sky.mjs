// Shared sky for the games that climb through the day: dawn → day → sunset → night, with sun, moon and stars.
import { W, px, disc, ellipse, rect, gradient, glow, hash, mix, clamp01, lerp } from "../kit.mjs";

const KEYS = [
  { at: 0.0, c: ["#78b0d8", "#f2c4c0", "#ffd8a0", "#ffb488"] },   // dawn
  { at: 0.28, c: ["#5cb6e2", "#a4dcec", "#e4f2d0", "#fff0c0"] },  // day
  { at: 0.6, c: ["#54468e", "#cc6688", "#f6a070", "#ffd28c"] },   // sunset
  { at: 0.88, c: ["#080c2a", "#18205a", "#2c3878", "#5a4a8c"] },  // night
];

const smooth = (t) => t * t * (3 - 2 * t);

/** Time of day in [0,1] from progress: `span` is how many points it takes to reach full night. */
export const timeOfDay = (score, span) => clamp01(score / span);

export function skyColors(tod) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) if (tod >= KEYS[i].at && tod <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  if (tod >= KEYS[KEYS.length - 1].at) return KEYS[KEYS.length - 1].c;
  const f = smooth((tod - a.at) / (b.at - a.at));
  return a.c.map((c, i) => mix(c, b.c[i], f));
}

/** 0 in daylight, 1 at full night: used to dim scenery and light up windows. */
export const darkness = (tod) => smooth(clamp01((tod - 0.5) / 0.38));
export const warmth = (tod) => Math.sin(clamp01((tod - 0.42) / 0.3) * Math.PI);   // peaks at sunset

export function drawSky(cv, tod, y1 = 270) {
  const c = skyColors(tod);
  gradient(cv, [[0, c[0]], [Math.round(y1 * 0.34), c[1]], [Math.round(y1 * 0.66), c[2]], [y1, c[3]]]);
}

export function drawStars(cv, tod, t, ySpan = 200, seed = 5) {
  const d = darkness(tod);
  if (d < 0.08) return;
  for (let i = 0; i < 90; i++) {
    const x = hash(i, seed) * W, y = hash(i, seed + 1) * ySpan;
    const big = hash(i, seed + 2) > 0.9;
    const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(i, seed + 3) * 2) + i);
    px(cv, x, y, "#ffffff", d * tw);
    if (big && d * tw > 0.5) { px(cv, x - 1, y, "#ffffff", d * 0.4); px(cv, x + 1, y, "#ffffff", d * 0.4); px(cv, x, y - 1, "#ffffff", d * 0.4); px(cv, x, y + 1, "#ffffff", d * 0.4); }
  }
}

/** Sun rises on the left, moon takes over at night on the right. yShift lets the caller parallax them. */
export function drawCelestial(cv, tod, yShift = 0) {
  const d = darkness(tod);
  // sun follows an arc across the first 2/3 of the cycle
  const su = clamp01(tod / 0.66);
  const sx = lerp(70, 410, su), sy = 200 - Math.sin(su * Math.PI) * 150 + yShift;
  const warm = warmth(tod);
  const sunCol = mix("#fffbe0", "#ff9a5a", warm), halo = mix("#fff4c8", "#ff8a6a", warm);
  if (d < 0.95) {
    glow(cv, sx, sy, 46, halo, 0.35 * (1 - d), 1);
    disc(cv, sx, sy, 20, halo, 0.5 * (1 - d)); disc(cv, sx, sy, 15, sunCol, 1 - d * 0.9);
  }
  // moon
  if (d > 0.1) {
    const mx = 392, my = 62 + yShift * 0.6;
    glow(cv, mx, my, 40, "#c8d4ff", 0.28 * d, 1);
    disc(cv, mx, my, 15, "#e8ecf8", d); disc(cv, mx + 4, my - 2, 12, "#f8f9ff", d);
    for (const [dx, dy, r] of [[-5, 3, 3], [3, 6, 2], [-2, -5, 2]]) disc(cv, mx + dx, my + dy, r, "#c8cfe6", d * 0.9);
  }
}

/** A shooting star every few seconds at night. */
export function drawShootingStar(cv, tod, t) {
  const d = darkness(tod);
  if (d < 0.6) return;
  const period = 6.5, u = ((t % period) / period);
  if (u > 0.12) return;
  const k = u / 0.12, x = 380 - k * 260, y = 30 + k * 70;
  for (let i = 0; i < 14; i++) px(cv, x + i * 2.4, y - i * 1.2, "#ffffff", (1 - i / 14) * (1 - k * 0.6));
}

export { rect, ellipse };
