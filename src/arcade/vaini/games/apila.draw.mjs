// Apila · a tower of café crates that climbs from the table through clouds and dusk into space. Vaini rides the swinging crate.
import { cornerToast, W, H, px, rect, disc, ellipse, stroke, poly, gradient, glow, hash, text, textWidth, PAL, mix, drawVaini, clamp01, lerp, bigText } from "../kit.mjs";
import { K, topY, levelOf } from "./apila.rules.mjs";
import { timeOfDay, skyColors, darkness, warmth, drawStars, drawShootingStar } from "./sky.mjs";

export const SPAN = 42;                          // blocks to reach full night
const CRATE = [
  ["#f0c98a", "#f8dba8", "#c9a066"], ["#e8805a", "#f29a7a", "#b85a38"], ["#5b8de0", "#86aef0", "#3a68b8"],
  ["#8fcf5a", "#b3e77e", "#66a03a"], ["#c8a8e8", "#dcc4f4", "#9a78c0"], ["#f0d060", "#f8e488", "#c8a83a"],
];
const easeOut = (t) => 1 - (1 - t) ** 3;
const SPACE = ["#04061a", "#0a1040", "#161a5a", "#2a2470"];

/** Sky palette: time of day first, then blended toward deep space with altitude. */
function palette(s) {
  const tod = timeOfDay(s.score, SPAN), c = skyColors(tod);
  const u = clamp01((s.cam - 260) / 760);
  return { tod, alt: u, cols: c.map((v, i) => mix(v, SPACE[i], u * 0.92)) };
}

const screenY = (s, wy, par) => wy + s.cam * par;

function cloudLayer(cv, s, pal, par, tint, seed, every, alpha = 1) {
  const d = Math.max(darkness(pal.tod), pal.alt * 0.8), warm = warmth(pal.tod) * (1 - pal.alt);
  const col = mix(mix("#ffffff", "#ffc0a0", warm * 0.85), "#3a4478", d * 0.85), under = mix(col, "#7a6a9a", 0.35);
  for (let i = 0; i < 30; i++) {
    const wy = 190 - i * every, y = screenY(s, wy, par);
    if (y < -20 || y > 290) continue;
    const k = 0.7 + hash(i, seed) * 0.8, x = ((hash(i, seed + 1) * 620 - s.t * (3 + hash(i, seed + 2) * 5)) % 620 + 620) % 620 - 70;
    const a = alpha * (1 - pal.alt * 0.9);
    if (a < 0.05) continue;
    ellipse(cv, x, y, 26 * k, 7 * k, col, 0.9 * a); ellipse(cv, x - 11 * k, y - 4 * k, 13 * k, 7 * k, col, 0.9 * a);
    ellipse(cv, x + 10 * k, y - 5 * k, 12 * k, 7 * k, col, 0.9 * a); ellipse(cv, x, y + 4 * k, 26 * k, 2.5 * k, under, 0.7 * a);
  }
  void tint;
}

function skyline(cv, s, pal) {
  const y0 = 236 + s.cam * 0.5;
  if (y0 > 330) return;
  const d = darkness(pal.tod);
  for (const [x, w, h, c] of [[0, 60, 46, "#9ab8a0"], [58, 40, 70, "#8aa88f"], [98, 64, 38, "#a4c0a8"], [160, 44, 60, "#8aa88f"], [204, 70, 44, "#9ab8a0"], [274, 46, 80, "#8aa88f"], [320, 60, 40, "#a4c0a8"], [380, 44, 62, "#9ab8a0"], [424, 60, 48, "#8aa88f"]]) {
    const col = mix(mix(c, "#ff9a70", warmth(pal.tod) * 0.25), "#10182c", d * 0.7);
    rect(cv, x, y0 - h, w, h + 60, col);
    for (let wy = y0 - h + 6; wy < y0 - 4; wy += 9) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
      const on = d > 0.3 ? hash(wx, wy) > 0.45 : hash(wx, wy) > 0.5 && d > 0;
      rect(cv, wx, wy, 4, 5, on ? "#ffe0a0" : mix("#6a8a80", "#10182c", d * 0.6), on ? 0.95 : 0.85);
    }
  }
  // lit signs on two towers at night
  if (d > 0.4) { glow(cv, 80, y0 - 60, 24, "#ff8ad0", 0.3 * d, 1); glow(cv, 296, y0 - 70, 24, "#7ad0ff", 0.3 * d, 1); }
}

function plane(cv, s, pal) {
  const y = screenY(s, -110, 0.55);
  if (y < -10 || y > 280 || pal.alt > 0.7) return;
  const x = ((s.t * 32) % 700) - 100;
  rect(cv, x - 8, y, 16, 3, "#f4f4f8"); rect(cv, x + 6, y - 1, 4, 2, "#f4f4f8"); poly(cv, [[x - 1, y], [x - 6, y - 5], [x - 3, y]], "#c8ccd8"); poly(cv, [[x - 8, y], [x - 12, y - 4], [x - 9, y]], "#c8ccd8");
  rect(cv, x - 2, y + 1, 5, 1, "#8fb8f0");
  for (let i = 1; i < 30; i++) px(cv, x - 10 - i * 2, y + 1, "#ffffff", 0.5 * (1 - i / 30));
}

function balloons(cv, s, pal) {
  for (const [wx, wy, k] of [[110, -210, 1], [370, -380, 0.8], [230, -560, 0.9]]) {
    const y = screenY(s, wy, 0.5) + Math.sin(s.t * 0.8 + wx) * 4, x = wx + Math.sin(s.t * 0.3 + wy) * 6;
    if (y < -30 || y > 300 || pal.alt > 0.85) continue;
    const a = 1 - pal.alt;
    for (let i = -3; i <= 3; i++) ellipse(cv, x + i * 4 * k, y, 6 * k, 14 * k, i % 2 ? PAL.cream : PAL.lime, a);
    ellipse(cv, x, y, 13 * k, 14 * k, PAL.coral, 0.25 * a); rect(cv, x - 4 * k, y + 15 * k, 8 * k, 5 * k, "#8a5a38", a);
    if (darkness(pal.tod) > 0.3) glow(cv, x, y + 17 * k, 14, "#ffcf7a", 0.5 * darkness(pal.tod), 1);
  }
}

function aurora(cv, s, pal) {
  const u = clamp01((pal.alt - 0.25) / 0.5) * darkness(pal.tod + 0.2);
  if (u < 0.05) return;
  for (let x = 0; x < W; x += 2) {
    const base = 96 + Math.sin(x * 0.02 + s.t * 0.5) * 20 + Math.sin(x * 0.05 - s.t * 0.9) * 8, hh = 46 + Math.sin(x * 0.03 + s.t) * 14;
    for (let y = base; y < base + hh; y += 2) px(cv, x, y, mix("#7affc0", "#b58aff", clamp01((y - base) / hh)), 0.16 * u * (1 - (y - base) / hh));
    px(cv, x, base, "#b0ffe0", 0.22 * u);
  }
}

function planets(cv, s, pal) {
  const u = clamp01((pal.alt - 0.32) / 0.3);
  if (u < 0.05) return;
  // ringed planet
  const px0 = 372, py0 = screenY(s, -150, 0.22);
  if (py0 > -40 && py0 < 320) {
    ellipse(cv, px0, py0, 22, 5, "#d9b88a", 0.0);
    disc(cv, px0, py0, 16, "#e8b070", u); disc(cv, px0 + 4, py0 - 3, 12, "#f4c890", u * 0.9);
    for (let i = -14; i <= 14; i += 7) rect(cv, px0 - 14, py0 + i * 0.6, 28, 1, "#c98a58", u * 0.5);
    for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2, x = px0 + Math.cos(t) * 30, y = py0 + Math.sin(t) * 7; if (Math.sin(t) > 0 || Math.abs(x - px0) > 16) px(cv, x, y, "#f0d8a8", u * 0.85), px(cv, x, y + 1, "#c9a878", u * 0.6); }
  }
  // small blue-green planet
  const qy = screenY(s, -120, 0.3);
  if (qy > -20 && qy < 300) { disc(cv, 90, qy, 9, "#3a78e0", u); disc(cv, 87, qy - 2, 5, "#5ad0a0", u * 0.8); disc(cv, 93, qy + 3, 3, "#f4f4ff", u * 0.7); }
  // satellite
  const sy = screenY(s, -280, 0.4), sx = ((s.t * 14) % 620) - 60;
  if (sy > 0 && sy < 270) { rect(cv, sx, sy, 5, 3, "#c8ccd8", u); rect(cv, sx - 6, sy, 5, 2, "#5b8de0", u); rect(cv, sx + 6, sy, 5, 2, "#5b8de0", u); px(cv, sx + 2, sy - 2, "#ff6a5a", u * (Math.sin(s.t * 6) > 0 ? 1 : 0.2)); }
}

function table(cv, s) {
  const y = K.GROUND + s.cam;
  if (y > 300) return;
  rect(cv, 0, y, W, 10, "#a8703f"); rect(cv, 0, y, W, 2, "#d19a62"); rect(cv, 0, y + 8, W, 2, "#7a4a28");
  for (let x = 0; x < W; x += 40) rect(cv, x + 12, y + 3, 24, 1, "#8a5a32");
  rect(cv, 0, y + 10, W, 60, "#7a4a28"); rect(cv, 70, y + 10, 12, 80, "#5a3418"); rect(cv, 400, y + 10, 12, 80, "#5a3418");
  rect(cv, 24, y - 12, 14, 12, "#e86b4a"); rect(cv, 25, y - 12, 3, 11, "#ff9a7a"); stroke(cv, 39, y - 8, 44, y - 5, 1.4, "#e86b4a");
  for (let k = 0; k < 3; k++) { const u = ((s.t * 0.7 + k / 3) % 1); disc(cv, 31 + Math.sin(u * 6 + k) * 2, y - 14 - u * 16, 1.2 + u * 1.6, "#ffffff", 0.4 * (1 - u)); }
  rect(cv, 440, y - 10, 16, 10, PAL.terracotta);
  for (const [dx, len, c] of [[-4, 14, PAL.leaf], [0, 18, PAL.leafHi], [4, 13, PAL.leaf]]) stroke(cv, 448, y - 10, 448 + dx, y - 10 - len, 1.6, c);
}

function crate(cv, x, y, w, hue, alpha = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w);
  const [c, hi, sh] = CRATE[hue % CRATE.length];
  rect(cv, x, y, w, K.BH, "#3a2a20", 0.55 * alpha);
  rect(cv, x + 1, y + 1, w - 2, K.BH - 2, c, alpha); rect(cv, x + 1, y + 1, w - 2, 2, hi, alpha);
  rect(cv, x + 1, y + K.BH - 3, w - 2, 2, sh, alpha); rect(cv, x + w - 3, y + 1, 2, K.BH - 2, sh, alpha);
  if (w > 26) { rect(cv, x + 6, y + 4, 3, K.BH - 6, PAL.lime, alpha); rect(cv, x + 6, y + 4, 1, K.BH - 6, PAL.limeHi, alpha); }
  if (w > 46) { rect(cv, x + w - 16, y + 5, 8, 6, PAL.cream, alpha); rect(cv, x + w - 15, y + 7, 6, 1, sh, alpha); }
}

function player(cv, s) {
  let x, y, pose;
  if (s.over) {
    const d = s.lastDrop || { x: 200, w: 60 };
    x = d.x + d.w / 2; y = topY(s) - K.BH + 520 * s.deadT * s.deadT;
    pose = { armL: 2.6, armR: 2.6, blink: true, blush: 0, lookX: 0 };
  } else {
    const c = s.cur, dropping = s.drop, base = topY(s) - K.BH;
    if (dropping) { x = dropping.x + dropping.w / 2; y = base - K.HOVER * (1 - clamp01(dropping.t / K.DROP_TIME) ** 2); }
    else { x = c ? c.x + c.w / 2 : 240; y = base - K.HOVER; }
    const from = clamp01(s.hop / 0.32);
    if (!dropping && s.hop < 0.32) y += (K.BH + K.HOVER) * (1 - easeOut(from)) - Math.sin(from * Math.PI) * 14;
    pose = { armL: 1.0 + Math.sin(s.t * 4) * 0.2, armR: 1.0 - Math.sin(s.t * 4) * 0.2, blink: false, blush: 0.4 + clamp01(s.combo / 3), lookX: c && c.dir ? c.dir : 1, legH: s.hop < 0.1 ? 4 : 6 };
  }
  drawVaini(cv, x, y + s.cam, { ...pose, shadow: false, legH: pose.legH ?? 6 });
}

export function drawHudExtras(cv, s) {
  const label = "NIV " + s.level;
  rect(cv, 8, 8, textWidth(label) + 10, 13, "#1a1424", 0.6);
  text(cv, label, 13, 12, PAL.gold);
  if (s.level > 1) cornerToast(cv, "NIVEL " + s.level, s.levelT, PAL.gold);
  if (s.combo >= 2) { const c = "PERFECTOS x" + s.combo; rect(cv, 8, 24, textWidth(c) + 10, 13, "#1a1424", 0.6); text(cv, c, 13, 28, "#ffffff"); }
}

export function draw(cv, s) {
  const pal = palette(s);
  gradient(cv, [[0, pal.cols[0]], [90, pal.cols[1]], [180, pal.cols[2]], [270, pal.cols[3]]]);
  drawStars(cv, Math.max(pal.tod, 0.5 + pal.alt * 0.5), s.t, 200, 5);
  drawShootingStar(cv, Math.max(pal.tod, pal.alt), s.t);
  // sun / moon (moon takes over as it darkens)
  const dk = darkness(pal.tod), hy = 64 + s.cam * 0.05;
  if (dk < 0.9 && pal.alt < 0.8) { glow(cv, 400, hy, 40, mix("#fff4c8", "#ff8a6a", warmth(pal.tod)), 0.3 * (1 - dk), 1); disc(cv, 400, hy, 14, mix("#fffbe6", "#ff9a5a", warmth(pal.tod)), 1 - dk); }
  const mo = Math.max(dk, pal.alt);
  if (mo > 0.1) { glow(cv, 400, hy, 40, "#c8d4ff", 0.25 * mo, 1); disc(cv, 400, hy, 15, "#e8ecf8", mo); disc(cv, 404, hy - 2, 12, "#f8f9ff", mo); for (const [dx, dy, r] of [[-5, 3, 3], [3, 6, 2], [-2, -5, 2]]) disc(cv, 400 + dx, hy + dy, r, "#c8cfe6", mo * 0.9); }
  aurora(cv, s, pal); planets(cv, s, pal);
  cloudLayer(cv, s, pal, 0.4, 0, 3, 46, 0.55); balloons(cv, s, pal); plane(cv, s, pal);
  skyline(cv, s, pal);
  cloudLayer(cv, s, pal, 0.62, 0, 9, 58, 0.9);
  table(cv, s);
  s.stack.forEach((b, i) => crate(cv, b.x, K.GROUND - (i + 1) * K.BH + s.cam, b.w, b.hue));
  for (const p of s.pieces) crate(cv, p.x, p.y + s.cam, p.w, p.hue, 0.95);
  if (s.cur) crate(cv, s.cur.x, topY(s) - K.BH - K.HOVER + s.cam, s.cur.w, s.cur.hue);
  if (s.drop) crate(cv, s.drop.x, topY(s) - K.BH - K.HOVER * (1 - clamp01(s.drop.t / K.DROP_TIME) ** 2) + s.cam, s.drop.w, s.drop.hue);
  player(cv, s);
}
