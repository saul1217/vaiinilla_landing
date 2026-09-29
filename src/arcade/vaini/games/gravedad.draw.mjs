// Gravedad · night bus 17 in the rain. Vaini sprints on the floor or the ceiling; seats and bags below, umbrellas and straps above.
import { W, H, px, rect, disc, ellipse, stroke, poly, gradient, glow, hash, text, PAL, mix, drawVaini, drawVainiUpsideDown, clamp01, lerp } from "../kit.mjs";
import { K } from "./gravedad.rules.mjs";

const off = (s, par, P) => (((s.dist * par) % P) + P) % P;

function city(cv, s) {
  gradient(cv, [[K.CEIL, "#141a3a"], [130, "#2a2a5a"], [K.FLOOR, "#4a3a6a"]]);
  const layers = [[0.12, "#241f4a", 70, 100, 6], [0.25, "#1a1a3c", 96, 140, 8]];
  layers.forEach(([par, col, minH, maxH, seed], li) => {
    const P = 480, o = off(s, par, P);
    for (let x = 0; x < W; x += 1) {
      const u = Math.floor((x + o) / 40);
      const h = minH + hash(u, seed) * (maxH - minH) * (li ? 0.7 : 0.5);
      for (let y = Math.floor(K.FLOOR - 24 - h); y < K.FLOOR - 24; y++) px(cv, x, y, col);
    }
    for (let x = 0; x < W; x += 4) {
      const u = Math.floor((x + o) / 40);
      const h = minH + hash(u, seed) * (maxH - minH) * (li ? 0.7 : 0.5);
      for (let wy = Math.floor(K.FLOOR - 24 - h) + 6; wy < K.FLOOR - 30; wy += 9) if (hash((x + o) | 0, wy) > 0.72) rect(cv, x, wy, 2, 3, "#ffd98a", 0.75);
    }
  });
  // bokeh street lights (blurry discs)
  const P = 520, o = off(s, 0.6, P);
  for (let i = 0; i < 9; i++) {
    const x = ((hash(i, 40) * P - o) % P + P) % P - 20, y = 90 + hash(i, 41) * 100, r = 6 + hash(i, 42) * 10;
    const col = ["#ffd98a", "#ff8a7a", "#8ad0ff", "#ffe6a0"][i % 4];
    glow(cv, x, y, r * 2.2, col, 0.32, 1); disc(cv, x, y, r * 0.5, col, 0.5);
  }
}

function rain(cv, s) {
  for (let i = 0; i < 90; i++) {
    const sp = 180 + hash(i, 1) * 160, x0 = hash(i, 2) * (W + 80);
    const y = (hash(i, 3) * 300 + s.t * sp) % 300, x = (x0 - y * 0.35 - s.dist * 0.5 * (0.4 + hash(i, 4))) % (W + 80);
    const xx = (x + W + 80) % (W + 80) - 40;
    if (y < K.CEIL || y > K.FLOOR) continue;
    stroke(cv, xx, y, xx - 2, y + 7, 0.4, "#b8c8ff", 0.4);
  }
  // sliding droplets on the glass
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 9) * W, y = K.CEIL + 8 + ((hash(i, 10) * 200 + s.t * (10 + hash(i, 11) * 14)) % 170);
    px(cv, x, y, "#d8e4ff", 0.55); px(cv, x, y - 1, "#d8e4ff", 0.3);
  }
}

function frame(cv, s) {
  // window pillars pass by quickly
  const P = 240, o = off(s, 1, P);
  for (let rep = -1; rep <= 2; rep++) {
    const x = Math.round(rep * P + 150 - o);
    rect(cv, x, K.CEIL, 8, K.FLOOR - K.CEIL, "#2a2848"); rect(cv, x, K.CEIL, 2, K.FLOOR - K.CEIL, "#4a4878"); rect(cv, x + 6, K.CEIL, 2, K.FLOOR - K.CEIL, "#1a1830");
  }
  // glass reflection sheen
  for (let i = 0; i < 3; i++) {
    const x = ((i * 180 + 40 - s.dist * 0.05) % 540 + 540) % 540 - 40;
    poly(cv, [[x, K.CEIL], [x + 22, K.CEIL], [x + 6, K.FLOOR], [x - 16, K.FLOOR]], "#ffffff", 0.05);
  }
}

function ceiling(cv, s) {
  rect(cv, 0, 0, W, K.CEIL, "#e9e2d2"); rect(cv, 0, K.CEIL - 4, W, 4, "#c9c0ac"); rect(cv, 0, K.CEIL - 1, W, 1, "#8a8270");
  // lamp strip
  rect(cv, 0, 10, W, 8, "#fff6d0"); rect(cv, 0, 10, W, 2, "#ffffff"); rect(cv, 0, 17, W, 1, "#e8d9a0");
  glow(cv, 240, 30, 260, "#ffe9a8", 0.09, 0.28);
  // handrail
  rect(cv, 0, 28, W, 3, "#c8ccd4"); rect(cv, 0, 28, W, 1, "#ffffff"); rect(cv, 0, 30, W, 1, "#8a90a0");
  // route sign 17
  rect(cv, 20, 3, 46, 20, "#1a1a1a"); rect(cv, 22, 5, 42, 16, "#2a2a2a");
  text(cv, "17", 26, 7, "#ffb43a", 1, 3);
  text(cv, "VAINI", 46, 14, "#ffb43a", 0.9);
}

function floor(cv, s) {
  rect(cv, 0, K.FLOOR, W, H - K.FLOOR, "#2c2844"); rect(cv, 0, K.FLOOR, W, 3, "#4a4670"); rect(cv, 0, K.FLOOR + 3, W, 1, "#1c1a30");
  rect(cv, 0, K.FLOOR + 10, W, 4, "#f2c74a", 0.85); rect(cv, 0, K.FLOOR + 10, W, 1, "#ffe388");
  const o = off(s, 1, 16);
  for (let x = -16; x < W + 16; x += 16) rect(cv, x - o, K.FLOOR + 18, 2, H - K.FLOOR - 18, "#231f38");
  // seat shadows under the windows
  rect(cv, 0, K.FLOOR - 4, W, 4, "#1a1830", 0.55);
}

function obstacle(cv, s, o) {
  const x = Math.round(o.x), w = o.w;
  if (o.floor) {
    const y = K.FLOOR - K.OB_H;
    if (o.kind === "asiento") {
      rect(cv, x, y + 14, w, 20, "#3a6ac8"); rect(cv, x, y + 14, w, 2, "#6a94ee"); rect(cv, x + w - 4, y + 14, 4, 20, "#2a4a98");
      rect(cv, x + 2, y, w - 4, 16, "#4a7ad8"); rect(cv, x + 2, y, w - 4, 2, "#7aa4f4"); rect(cv, x + w - 6, y, 4, 16, "#2a4a98");
      for (let i = 4; i < w - 4; i += 8) rect(cv, x + i, y + 4, 1, 10, "#3a62b8");
      rect(cv, x + w / 2 - 2, y - 3, 4, 4, "#c8ccd4");
    } else {
      const bw = Math.min(w, 34);
      rect(cv, x, y + 6, bw, 28, PAL.coral); rect(cv, x, y + 6, bw, 2, "#ff9a8a"); rect(cv, x + bw - 4, y + 6, 4, 28, "#c9443a");
      rect(cv, x + 3, y + 14, bw - 10, 8, "#e0503f"); rect(cv, x + 3, y + 14, bw - 10, 1, "#ff9a8a"); rect(cv, x + 5, y + 18, 4, 2, PAL.lime);
      rect(cv, x + 6, y + 2, bw - 12, 5, "#3a2a2a"); rect(cv, x + 8, y + 4, bw - 16, 2, "#5a4a4a");
    }
  } else {
    const y0 = K.CEIL;
    if (o.kind === "paraguas") {
      const cx = x + w / 2;
      stroke(cv, cx, y0, cx, y0 + 12, 0.8, "#c8ccd4");
      poly(cv, [[cx - 7, y0 + 12], [cx + 7, y0 + 12], [cx + 5, y0 + 30], [cx - 5, y0 + 30]], PAL.mustard);
      rect(cv, cx - 7, y0 + 12, 14, 2, "#f8d488"); rect(cv, cx + 2, y0 + 14, 4, 16, "#c99a3a");
      stroke(cv, cx, y0 + 30, cx, y0 + 35, 0.7, "#c8ccd4");
      if (hash(x, 3) > 0.3) px(cv, cx + 1, y0 + 37 + ((s.t * 20) % 6), "#9ec8ff", 0.8);
      // second small bag hanging beside it to fill the width
      if (w > 40) { rect(cv, x + 4, y0 + 20, 12, 14, PAL.moto); rect(cv, x + 4, y0 + 20, 12, 2, "#6a9af0"); stroke(cv, x + 10, y0, x + 10, y0 + 20, 0.6, "#c8ccd4"); }
    } else {
      // pair of straps with lime grips
      for (const sx of [x + 6, x + w - 8]) {
        stroke(cv, sx + 1, y0, sx + 1, y0 + 20, 1.2, "#2a2a3a");
        rect(cv, sx - 4, y0 + 20, 10, 12, "#2a2a3a"); rect(cv, sx - 3, y0 + 23, 8, 6, PAL.lime); rect(cv, sx - 3, y0 + 23, 8, 1, PAL.limeHi);
      }
      rect(cv, x + 6, y0 + 34, w - 12, 3, "#ffffff", 0.0);
    }
  }
}

function player(cv, s) {
  const y = s.y, feetDown = s.dir > 0;
  const grounded = Math.abs(s.vy) < 1;
  const run = s.started && grounded && !s.over;
  const anchor = feetDown ? y + K.HALF_H : y - K.HALF_H;         // feet line
  const shadowY = feetDown ? K.FLOOR : K.CEIL;
  ellipse(cv, K.X, shadowY + (feetDown ? 1 : -1), grounded ? 15 : 8, 2.4, "#000000", 0.4);
  const pose = {
    armL: !grounded ? 2.4 : 0.8 + Math.sin(s.t * 14) * 0.7, armR: !grounded ? 2.2 : 0.8 - Math.sin(s.t * 14) * 0.7,
    blink: s.over, blush: grounded ? 0.3 : 1, lookX: 1, walk: run ? s.t * 14 : undefined, bob: run ? Math.round(Math.sin(s.t * 14)) : 0, legH: 6, shadow: false,
  };
  if (feetDown) drawVaini(cv, K.X, Math.round(anchor), pose);
  else drawVainiUpsideDown(cv, K.X, Math.round(anchor), pose);
}

export function draw(cv, s) {
  city(cv, s); rain(cv, s); frame(cv, s); ceiling(cv, s); floor(cv, s);
  for (const o of s.obstacles) obstacle(cv, s, o);
  player(cv, s);
}
