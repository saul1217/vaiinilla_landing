// Shared drawing helpers for every arcade game: sprite flip, particles, HUD, palette.
import { W, H, px, rect, disc, ellipse, stroke, poly, createCanvas, TAU, clamp01, lerp, rgb } from "./raster.mjs";
import { drawVaini } from "./vaini.mjs";
import { hash, gradient, glow, text, textWidth } from "./lib.mjs";

export { W, H, px, rect, disc, ellipse, stroke, poly, createCanvas, TAU, clamp01, lerp, rgb, hash, gradient, glow, text, textWidth, drawVaini };

export const PAL = {
  cream: "#f5eede", creamShade: "#e2d6bb", lime: "#a6d62a", limeHi: "#c6ec52", limeShade: "#6e9e1c",
  ink: "#2a2030", coffee: "#5a3a26", terracotta: "#d9714a", moto: "#2f6fe0", mustard: "#e7b96a",
  leaf: "#3f9a4a", leafHi: "#6cc36a", coral: "#ff6a5a", pink: "#ff9db0", gold: "#ffe45c",
};

export const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, t) => hex(rgb(a).map((v, i) => lerp(v, rgb(b)[i], t)));

/** Copy the opaque pixels of `src` into `cv`, optionally mirrored vertically around the bottom row. */
export function blit(cv, src, x, y, { flipY = false } = {}) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const si = (j * src.w + i) * 4;
    if (src.data[si + 3] === 0) continue;
    const dx = x + i, dy = y + (flipY ? src.h - 1 - j : j);
    if (dx < 0 || dy < 0 || dx >= cv.w || dy >= cv.h) continue;
    const di = (dy * cv.w + dx) * 4;
    cv.data[di] = src.data[si]; cv.data[di + 1] = src.data[si + 1]; cv.data[di + 2] = src.data[si + 2]; cv.data[di + 3] = 255;
  }
}

const sprite = createCanvas(64, 64);
/** Vaini drawn upside down (feet on the ceiling). (x, y) is the same anchor drawVaini uses: the feet line. */
export function drawVainiUpsideDown(cv, x, y, pose) {
  sprite.data.fill(0);
  drawVaini(sprite, 32, 60, { ...pose, shadow: false });
  // sprite rows j map to y + (60 - j): the feet row lands on `y` and the body hangs below it
  blit(cv, sprite, Math.round(x - 32), Math.round(y - 3), { flipY: true });
}

// ---------- particles, popups, shake ----------
export const createFx = () => ({ parts: [], popups: [], shake: 0 });

export function burst(fx, x, y, n, { col = PAL.gold, speed = 60, life = 0.4, grav = 120, size = 1, up = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.random() * 0.5, s = speed * (0.5 + Math.random() * 0.7);
    fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: life * (0.7 + Math.random() * 0.5), max: life, col: Array.isArray(col) ? col[i % col.length] : col, grav, size });
  }
}
export function dashes(fx, x, y, dir = 1) {
  // the three lime "emotion" dashes from the character sheet
  for (let i = 0; i < 3; i++) fx.parts.push({ x: x + dir * 4, y: y + (i - 1) * 6, vx: dir * (45 + i * 8), vy: (i - 1) * 22, life: 0.32, max: 0.32, col: PAL.lime, grav: 0, size: 2, dash: true });
}

export function stepFx(fx, dt) {
  for (const p of fx.parts) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const p of fx.popups) { p.life -= dt; p.y -= 18 * dt; }
  fx.popups = fx.popups.filter((p) => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 3);
}

export function drawFx(cv, fx) {
  for (const p of fx.parts) {
    const a = clamp01(p.life / p.max * 1.4);
    if (p.dash) rect(cv, p.x, p.y, 5, 2, p.col, a);
    else if (p.size > 1) disc(cv, p.x, p.y, p.size, p.col, a);
    else px(cv, p.x, p.y, p.col, a);
  }
  for (const p of fx.popups) {
    const w = textWidth(p.text, 1);
    text(cv, p.text, Math.round(p.x - w / 2) + 1, Math.round(p.y) + 1, PAL.ink, 0.9);
    text(cv, p.text, Math.round(p.x - w / 2), Math.round(p.y), p.col || "#ffffff");
  }
}

export function popup(fx, s, x, y, col) { fx.popups.push({ text: s, x, y, life: 1, col }); }

// ---------- HUD ----------
export function bigText(cv, s, x, y, col, scale = 2, shadow = PAL.ink) {
  text(cv, s, x + scale, y + scale, shadow, 1, scale);
  text(cv, s, x, y, col, 1, scale);
}
export function centered(cv, s, y, col, scale = 1, shadow = PAL.ink) {
  bigText(cv, s, Math.round((W - textWidth(s, scale)) / 2), y, col, scale, shadow);
}

export function hudScore(cv, score, best, onLight = false) {
  // onLight: the score sits on a pale background (bus ceiling), so it is drawn dark with a white edge
  const s = String(Math.floor(score)), sc = 3;
  const face = onLight ? PAL.ink : "#ffffff", edge = onLight ? "#ffffff" : PAL.ink;
  bigText(cv, s, Math.round(W / 2 - textWidth(s, sc) / 2), 14, face, sc, edge);
  const b = "MEJOR " + best;
  text(cv, b, W - textWidth(b) - 8 + 1, 9, edge, 0.7);
  text(cv, b, W - textWidth(b) - 8, 8, face, 1);
}

/**
 * Small notice in the top-right corner ("NIVEL 3", "OLA 2"): slides in, holds, fades out.
 * `age` is seconds since it started; nothing is drawn once `age` passes `life`.
 */
export function cornerToast(cv, label, age, col = PAL.limeHi, y = 20, life = 2.2) {
  if (age < 0 || age > life) return;
  const inK = clamp01(age / 0.22), outK = clamp01((life - age) / 0.3), a = Math.min(inK, outK);
  const w = textWidth(label) + 12, slide = (1 - (1 - (1 - inK) ** 3)) * 26;
  const x = Math.round(W - w - 8 + slide);
  rect(cv, x, y, w, 13, "#1a1424", 0.78 * a); rect(cv, x, y, 2, 13, col, a);
  text(cv, label, x + 7, y + 4, col, a);
}

/** Rounded translucent panel. */
export function panel(cv, x, y, w, h, col = "#1a1424", a = 0.82) {
  rect(cv, x + 2, y, w - 4, h, col, a); rect(cv, x, y + 2, w, h - 4, col, a);
  rect(cv, x + 1, y + 1, w - 2, h - 2, col, a);
}

export function drawTitle(cv, t, title, hint) {
  // the title sits at the top so the hero and the scene stay visible
  centered(cv, title, 16, PAL.limeHi, 4, PAL.ink);
  const w = textWidth(hint, 1) + 22;
  panel(cv, Math.round((W - w) / 2), 58, w, 18);
  if (Math.sin(t * 5) > -0.3) centered(cv, hint, 63, "#ffffff", 1);
}

export function drawGameOver(cv, t, score, best, newBest) {
  panel(cv, 130, 78, 220, 118);
  centered(cv, "¡OUPS!", 88, PAL.coral, 2);
  centered(cv, String(Math.floor(score)), 112, "#ffffff", 4);
  centered(cv, newBest ? "¡NUEVO RECORD!" : "MEJOR " + best, 142, newBest ? PAL.gold : "#c8bfd8", 1);
  if (t > 0.7 && Math.sin(t * 5) > -0.3) centered(cv, "TOCA PARA OTRA", 168, "#ffffff", 1);
}

export { rng } from "./rng.mjs";
