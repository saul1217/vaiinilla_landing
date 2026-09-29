// Apila: Vaini viaja sobre una caja que va de lado a lado. Un toque la suelta; lo que sobresale se cae.
// Cada 10 cajas sube el nivel (más velocidad). Tres perfectos seguidos devuelven un poco de ancho.
import { rng } from "../rng.mjs";

export const K = { HOVER: 26, BH: 16, BASE_W: 150, GROUND: 236, PERFECT: 4, SPEED0: 96, SPEED_MAX: 270, DROP_TIME: 0.11, MIN_W: 3, PER_LEVEL: 10, GROW: 6, GROW_AT: 3 };
export const levelOf = (score) => Math.floor(score / K.PER_LEVEL) + 1;
export const speedFor = (score) => Math.min(K.SPEED_MAX, K.SPEED0 + (levelOf(score) - 1) * 20 + score * 1.4);

export function create(seed = 5) {
  const s = {
    seed, rand: rng(seed), t: 0, started: false, over: false, deadT: 0, score: 0, level: 1, levelT: 9,
    stack: [{ x: 240 - K.BASE_W / 2, w: K.BASE_W, hue: 0 }],
    cur: null, drop: null, lastDrop: null, cam: 0, camTarget: 0, pieces: [], events: [], combo: 0, hop: 9,
  };
  spawn(s);
  return s;
}

function spawn(s) {
  const top = s.stack[s.stack.length - 1];
  const fromLeft = s.stack.length % 2 === 1;
  s.cur = { w: top.w, x: fromLeft ? 0 : 480 - top.w, dir: fromLeft ? 1 : -1, hue: s.stack.length };
}

export const topY = (s) => K.GROUND - s.stack.length * K.BH;

export function tap(s) {
  if (s.over) return;
  if (!s.started) { s.started = true; return; }
  if (s.drop || !s.cur) return;
  s.drop = { t: 0, x: s.cur.x, w: s.cur.w, hue: s.cur.hue };
  s.cur = null;
  s.events.push({ type: "release" });
}

export function step(s, dt) {
  s.t += dt;
  s.hop += dt;
  s.levelT += dt;
  s.cam += (s.camTarget - s.cam) * Math.min(1, dt * 5);
  for (const p of s.pieces) { p.vy += 1500 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; }
  s.pieces = s.pieces.filter((p) => p.y - s.cam < 340);
  if (!s.started) {
    if (s.cur) { s.cur.x += s.cur.dir * K.SPEED0 * 0.7 * dt; bounce(s.cur); }
    return;
  }
  if (s.over) { s.deadT += dt; return; }

  if (s.cur) {
    const spd = speedFor(s.score);
    s.cur.x += s.cur.dir * spd * dt;
    bounce(s.cur);
  }
  if (s.drop) {
    s.drop.t += dt;
    if (s.drop.t >= K.DROP_TIME) land(s);
  }
}

function bounce(b) {
  if (b.x < 0) { b.x = 0; b.dir = 1; }
  if (b.x + b.w > 480) { b.x = 480 - b.w; b.dir = -1; }
}

function land(s) {
  const d = s.drop; s.drop = null; s.lastDrop = d;
  const top = s.stack[s.stack.length - 1];
  const l = Math.max(d.x, top.x), r = Math.min(d.x + d.w, top.x + top.w), w = r - l;
  const y = topY(s) - K.BH;
  if (w < K.MIN_W) {                       // full miss: the block falls with Vaini
    s.pieces.push({ x: d.x, w: d.w, y, vy: 0, vx: 0, vr: (s.rand() - 0.5) * 3, rot: 0, hue: d.hue });
    s.over = true; s.events.push({ type: "hit" });
    return;
  }
  const perfect = Math.abs(d.x - top.x) < K.PERFECT;
  let block;
  if (perfect) {
    s.combo++;
    const grow = s.combo >= K.GROW_AT ? Math.min(K.GROW, K.BASE_W - top.w) : 0;   // a streak of perfects earns width back
    block = { x: Math.max(0, Math.min(480 - top.w - grow, top.x - grow / 2)), w: top.w + grow, hue: d.hue };
    if (grow > 0) s.events.push({ type: "grow" });
  }
  else {
    s.combo = 0;
    block = { x: l, w, hue: d.hue };
    const overL = l - d.x, overR = d.x + d.w - r;
    if (overL > 0) s.pieces.push({ x: d.x, w: overL, y, vy: 0, vx: -30, vr: -1.4, rot: 0, hue: d.hue });
    if (overR > 0) s.pieces.push({ x: r, w: overR, y, vy: 0, vx: 30, vr: 1.4, rot: 0, hue: d.hue });
  }
  s.stack.push(block);
  s.score++;
  s.hop = 0;
  const lv = levelOf(s.score);
  if (lv > s.level) { s.level = lv; s.levelT = 0; s.events.push({ type: "level", n: lv }); }
  s.camTarget = Math.max(0, s.stack.length * K.BH - 120);
  s.events.push({ type: perfect ? "perfect" : "place", combo: s.combo, x: block.x + block.w / 2, y });
  spawn(s);
}
