// Vuela · a whole day over the café valley: dawn, day, sunset, night. Vaini hangs from a coral balloon; the pillars are giant pencils.
import { cornerToast, W, H, px, rect, disc, ellipse, stroke, poly, glow, hash, text, textWidth, PAL, mix, drawVaini, clamp01, lerp, bigText, centered } from "../kit.mjs";
import { K, levelOf } from "./flappy.rules.mjs";
import { timeOfDay, drawSky, drawStars, drawCelestial, drawShootingStar, darkness, warmth } from "./sky.mjs";

export const SPAN = 46;                      // points to reach full night
const off = (s, par, P) => (((s.dist * par) % P) + P) % P;
const dim = (c, d, amt = 0.62) => mix(c, "#0a1030", d * amt);
const tint = (c, tod) => mix(dim(c, darkness(tod)), "#ff8a5a", warmth(tod) * 0.28);

function mountains(cv, s, tod) {
  const P = 640, o = off(s, 0.05, P), d = darkness(tod);
  for (let x = 0; x < W; x++) {
    const u = (x + o) / P * Math.PI * 2;
    const h = 150 + Math.sin(u * 2 + 0.6) * 26 + Math.sin(u * 5) * 9 + Math.abs(Math.sin(u * 3.3)) * 18;
    const top = Math.floor(238 - (238 - h) * 0.9 - 40 + 40);
    for (let y = Math.floor(h); y < 200; y++) px(cv, x, y, tint(y < h + 5 && h < 150 ? "#f4f6ff" : "#8d9cc4", tod));
    if (h < 140) for (let y = Math.floor(h); y < h + 6; y++) px(cv, x, y, tint("#f4f6ff", tod));
    void top;
  }
  void d;
}

function clouds(cv, s, tod) {
  const d = darkness(tod), warm = warmth(tod);
  const col = mix(mix("#ffffff", "#ffc0a0", warm * 0.85), "#3a4478", d * 0.85), under = mix(col, "#7a6a9a", 0.35);
  for (const [par, P, list] of [[0.07, 560, [[40, 44, 1], [210, 70, 0.8], [340, 30, 1.15], [500, 60, 0.9]]], [0.13, 480, [[100, 88, 0.7], [300, 56, 0.6], [440, 100, 0.75]]]]) {
    const o = off(s, par, P);
    for (const [cx, cy, k] of list) for (const rep of [-1, 0, 1]) {
      const x = cx - o + rep * P;
      if (x < -50 || x > W + 50) continue;
      ellipse(cv, x, cy, 26 * k, 8 * k, col, 0.92); ellipse(cv, x - 12 * k, cy - 4 * k, 14 * k, 8 * k, col, 0.92);
      ellipse(cv, x + 10 * k, cy - 6 * k, 12 * k, 8 * k, col, 0.92); ellipse(cv, x, cy + 4 * k, 26 * k, 3 * k, under, 0.8);
    }
  }
}

function balloonFar(cv, s, tod) {
  const P = 900, x = 700 - off(s, 0.09, P) + 0, y = 92 + Math.sin(s.t * 0.7) * 5;
  const xx = x > -60 ? x : x + P;
  if (xx < -40 || xx > W + 40) return;
  const d = darkness(tod);
  for (let i = -3; i <= 3; i++) ellipse(cv, xx + i * 4, y, 6, 14, i % 2 ? tint(PAL.cream, tod) : tint(PAL.lime, tod));
  ellipse(cv, xx, y, 13, 14, tint(PAL.terracotta, tod), 0.35);
  rect(cv, xx - 4, y + 15, 8, 5, tint("#8a5a38", tod));
  stroke(cv, xx - 4, y + 12, xx - 3, y + 15, 0.4, "#5a4a3a"); stroke(cv, xx + 4, y + 12, xx + 3, y + 15, 0.4, "#5a4a3a");
  if (d > 0.3) glow(cv, xx, y + 16, 12, "#ffcf7a", 0.5 * d, 1);
}

function birds(cv, s, tod) {
  if (darkness(tod) > 0.55) return;
  const a = 1 - darkness(tod) * 1.6;
  for (let i = 0; i < 6; i++) {
    const x = ((i * 47 + 500 - s.t * (26 + i * 2) - s.dist * 0.12) % 620 + 620) % 620 - 60, y = 60 + (i % 3) * 14 + Math.sin(s.t * 1.4 + i) * 5;
    const f = Math.sin(s.t * 9 + i * 1.7) > 0 ? 2 : -1;
    px(cv, x, y, "#3a3a50", a); px(cv, x - 1, y + f, "#3a3a50", a); px(cv, x - 2, y + f * 1.5, "#3a3a50", a); px(cv, x + 1, y + f, "#3a3a50", a); px(cv, x + 2, y + f * 1.5, "#3a3a50", a);
  }
}

function hills(cv, s, tod) {
  for (const [par, base, amp, seed, c1, c2] of [[0.18, 178, 12, 1, "#b9dc9a", "#a3d08a"], [0.32, 202, 9, 2, "#8cc476", "#7ab866"]]) {
    const P = 480, o = off(s, par, P);
    for (let x = 0; x < W; x++) {
      const u = (x + o) / P * Math.PI * 2, h = base + Math.sin(u * 2 + seed) * amp + Math.sin(u * 5 + seed * 2) * 4;
      for (let y = Math.floor(h); y < 246; y++) px(cv, x, y, tint(y < h + 2 ? c1 : c2, tod));
    }
  }
}

function windmill(cv, s, tod) {
  const P = 700, x0 = 260 - off(s, 0.28, P), x = x0 < -30 ? x0 + P : x0;
  if (x < -30 || x > W + 30) return;
  const by = 200 + Math.sin(((x + off(s, 0.28, P)) / 480) * Math.PI * 4) * 0;
  poly(cv, [[x - 6, by], [x + 6, by], [x + 3, by - 30], [x - 3, by - 30]], tint("#efe2c8", tod));
  poly(cv, [[x - 6, by - 30], [x + 6, by - 30], [x, by - 38]], tint("#c9614a", tod));
  for (let k = 0; k < 4; k++) {
    const a = s.t * 1.1 + (k * Math.PI) / 2;
    stroke(cv, x, by - 30, x + Math.cos(a) * 20, by - 30 + Math.sin(a) * 20, 0.9, tint("#f4f0e4", tod));
    stroke(cv, x + Math.cos(a) * 10, by - 30 + Math.sin(a) * 10, x + Math.cos(a) * 20, by - 30 + Math.sin(a) * 20, 1.8, tint("#d8d0c0", tod), 0.85);
  }
  disc(cv, x, by - 30, 1.6, "#5a4a3a");
}

function town(cv, s, tod) {
  const P = 300, o = off(s, 0.55, P), d = darkness(tod);
  const houses = [[0, 46, 34, "#e9c79a", "#c9614a"], [58, 40, 46, "#f2dcc0", "#8a5a4a"], [112, 56, 30, "#e8b98a", "#b04a3a"], [178, 44, 40, "#f0d4a8", "#6a8a5a"], [232, 52, 36, "#ecc9a0", "#c9614a"]];
  for (let rep = -1; rep <= 2; rep++) for (const [hx, hw, hh, wall, roof] of houses) {
    const x0 = Math.round(hx + rep * P - o);
    if (x0 > W || x0 + hw < 0) continue;
    const y0 = 246 - hh, seed = (hx + rep * 3) | 0;
    rect(cv, x0, y0, hw, hh, tint(wall, tod)); rect(cv, x0 + hw - 4, y0, 4, hh, tint(mix(wall, "#000000", 0.12), tod));
    poly(cv, [[x0 - 3, y0], [x0 + hw / 2, y0 - 12], [x0 + hw + 3, y0]], tint(roof, tod));
    const lit = d > 0.35 && hash(seed, 3) > 0.25;
    rect(cv, x0 + 6, y0 + 10, 7, 8, lit ? "#ffd98a" : tint("#7ab8d8", tod));
    if (lit) glow(cv, x0 + 9, y0 + 14, 12, "#ffd98a", 0.35 * d, 1);
    if (hw > 44) { const lit2 = d > 0.35 && hash(seed, 4) > 0.4; rect(cv, x0 + hw - 18, y0 + 10, 7, 8, lit2 ? "#ffd98a" : tint("#ffd98a", tod)); if (lit2) glow(cv, x0 + hw - 14, y0 + 14, 12, "#ffd98a", 0.35 * d, 1); }
    rect(cv, x0 + hw / 2 - 3, 246 - 14, 6, 14, tint("#7a5232", tod));
    if (hash(seed, 6) > 0.55) {                                  // chimney with smoke
      rect(cv, x0 + hw - 12, y0 - 10, 5, 9, tint("#8a5a4a", tod));
      for (let k = 0; k < 4; k++) { const u = ((s.t * 0.5 + k / 4 + hash(seed, 9)) % 1); disc(cv, x0 + hw - 9 + Math.sin(u * 6 + k) * 3, y0 - 12 - u * 22, 1.5 + u * 2, tint("#ffffff", tod), 0.35 * (1 - u)); }
    }
  }
}

function ground(cv, s, tod) {
  const d = darkness(tod);
  rect(cv, 0, 246, W, 24, tint("#6bb04f", tod)); rect(cv, 0, 246, W, 3, tint(PAL.limeHi, tod)); rect(cv, 0, 249, W, 1, tint(PAL.limeShade, tod));
  rect(cv, 0, 252, W, 18, tint("#5a9a44", tod));
  const o = off(s, 1, 24);
  for (let x = -24; x < W + 24; x += 24) {
    poly(cv, [[x - o, 270], [x - o + 12, 254], [x - o + 24, 270]], tint("#4e8a3c", tod));
    rect(cv, x - o + 3, 247, 2, 3, tint(PAL.limeShade, tod)); rect(cv, x - o + 15, 246, 2, 4, tint(PAL.limeShade, tod));
  }
  // little flowers
  const of = off(s, 1, 96);
  for (let x = -96; x < W + 96; x += 96) for (const [dx, c] of [[20, "#ff8a9a"], [58, "#ffe45c"], [84, "#ffffff"]]) { px(cv, x + dx - of, 245, tint(c, tod)); px(cv, x + dx - of, 246, tint(PAL.leaf, tod)); }
  // street lamps that light up at dusk
  const P = 320, ol = off(s, 1, P);
  for (let rep = -1; rep <= 2; rep++) {
    const x = Math.round(70 + rep * P - ol);
    if (x < -20 || x > W + 20) continue;
    rect(cv, x, 214, 2, 32, "#2a2030"); rect(cv, x - 3, 212, 8, 3, "#2a2030");
    rect(cv, x - 2, 214, 6, 2, d > 0.25 ? "#fff0b8" : "#c8c0a0");
    if (d > 0.25) glow(cv, x + 1, 226, 34, "#ffd98a", 0.5 * d, 1.2);
  }
  // fireflies
  if (d > 0.4) for (let i = 0; i < 14; i++) {
    const bx = ((hash(i, 21) * 560 - s.dist * (0.5 + hash(i, 22) * 0.4)) % 560 + 560) % 560 - 40, by = 190 + hash(i, 23) * 50 + Math.sin(s.t * 1.5 + i) * 6;
    const a = (0.4 + 0.6 * Math.sin(s.t * 3 + i * 2)) * d; glow(cv, bx, by, 5, "#e8ff8a", 0.6 * clamp01(a), 1); px(cv, bx, by, "#f4ffb0", clamp01(a));
  }
}

function pencil(cv, x, edge, dirDown, tod) {
  const w = K.PILLAR_W;
  const c = (col) => tint(col, tod);
  const yAt = (d) => edge + (dirDown ? -d : d);
  const band = (d0, d1, fn) => { const a = Math.min(yAt(d0), yAt(d1)), b = Math.max(yAt(d0), yAt(d1)); if (b < -5 || a > 275) return; fn(Math.floor(a), Math.ceil(b) - Math.floor(a)); };
  for (let dd = 0; dd < 24; dd++) {
    const half = (w / 2) * (0.22 + 0.78 * (dd / 24)), y = yAt(dd) - (dirDown ? 1 : 0);
    rect(cv, x + w / 2 - half, y, half * 2, 1, dd < 7 ? c("#3a3a44") : dd % 6 < 3 ? c("#f0c98a") : c("#e6b878"));
    if (dd >= 7) { px(cv, x + w / 2 - half, y, c("#c9925a")); px(cv, x + w / 2 + half - 1, y, c("#c9925a")); }
  }
  band(24, 2000, (y, h) => {
    rect(cv, x, y, w, h, c(PAL.lime)); rect(cv, x, y, 5, h, c(PAL.limeHi)); rect(cv, x + 5, y, 3, h, c("#b9e13c"));
    rect(cv, x + w - 8, y, 8, h, c("#8dbb20")); rect(cv, x + w - 4, y, 4, h, c(PAL.limeShade)); rect(cv, x + w / 2 - 1, y, 2, h, c("#8dbb20"));
  });
  band(24, 30, (y, h) => rect(cv, x, y, w, h, c("#e9f7a6")));
}

function pillars(cv, s, tod) {
  for (const p of s.pillars) {
    const x = Math.round(p.x);
    if (x < -40 || x > W + 10) continue;
    const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
    pencil(cv, x, top, true, tod); pencil(cv, x, bot, false, tod);
    const c = (col) => tint(col, tod);
    rect(cv, x, 0, K.PILLAR_W, 8, c("#ff9db0")); rect(cv, x, 8, K.PILLAR_W, 5, c("#c8ccd4")); rect(cv, x, 10, K.PILLAR_W, 1, c("#8a90a0")); rect(cv, x, 13, K.PILLAR_W, 1, c("#7a8090"));
    rect(cv, x, 244, K.PILLAR_W, 2, c(PAL.limeShade), 0.6);
    if (p.amp > 0) {                                              // moving pencils carry a tiny lime arrow
      const dir = Math.cos(s.t * p.freq + p.phase) > 0 ? 1 : -1, ay = p.gapY;
      poly(cv, [[x + 15, ay - dir * 4], [x + 11, ay + dir * 1], [x + 19, ay + dir * 1]], "#ffffff", 0.55);
    }
  }
}

function player(cv, s, tod) {
  const x = K.X, y = Math.round(s.y), d = darkness(tod);
  const flap = s.flapT < 0.18 ? 1 - s.flapT / 0.18 : 0, sway = Math.sin(s.t * 4) * 2;
  const bx = x + 2 + sway - s.vy * 0.02, by = y - 46 - flap * 3;
  stroke(cv, bx, by + 12, x + 6, y - 10, 0.5, "#6a5a5a");
  if (d > 0.3) glow(cv, bx, by, 34, "#ff9a7a", 0.35 * d, 1);                  // the balloon glows at night
  ellipse(cv, bx, by, 12, 14, PAL.coral); ellipse(cv, bx - 3, by - 4, 8, 9, "#ff8a7a"); disc(cv, bx - 5, by - 7, 2, "#ffe0d8");
  poly(cv, [[bx - 3, by + 13], [bx + 3, by + 13], [bx, by + 17]], "#d94a3a"); ellipse(cv, bx + 4, by + 3, 7, 8, "#d94a3a", 0.35);
  drawVaini(cv, x, y + 17, { armL: 0.5 + flap * 0.8, armR: 2.7, legH: 5, blink: s.over && s.deadT < 0.4, blush: s.over ? 0 : 0.6 + flap, lookX: 1, bob: 0, shadow: false, walk: s.t * 10 + 1 });
}

export function drawHudExtras(cv, s) {
  const label = "NIV " + s.level;
  rect(cv, 8, 8, textWidth(label) + 10, 13, "#1a1424", 0.6);
  text(cv, label, 13, 12, PAL.limeHi);
  if (s.level > 1) cornerToast(cv, s.level === 3 ? "NIVEL 3: ¡SE MUEVEN!" : "NIVEL " + s.level, s.levelT);
}

export function draw(cv, s) {
  const tod = timeOfDay(s.score, SPAN);
  drawSky(cv, tod, 246); drawStars(cv, tod, s.t, 170, 5); drawCelestial(cv, tod); drawShootingStar(cv, tod, s.t);
  mountains(cv, s, tod); clouds(cv, s, tod); balloonFar(cv, s, tod); birds(cv, s, tod);
  hills(cv, s, tod); windmill(cv, s, tod); town(cv, s, tod); pillars(cv, s, tod); ground(cv, s, tod); player(cv, s, tod);
}
