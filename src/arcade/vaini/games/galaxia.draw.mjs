// Galaxia · Vaini rides a little cream-and-lime ship through a cozy night sky. Donuts, mugs and croissants attack; the boss is a giant espresso machine.
import { cornerToast, W, H, px, rect, disc, ellipse, stroke, poly, gradient, glow, hash, text, textWidth, PAL, mix, drawVaini, clamp01, lerp, bigText } from "../kit.mjs";
import { K } from "./galaxia.rules.mjs";

function space(cv, s) {
  gradient(cv, [[0, "#070820"], [110, "#14104a"], [200, "#2a1a66"], [270, "#4a2a80"]]);
  // nebula
  glow(cv, 380, 70, 110, "#ff6ab8", 0.09, 0.6); glow(cv, 90, 130, 120, "#4ab8ff", 0.08, 0.6); glow(cv, 240, 240, 200, "#a86aff", 0.1, 0.35);
  // stars in three depths, falling gently
  for (const [n, par, size, seed] of [[46, 6, 0, 3], [30, 16, 0, 5], [16, 34, 1, 8]]) {
    for (let i = 0; i < n; i++) {
      const x = hash(i, seed) * W, y = (hash(i, seed + 1) * 300 + s.t * par) % 290 - 10;
      const tw = 0.5 + 0.5 * Math.sin(s.t * (1 + hash(i, seed + 2) * 2) + i);
      px(cv, x, y, "#ffffff", 0.35 + tw * 0.65);
      if (size) { px(cv, x + 1, y, "#ffffff", 0.35); px(cv, x, y + 1, "#ffffff", 0.35); }
    }
  }
  // big cream moon with a lime flag, drifting very slowly
  const my = 60 + ((s.t * 1.6) % 400) * 0 + Math.sin(s.t * 0.15) * 3;
  glow(cv, 86, my, 60, "#fff4d0", 0.18, 1); disc(cv, 86, my, 30, "#efe6cc"); disc(cv, 92, my - 3, 24, "#f8f2e0");
  for (const [dx, dy, r] of [[-14, 6, 6], [10, 14, 4], [-4, -14, 4], [16, -6, 3]]) { disc(cv, 86 + dx, my + dy, r, "#d8cdb0"); disc(cv, 86 + dx - 1, my + dy - 1, r * 0.6, "#e8dfc4"); }
  rect(cv, 96, my - 34, 1, 14, "#8a6a4a"); poly(cv, [[97, my - 34], [108, my - 30], [97, my - 26]], PAL.lime);
  // ringed planet
  disc(cv, 410, 210, 17, "#e8a060"); disc(cv, 414, 206, 12, "#f4c088", 0.9);
  for (let i = -12; i <= 12; i += 6) rect(cv, 396, 210 + i * 0.7, 28, 1, "#c07a48", 0.5);
  for (let a = 0; a < 72; a++) { const t = (a / 72) * Math.PI * 2, x = 410 + Math.cos(t) * 32, y = 210 + Math.sin(t) * 7; if (Math.sin(t) > 0 || Math.abs(x - 410) > 17) { px(cv, x, y, "#f4dcaa"); px(cv, x, y + 1, "#c9a878", 0.7); } }
  // Café Vaini space station passing by
  const sx = 620 - ((s.t * 9) % 820), sy = 150;
  if (sx > -60 && sx < W + 20) {
    rect(cv, sx, sy, 36, 14, "#3a2a56"); rect(cv, sx + 2, sy + 2, 32, 10, "#4a3a70"); rect(cv, sx + 8, sy - 6, 20, 6, "#e8d8b0");
    for (let i = 0; i < 4; i++) rect(cv, sx + 5 + i * 8, sy + 5, 5, 4, i % 2 ? "#ffd98a" : "#7ad0ff");
    text(cv, "CAFE", sx + 9, sy - 5, "#6a3a1a"); rect(cv, sx - 8, sy + 5, 8, 3, "#6a8ae0"); rect(cv, sx + 36, sy + 5, 8, 3, "#6a8ae0");
  }
  // comet
  const u = (s.t % 11) / 11;
  if (u < 0.12) { const k = u / 0.12, x = 470 - k * 400, y = 20 + k * 90; for (let i = 0; i < 18; i++) px(cv, x + i * 2.4, y - i * 1.1, "#bfe8ff", (1 - i / 18) * 0.9); disc(cv, x, y, 2, "#ffffff"); }
}

function enemy(cv, s, e) {
  const x = Math.round(e.x), y = Math.round(e.y), f = Math.sin(s.t * 6 + e.wob) > 0 ? 1 : 0, w = e.flash > 0;
  const c = (col) => (w ? "#ffffff" : col);
  const angry = (dx = 0, dy = 0) => { rect(cv, x - 4 + dx, y - 1 + dy, 2, 3, "#1a1414"); rect(cv, x + 2 + dx, y - 1 + dy, 2, 3, "#1a1414"); px(cv, x - 5 + dx, y - 2 + dy, "#1a1414"); px(cv, x + 4 + dx, y - 2 + dy, "#1a1414"); };
  if (e.kind === "dona") {
    disc(cv, x, y, 9, c("#d99a55")); disc(cv, x, y - 1, 8, c("#ff9db0")); disc(cv, x, y - 1, 8, c("#ffb8c8"), 0.35);
    for (const [dx, dy, col] of [[-5, -5, "#fff"], [4, -6, "#7ad0ff"], [6, 1, "#fff2a0"], [-6, 3, "#a6d62a"], [1, 5, "#fff"]]) rect(cv, x + dx, y + dy, 2, 1, c(col));
    disc(cv, x, y + 1, 2.4, c("#14104a")); angry(0, -2);
  } else if (e.kind === "taza") {
    rect(cv, x - 8, y - 6, 15, 13, c("#d9714a")); rect(cv, x - 8, y - 6, 15, 2, c("#f29a7a")); rect(cv, x + 4, y - 6, 3, 13, c("#b85a38"));
    stroke(cv, x + 8, y - 2, x + 11, y + 2, 1.4, c("#d9714a")); rect(cv, x - 7, y - 5, 13, 1, c("#5a3a26"));
    angry(-1, 1); rect(cv, x - 3, y + 4, 6, 1, "#5a3a26");
    for (let k = 0; k < 2; k++) { const u = ((s.t * 1.2 + k * 0.5) % 1); disc(cv, x - 2 + k * 4 + Math.sin(u * 6) * 2, y - 9 - u * 8, 1 + u, "#ffffff", 0.5 * (1 - u)); }
  } else {
    // croissant: a fat crescent made of five rounded segments, tips curling down
    const seg = [[-8, 3 - f, 3, "#d89840"], [-5, -1, 4, "#e8a848"], [0, -3, 5, "#f4bc5a"], [5, -1, 4, "#e8a848"], [8, 3 - f, 3, "#d89840"]];
    for (const [dx, dy, r, col] of seg) disc(cv, x + dx, y + dy, r + 1, c("#a86a20"));
    for (const [dx, dy, r, col] of seg) disc(cv, x + dx, y + dy, r, c(col));
    for (const dx of [-3, 3]) stroke(cv, x + dx, y - 6, x + dx * 1.1, y + 1, 0.3, c("#c98a30"));
    px(cv, x - 1, y - 6, c("#fff2c0")); px(cv, x, y - 6, c("#fff2c0"));
    angry(0, 0);
  }
}

function boss(cv, s, b) {
  const x = Math.round(b.x), y = Math.round(b.y), w = b.hit > 0, c = (col) => (w ? "#ffffff" : col);
  rect(cv, x - 34, y - 22, 68, 40, c("#3a3a4a")); rect(cv, x - 34, y - 22, 68, 4, c("#6a6a80")); rect(cv, x + 26, y - 22, 8, 40, c("#2a2a38"));
  rect(cv, x - 28, y - 14, 56, 14, c("#1a1a26")); rect(cv, x - 26, y - 12, 52, 10, c("#2a2a3a"));
  const blink = Math.sin(s.t * 8) > 0;
  rect(cv, x - 20, y - 9, 6, 6, "#ff5a4a"); rect(cv, x + 14, y - 9, 6, 6, "#ff5a4a"); rect(cv, x - 19, y - 8, 2, 2, blink ? "#ffd0c8" : "#c03a30"); rect(cv, x + 15, y - 8, 2, 2, blink ? "#ffd0c8" : "#c03a30");
  rect(cv, x - 12, y - 6, 24, 2, "#ff5a4a"); rect(cv, x - 10, y - 4, 20, 1, "#c03a30");
  for (let i = 0; i < 5; i++) rect(cv, x - 24 + i * 12, y + 4, 8, 3, i % 2 ? PAL.lime : PAL.limeShade);
  rect(cv, x - 10, y + 18, 20, 8, c("#c8ccd4")); rect(cv, x - 4, y + 26, 8, 6, c("#8a90a0"));
  for (let k = 0; k < 3; k++) { const u = ((s.t * 0.9 + k / 3) % 1); disc(cv, x - 24 + k * 24, y - 26 - u * 12, 2 + u * 2, "#ffffff", 0.45 * (1 - u)); }
  // hp bar
  rect(cv, x - 30, y - 34, 60, 4, "#1a1424", 0.8); rect(cv, x - 29, y - 33, Math.round(58 * (b.hp / b.max)), 2, "#ff6a5a");
}

function ship(cv, s) {
  if (s.over && s.deadT > 0.05) return;
  if (s.invuln > 0 && Math.floor(s.t * 14) % 2 === 0) return;
  const x = Math.round(s.x), y = K.SHIP_Y, lean = Math.max(-3, Math.min(3, s.lean * 4));
  // engine flames
  const fl = 4 + Math.sin(s.t * 40) * 1.6;
  for (const dx of [-6, 6]) { poly(cv, [[x + dx - 3, y + 16], [x + dx + 3, y + 16], [x + dx, y + 16 + fl + 5]], "#ff9a3a"); poly(cv, [[x + dx - 1.5, y + 16], [x + dx + 1.5, y + 16], [x + dx, y + 16 + fl]], "#fff2a0"); }
  glow(cv, x, y + 20, 26, "#ff9a5a", 0.28, 0.6);
  // swept wings and tail fins
  for (const m of [-1, 1]) {
    poly(cv, [[x + m * 7, y - 3], [x + m * 35, y + 13], [x + m * 35, y + 17], [x + m * 30, y + 17], [x + m * 7, y + 11]], PAL.lime);
    poly(cv, [[x + m * 7, y - 3], [x + m * 35, y + 13], [x + m * 33, y + 13], [x + m * 7, y - 1]], PAL.limeHi);
    poly(cv, [[x + m * 7, y + 9], [x + m * 30, y + 17], [x + m * 7, y + 11]], PAL.limeShade);
    rect(cv, x + m * 33 - (m < 0 ? 0 : 2), y + 13, 2, 5, "#ff6a5a");                    // wing-tip light
    poly(cv, [[x + m * 8, y + 8], [x + m * 19, y + 22], [x + m * 8, y + 20]], "#2455b0");
  }
  // fuselage
  poly(cv, [[x - 11, y - 12], [x + 11, y - 12], [x + 10, y + 19], [x - 10, y + 19]], "#2f6fe0");
  rect(cv, x - 11, y - 12, 4, 31, "#5b8de0"); rect(cv, x + 6, y - 12, 5, 31, "#2455b0"); rect(cv, x - 10, y + 9, 20, 2, PAL.lime); rect(cv, x - 10, y + 11, 20, 1, PAL.limeShade);
  for (const dx of [-8, 3]) rect(cv, x + dx, y + 14, 5, 5, "#5a5a70");                      // engines
  // Vaini seated: his feet sit below the dashboard, so only his upper body shows
  const firing = s.fireT > 0.15;
  drawVaini(cv, x + lean * 0.3, y - 4, { armL: 0.25, armR: 0.25, legH: 3, blink: s.over, blush: firing ? 0.9 : 0.4, lookX: 0, shadow: false, bob: Math.round(Math.sin(s.t * 12) * 0.5) });
  // dashboard rim over his lower body
  rect(cv, x - 14, y - 12, 28, 10, "#2f6fe0"); rect(cv, x - 14, y - 12, 28, 2, "#86aef0"); rect(cv, x - 14, y - 4, 28, 2, "#1a3f8a"); rect(cv, x - 14, y - 6, 28, 2, PAL.lime);
  rect(cv, x - 14, y - 12, 2, 10, "#5b8de0"); rect(cv, x + 12, y - 12, 2, 10, "#2455b0");
  rect(cv, x - 6, y - 10, 3, 2, "#ffe45c"); rect(cv, x + 3, y - 10, 3, 2, "#ff6a5a");   // little dashboard lights
  // glass canopy: pale tint, frame and a highlight
  for (let yy = -42; yy <= -12; yy++) {
    const k = (yy + 12) / 30, half = Math.round(17 * Math.sqrt(Math.max(0, 1 - k * k)));
    if (half > 0) rect(cv, x - half, y + yy, half * 2, 1, "#bfe8ff", 0.2);
  }
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.05) { const ex = x + Math.cos(a) * 17, ey = y - 12 + Math.sin(a) * 30; px(cv, ex, ey, "#7ab0d8"); px(cv, ex, ey + 1, "#4a7aa8", 0.7); }
  for (let a = Math.PI * 1.15; a <= Math.PI * 1.45; a += 0.06) px(cv, x + Math.cos(a) * 13, y - 12 + Math.sin(a) * 26, "#ffffff", 0.9);
  rect(cv, x - 1, y - 43, 2, 4, "#d8cdb0");                                                // nose tip
}

function bullets(cv, s) {
  // player shots: thick lime bolts with a white core and a dark edge so they read on any background
  for (const p of s.shots) { glow(cv, p.x, p.y, 10, "#d8ff70", 0.55, 1.8); rect(cv, p.x - 2, p.y - 6, 4, 12, "#1a2a08"); rect(cv, p.x - 1, p.y - 5, 2, 10, PAL.limeHi); rect(cv, p.x - 1, p.y - 5, 1, 10, "#ffffff"); }
  // enemy fire: hot coral orbs, outlined and pulsing, with a short trail — sized for a tiny screen
  for (const b of s.bullets) {
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 22 + b.x * 0.3);
    for (let i = 1; i <= 3; i++) disc(cv, b.x - (b.vx || 0) * 0.012 * i, b.y - i * 3.2, 3.6 - i * 0.7, "#ff6a4a", 0.32 - i * 0.07);
    glow(cv, b.x, b.y, 12 + pulse * 2, "#ff6a4a", 0.6, 1);
    disc(cv, b.x, b.y, 5.2, "#1a0f2a"); disc(cv, b.x, b.y, 4.4, "#ff4a3a"); disc(cv, b.x, b.y, 3, "#ff9a70"); disc(cv, b.x, b.y, 1.7, "#fff4e0");
    px(cv, b.x - 2, b.y - 2, "#ffffff", 0.9);
  }
  for (const d of s.drops) {
    const bob = Math.sin(s.t * 6 + d.x) * 1.5;
    glow(cv, d.x, d.y + bob, 12, d.kind === "leaf" ? "#c6ec52" : "#ff8aa0", 0.45, 1);
    if (d.kind === "leaf") { ellipse(cv, d.x, d.y + bob, 6, 4, PAL.lime); ellipse(cv, d.x - 1, d.y + bob - 1, 4, 2, PAL.limeHi); stroke(cv, d.x - 5, d.y + bob + 3, d.x + 5, d.y + bob - 3, 0.4, PAL.limeShade); }
    else { rect(cv, d.x - 4, d.y + bob - 3, 8, 4, "#ff5a7a"); rect(cv, d.x - 3, d.y + bob - 4, 2, 1, "#ff5a7a"); rect(cv, d.x + 1, d.y + bob - 4, 2, 1, "#ff5a7a"); rect(cv, d.x - 2, d.y + bob + 1, 5, 1, "#ff5a7a"); px(cv, d.x, d.y + bob + 2, "#ff5a7a"); }
  }
}

export function drawHudExtras(cv, s) {
  const label = "OLA " + Math.max(1, s.wave);
  rect(cv, 8, 8, textWidth(label) + 10, 13, "#1a1424", 0.6); text(cv, label, 13, 12, PAL.limeHi);
  for (let i = 0; i < s.lives; i++) { const x = 8 + i * 10, y = 25, c = "#ff5a7a"; rect(cv, x, y + 1, 7, 3, c); rect(cv, x + 1, y, 2, 1, c); rect(cv, x + 4, y, 2, 1, c); rect(cv, x + 1, y + 4, 5, 1, c); rect(cv, x + 2, y + 5, 3, 1, c); px(cv, x + 3, y + 6, c); }
  for (let i = 0; i < 3; i++) rect(cv, 8 + i * 6, 37, 4, 3, i < s.power ? PAL.limeHi : "#4a4470");
  if (s.wave >= 1) cornerToast(cv, s.cfg?.boss ? "¡JEFE: CAFETERA!" : "OLA " + s.wave, s.waveT, s.cfg?.boss ? "#ff6a5a" : PAL.limeHi, 20, 2.4);
}

export function draw(cv, s) {
  space(cv, s);
  for (const e of s.enemies) if (e.t >= 0) enemy(cv, s, e);
  if (s.boss) boss(cv, s, s.boss);
  bullets(cv, s);
  ship(cv, s);
}
