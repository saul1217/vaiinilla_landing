// Draws a run of Vaini Skate into the 480×270 pixel buffer. Reads game state; never changes rules.
import { W, H, px, rect, disc, ellipse, stroke, poly, rgb, clamp01, lerp, TAU } from "./raster.js";
import { drawVaini } from "./vaini.js";
import { hash, gradient, glow, text, textWidth } from "./lib.js";
import { GROUND, PLAYER_X, KINDS, screenX, FLIP_TIME, meters } from "./world.js";
import { progress } from "./missions.js";

const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => hex(rgb(a).map((v, i) => lerp(v, rgb(b)[i], t)));

// Sky goes from golden sunset to night as the run gets longer.
const SUNSET = ["#3a2a6a", "#c2507a", "#f28a4a", "#ffc86a"];
const NIGHT = ["#0a0c24", "#1c1f4a", "#3a2a6a", "#5a3a78"];
const nightness = (run) => clamp01(run.distance / 16000);

function sky(cv, run) {
  const n = nightness(run);
  const c = SUNSET.map((s, i) => mix(s, NIGHT[i], n));
  gradient(cv, [[0, c[0]], [60, c[1]], [120, c[2]], [200, c[3]]]);
  const sunY = lerp(108, 200, n);
  for (let y = sunY - 42; y < sunY + 42; y++) for (let x = 333; x < 417; x++)
    if (Math.hypot(x - 375, y - sunY) < 42 && !(y > sunY - 6 && (y - sunY + 6) % 6 < 2)) px(cv, x, y, mix("#ffd27a", "#ff8a5a", n));
  if (n > 0.4) for (let i = 0; i < 70; i++) {
    const x = hash(i, 11) * W, y = hash(i, 12) * 120;
    const tw = 0.5 + 0.5 * Math.sin(run.time * 3 + i);
    px(cv, x, y, "#ffffff", (n - 0.4) * 1.6 * tw);
  }
}

const tileOffset = (run, parallax, P) => ((run.distance * parallax) % P + P) % P;

function farSkyline(cv, run) {
  const P = 120, s = tileOffset(run, 0.15, P), col = mix("#6a3a78", "#221a44", nightness(run));
  for (let x = 0; x < W; x++) {
    const u = (x + s) % P;
    const h = [52, 70, 44, 88, 60, 36][Math.floor(u / 20)];
    for (let y = 176 - h; y < 176; y++) px(cv, x, y, col);
    if (u % 20 === 10 && h > 60 && Math.sin(run.time * 4) > 0) px(cv, x, 176 - h - 3, "#ff5a6a");
  }
}

function midBuildings(cv, run) {
  const P = 240, s = tileOffset(run, 0.4, P), n = nightness(run);
  const blocks = [[0, 60, 86, "#8a4a6a"], [62, 48, 110, "#a85a5a"], [112, 70, 74, "#7a4a7a"], [184, 54, 98, "#9a5060"]];
  for (let rep = -1; rep <= 2; rep++) for (const [bx, bw, bh, col] of blocks) {
    const x0 = Math.round(bx + rep * P - s);
    if (x0 > W || x0 + bw < 0) continue;
    rect(cv, x0, 196 - bh, bw, bh, mix(col, "#2a2048", n * 0.8));
    for (let wy = 196 - bh + 8; wy < 186; wy += 10) for (let wx = x0 + 5; wx < x0 + bw - 6; wx += 9)
      rect(cv, wx, wy, 5, 6, hash(wx - x0 + bx, wy) > 0.55 - n * 0.25 ? "#ffd98a" : mix("#5a3050", "#1a1430", n));
  }
  for (let rep = -1; rep <= 2; rep++) {
    const x0 = Math.round(20 + rep * P - s);
    rect(cv, x0, 170, 90, 26, "#5a5a6a");
    text(cv, "VAINI", x0 + 20, 176, "#6bf0c8"); text(cv, "SKATE", x0 + 44, 184, "#ff7ab8");
    stroke(cv, x0 + 8, 190, x0 + 18, 174, 1.2, "#ffd36e"); disc(cv, x0 + 76, 180, 5, "#7ab8ff", 0.9);
  }
}

function street(cv, run) {
  const s = tileOffset(run, 1, 60), n = nightness(run);
  rect(cv, 0, 196, W, 30, mix("#7a6a78", "#3a3448", n));
  for (let x = 0; x < W; x++) if ((x + s) % 60 < 1) rect(cv, x, 196, 1, 30, "#4a4058");
  rect(cv, 0, 196, W, 2, "#b09aa8");
  rect(cv, 0, GROUND, W, 4, "#c8b0b8"); rect(cv, 0, GROUND + 4, W, H - GROUND - 4, mix("#3a3040", "#1a1624", n));
  const s2 = tileOffset(run, 1.25, 80);
  for (let x = 0; x < W; x++) if ((x + s2) % 80 < 36) px(cv, x, 250, "#f2e28a");
}

function lamps(cv, run) {
  const P = 160, s = tileOffset(run, 0.85, P), n = nightness(run);
  for (let rep = -1; rep <= 3; rep++) {
    const x = Math.round(60 + rep * P - s);
    if (x < -30 || x > W + 30) continue;
    rect(cv, x, 132, 3, 94, "#2a2030");
    stroke(cv, x + 1, 134, x + 14, 130, 1, "#2a2030");
    rect(cv, x + 10, 128, 10, 4, "#2a2030"); rect(cv, x + 11, 131, 8, 2, "#fff0b8");
    glow(cv, x + 15, 150, 40 + n * 20, "#ffd98a", 0.2 + n * 0.25, 1.6);
  }
}

function obstacle(cv, run, o) {
  const k = KINDS[o.kind], x = Math.round(screenX(run, o.x)), top = GROUND - k.h;
  if (x < -60 || x > W + 60) return;
  ellipse(cv, x, GROUND + 1, k.w / 2 + 2, 2, "#1a1624", 0.4);
  if (o.kind === "cone") {
    poly(cv, [[x - 6, GROUND], [x + 6, GROUND], [x + 2, top], [x - 2, top]], "#ff7a2a");
    rect(cv, x - 4, GROUND - 10, 8, 2, "#ffffff"); rect(cv, x - 8, GROUND - 2, 16, 2, "#e8602a");
  } else if (o.kind === "bin") {
    rect(cv, x - 8, top + 4, 16, k.h - 4, "#5a7a6a"); rect(cv, x - 9, top, 18, 4, "#7a9a8a");
    for (let i = -5; i <= 5; i += 5) rect(cv, x + i, top + 7, 1, k.h - 10, "#4a6a5a");
  } else if (o.kind === "bench") {
    rect(cv, x - 22, top, 44, 3, "#c98b4e"); rect(cv, x - 22, top + 4, 44, 3, "#b07a42");
    rect(cv, x - 19, top + 7, 3, k.h - 7, "#3a3040"); rect(cv, x + 16, top + 7, 3, k.h - 7, "#3a3040");
  } else if (o.kind === "rail") {
    rect(cv, x - 48, top, 96, 3, "#d8dce4"); rect(cv, x - 48, top, 96, 1, "#ffffff");
    for (const px0 of [x - 44, x, x + 42]) rect(cv, px0, top + 3, 3, k.h - 3, "#8a90a0");
  }
}

function star(cv, x, y, t) {
  const r = 4 + Math.sin(t * 6) * 0.6;
  poly(cv, Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + t * 1.5, rr = i % 2 ? r * 0.45 : r;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  }), "#ffe45c");
  px(cv, x - 1, y - 1, "#ffffff");
}

function player(cv, run) {
  const p = run.player;
  if (!run.over && p.hurt > 0 && Math.floor(p.hurt * 12) % 2 === 0) return; // blink while invulnerable
  const y = Math.round(p.y) - 6;
  const flipU = p.flipping ? p.flip / FLIP_TIME : 0;
  const frame = p.flipping ? Math.floor(flipU * 8) % 4 : 0;
  const deckW = [30, 16, 4, 16][frame];
  const tilt = p.stumble > 0 ? 0.35 : !p.grounded && !p.grinding ? clamp01(-p.vy / 400) * 0.25 : 0;
  stroke(cv, PLAYER_X - deckW / 2, y + 4 + tilt * 8, PLAYER_X + deckW / 2, y + 4 - tilt * 8, frame === 2 ? 2 : 1.4, frame % 2 ? "#ff5ab4" : "#2a2a3a");
  if (frame === 0) for (const wx of [PLAYER_X - 10, PLAYER_X + 10]) disc(cv, wx, y + 7, 2, "#f2f2f2");
  const air = !p.grounded && !p.grinding;
  drawVaini(cv, PLAYER_X, y, {
    armL: air ? 2.2 : 1.2, armR: air ? 2.0 : 1.0 + (p.grinding ? 0.8 : 0),
    blink: p.stumble > 0, blush: air || p.grinding ? 1 : 0.2, lookX: 1,
    bob: p.grounded ? Math.round(Math.sin(run.time * 10) * 0.6) : 0, shadow: false,
  });
  if (!p.grinding) ellipse(cv, PLAYER_X, GROUND + 1, Math.max(6, 16 - (GROUND - p.y) * 0.15), 2, "#1a1624", 0.45);
}

// ---------- particles fed by game events ----------
export function createFx() { return { parts: [], popups: [] }; }

export function absorbEvents(fx, run) {
  for (const e of run.events) {
    if (e.type === "star") for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; fx.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, life: 0.4, col: "#ffe45c" }); }
    if (e.type === "land") for (let i = 0; i < 6; i++) fx.parts.push({ x: PLAYER_X - 12 + i * 5, y: run.player.y, vx: (i - 2.5) * 12, vy: -20 - Math.random() * 20, life: 0.3, col: "#ffe8d0" });
    if (e.type === "grindSpark") fx.parts.push({ x: PLAYER_X - 8, y: run.player.y + 2, vx: -60 - Math.random() * 60, vy: -40 - Math.random() * 60, life: 0.25, col: Math.random() > 0.5 ? "#ffe45c" : "#ffffff" });
    if (e.type === "hit") for (let i = 0; i < 5; i++) fx.parts.push({ x: PLAYER_X, y: run.player.y - 40, vx: (i - 2) * 30, vy: -60, life: 0.6, col: "#ffd36e", star: true });
    if (e.text) fx.popups.push({ text: e.text, life: 1.1 });
  }
}

function drawFx(cv, fx, dt) {
  for (const p of fx.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt;
    if (p.star) star(cv, p.x, p.y, p.life * 4); else px(cv, p.x, p.y, p.col, Math.min(1, p.life * 3));
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  fx.popups.forEach((p, i) => {
    p.life -= dt;
    const y = 150 - i * 9 - (1.1 - p.life) * 12;
    const w = textWidth(p.text);
    text(cv, p.text, PLAYER_X - w / 2 + 1, y + 1, "#2a1a30", Math.min(1, p.life * 2));
    text(cv, p.text, PLAYER_X - w / 2, y, "#fff6c8", Math.min(1, p.life * 2));
  });
  fx.popups = fx.popups.filter((p) => p.life > 0).slice(-4);
}

// ---------- HUD & screens ----------
function heart(cv, x, y, full) {
  const c = full ? "#ff5a7a" : "#5a4a60";
  rect(cv, x, y + 1, 7, 3, c); rect(cv, x + 1, y, 2, 1, c); rect(cv, x + 4, y, 2, 1, c); rect(cv, x + 1, y + 4, 5, 1, c); rect(cv, x + 2, y + 5, 3, 1, c); px(cv, x + 3, y + 6, c);
}

function panel(cv, x, y, w, h) { rect(cv, x, y, w, h, "#1a1224", 0.72); rect(cv, x, y, w, 1, "#ffffff", 0.25); }

function missionsBox(cv, run, missions, doneBefore, x, y) {
  panel(cv, x, y, 150, 8 + missions.length * 9);
  missions.forEach((m, i) => {
    const pr = progress(m, run), done = pr.done || doneBefore.includes(m.id);
    const col = done ? "#7fff9a" : "#e8e2f0";
    text(cv, done ? "+" : "-", x + 4, y + 4 + i * 9, col);
    text(cv, m.label, x + 10, y + 4 + i * 9, col);
    if (!done) text(cv, `${pr.v}/${m.target}`, x + 146 - textWidth(`${pr.v}/${m.target}`), y + 4 + i * 9, "#ffd36e");
  });
}

export function drawHud(cv, run, missions, doneBefore, muted, touch = false) {
  panel(cv, 4, 4, 96, 22);
  text(cv, `${run.score}`, 8, 8, "#ffffff", 1, 2);
  text(cv, `${meters(run)} M`, 70, 8, "#ffd36e");
  for (let i = 0; i < 3; i++) heart(cv, 70 + i * 9, 16, i < run.lives);
  if (run.combo >= 2) text(cv, `COMBO ${run.combo}`, 8, 30, "#ff7ab8");
  missionsBox(cv, run, missions, doneBefore, W - 154, 4);
  if (!touch) text(cv, muted ? "M: SIN SONIDO" : "M: SONIDO", W - 56, H - 9, "#ffffff", 0.5);
}

export function drawTitle(cv, t, progressData, missions, touch = false) {
  panel(cv, 90, 40, 300, 150);
  const title = "VAINI SKATE";
  text(cv, title, W / 2 - textWidth(title, 4) / 2 + 2, 52 + 2, "#2a1a30", 1, 4);
  text(cv, title, W / 2 - textWidth(title, 4) / 2, 52, "#fff6c8", 1, 4);
  text(cv, `NIVEL ${progressData.level + 1}   RÉCORD ${progressData.best}`, 150, 82, "#ffd36e");
  text(cv, "RETOS DE ESTE NIVEL", 172, 98, "#ff7ab8");
  missions.forEach((m, i) => text(cv, `${progressData.done.includes(m.id) ? "+" : "-"} ${m.label}`, 150, 110 + i * 9, progressData.done.includes(m.id) ? "#7fff9a" : "#e8e2f0"));
  const help = touch
    ? ["SALTAR: TOCA. MANTÉN PARA SUBIR MÁS", "OTRA VEZ EN EL AIRE: KICKFLIP. BAJAR: CAER"]
    : ["ESPACIO O TOCAR: SALTAR. MANTÉN: MÁS ALTO", "OTRA VEZ EN EL AIRE: KICKFLIP. ABAJO: CAER"];
  help.forEach((h, i) => text(cv, h, W / 2 - textWidth(h) / 2, 146 + i * 10, "#ffffff", 0.8));
  const start = touch ? "TOCA PARA EMPEZAR" : "PRESIONA PARA EMPEZAR";
  if (Math.sin(t * 5) > -0.3) text(cv, start, W / 2 - textWidth(start, 2) / 2, 170, "#7fff9a", 1, 2);
}

export function drawGameOver(cv, run, t, progressData, newBest, levelUp, missions, touch = false) {
  panel(cv, 110, 44, 260, 140);
  const title = "FIN DE LA RONDA";
  text(cv, title, W / 2 - textWidth(title, 3) / 2, 54, "#ff7ab8", 1, 3);
  text(cv, `PUNTOS ${run.score}`, 150, 80, "#ffffff", 1, 2);
  text(cv, `${meters(run)} M   COMBO ${run.bestCombo}   ${run.stats.stars} ESTRELLAS`, 150, 96, "#ffd36e");
  if (newBest) text(cv, "¡NUEVO RÉCORD!", 150, 106, "#7fff9a");
  if (levelUp) text(cv, `¡RETOS COMPLETOS! SUBES A NIVEL ${progressData.level + 1}`, 130, 116, "#7fff9a");
  missions.forEach((m, i) => { const d = progressData.done.includes(m.id); text(cv, `${d ? "+" : "-"} ${m.label}`, 150, 130 + i * 9, d ? "#7fff9a" : "#e8e2f0"); });
  const again = touch ? "TOCA PARA REINTENTAR" : "PRESIONA PARA REINTENTAR";
  if (Math.sin(t * 5) > -0.3 && t > 0.8) text(cv, again, W / 2 - textWidth(again, 2) / 2, 166, "#ffffff", 1, 2);
}

export function drawWorld(cv, run, fx, dt, missionToast) {
  sky(cv, run);
  farSkyline(cv, run);
  midBuildings(cv, run);
  street(cv, run);
  lamps(cv, run);
  for (const o of run.obstacles) obstacle(cv, run, o);
  for (const s of run.stars) star(cv, screenX(run, s.x), s.y, run.time);
  player(cv, run);
  drawFx(cv, fx, dt);
  if (missionToast) {
    const w = textWidth(missionToast.text, 2) + 16, x = W / 2 - w / 2, a = Math.min(1, missionToast.life * 2);
    rect(cv, x, 60, w, 20, "#2a7a4a", 0.85 * a); text(cv, missionToast.text, x + 8, 65, "#ffffff", a, 2);
  }
}
