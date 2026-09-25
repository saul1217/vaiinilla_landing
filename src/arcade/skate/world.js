// Game rules for Vaini Skate: physics, obstacles, tricks and scoring. No drawing, no DOM.
import { mulberry } from "./raster.js";

export const GROUND = 226;          // feet line on the street
export const PLAYER_X = 120;        // Vaini's fixed screen x
const GRAVITY = 980;
const JUMP_V = -310;
const HOLD_GRAVITY = 0.52;          // gravity multiplier while jump is held and rising
const FAST_FALL = 2.4;
const FLIP_TIME = 0.42;
const START_SPEED = 150, MAX_SPEED = 330, ACCEL = 4.2;   // px/s, px/s²
const INVULNERABLE = 1.4;
const HALF_W = 11, BODY_H = 36;

// Obstacle kinds: size, whether you can grind on top, points for clearing.
export const KINDS = {
  cone:  { w: 12, h: 16, grind: false, clear: 100 },
  bin:   { w: 16, h: 28, grind: false, clear: 150 },
  bench: { w: 44, h: 18, grind: true,  clear: 100 },
  rail:  { w: 96, h: 30, grind: true,  clear: 120 },
};

export function createRun(seed = Date.now() % 100000) {
  return {
    rng: mulberry(seed),
    time: 0,
    distance: 0,             // px travelled
    speed: START_SPEED,
    score: 0,
    lives: 3,
    over: false,
    combo: 0, bestCombo: 0,
    player: { y: GROUND, vy: 0, grounded: true, grinding: null, flip: 0, flipping: false, hurt: 0, stumble: 0, holdJump: false, fastFall: false, airTime: 0 },
    obstacles: [],           // { kind, x, cleared, grindCounted }
    stars: [],               // { x, y, taken }
    nextSpawn: 420,
    stats: { cones: 0, jumps: 0, kickflips: 0, grinds: 0, stars: 0, hits: 0, cleanDistance: 0 },
    events: [],              // drained by the presentation layer each frame: { type, x, y, text }
  };
}

const worldX = (run, screenX) => screenX + run.distance;
const screenX = (run, wx) => wx - run.distance;
const emit = (run, type, extra = {}) => run.events.push({ type, ...extra });

function addPoints(run, base, label) {
  run.combo += 1;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  const mult = 1 + Math.floor(run.combo / 3);
  const pts = base * mult;
  run.score += pts;
  emit(run, "points", { text: `${label} +${pts}${mult > 1 ? ` x${mult}` : ""}` });
}

// ---------- input ----------
export function pressJump(run) {
  const p = run.player;
  if (run.over || p.stumble > 0) return;
  if (p.grounded || p.grinding) {
    p.vy = JUMP_V;
    p.grounded = false;
    p.grinding = null;
    p.holdJump = true;
    p.airTime = 0;
    run.stats.jumps += 1;
    emit(run, "jump");
  } else if (!p.flipping && p.flip === 0) {
    p.flipping = true;           // kickflip: must finish before landing
    emit(run, "flip");
  }
}
export function releaseJump(run) { run.player.holdJump = false; }
export function setFastFall(run, on) { run.player.fastFall = on; }

// ---------- spawning ----------
function spawn(run) {
  const r = run.rng;
  const level = Math.min(1, run.distance / 12000);
  const roll = r();
  const at = worldX(run, 520);
  if (roll < 0.34) run.obstacles.push({ kind: "cone", x: at, cleared: false });
  else if (roll < 0.52) run.obstacles.push({ kind: "bin", x: at, cleared: false });
  else if (roll < 0.74) run.obstacles.push({ kind: "bench", x: at, cleared: false });
  else run.obstacles.push({ kind: "rail", x: at, cleared: false });
  // double cone pattern gets likelier with distance
  if (r() < 0.25 * level) run.obstacles.push({ kind: "cone", x: at + 70, cleared: false });
  // an arc of stars over the obstacle
  if (r() < 0.7) {
    const n = 5, peak = 50 + r() * 30;
    for (let i = 0; i < n; i++) run.stars.push({ x: at - 40 + i * 22, y: GROUND - 20 - Math.sin((i / (n - 1)) * Math.PI) * peak, taken: false });
  }
  const gap = 150 + r() * 140 - level * 60 + run.speed * 0.25;
  run.nextSpawn = run.distance + gap;
}

// ---------- step ----------
export function step(run, dt) {
  if (run.over) return;
  const p = run.player;
  run.time += dt;
  run.speed = Math.min(MAX_SPEED, run.speed + ACCEL * dt);
  if (p.stumble > 0) { p.stumble -= dt; run.speed = Math.max(START_SPEED * 0.6, run.speed - 200 * dt); }
  run.distance += run.speed * dt;
  if (p.hurt > 0) p.hurt -= dt;
  if (p.hurt <= 0) run.stats.cleanDistance += run.speed * dt;
  if (run.distance >= run.nextSpawn) spawn(run);

  // vertical motion
  if (p.grinding) {
    const o = p.grinding;
    p.y = GROUND - KINDS[o.kind].h;
    if (!o.grindCounted) { o.grindCounted = true; run.stats.grinds += 1; addPoints(run, 150, "GRIND"); }
    run.score += Math.round(60 * dt);
    emit(run, "grindSpark");
    if (screenX(run, o.x) + KINDS[o.kind].w / 2 < PLAYER_X - HALF_W) { p.grinding = null; p.grounded = false; p.vy = -60; }
  } else if (!p.grounded) {
    const g = GRAVITY * (p.holdJump && p.vy < 0 ? HOLD_GRAVITY : 1) * (p.fastFall ? FAST_FALL : 1);
    p.vy += g * dt;
    p.y += p.vy * dt;
    p.airTime += dt;
    if (p.flipping) { p.flip += dt; if (p.flip >= FLIP_TIME) { p.flipping = false; p.flip = 0; run.stats.kickflips += 1; addPoints(run, 250, "KICKFLIP"); } }
    // land on a grindable top
    if (p.vy > 0) for (const o of run.obstacles) {
      const k = KINDS[o.kind], sx = screenX(run, o.x);
      if (!k.grind || Math.abs(sx - PLAYER_X) > k.w / 2 + HALF_W - 4) continue;
      const top = GROUND - k.h;
      if (p.y >= top && p.y - p.vy * dt <= top + 2) { land(run, top); if (!run.over && p.stumble <= 0) p.grinding = o; break; }
    }
    if (!p.grinding && p.y >= GROUND) land(run, GROUND);
  }

  // obstacles: clearing and collisions
  for (const o of run.obstacles) {
    const k = KINDS[o.kind], sx = screenX(run, o.x);
    const overlapX = Math.abs(sx - PLAYER_X) < k.w / 2 + HALF_W - 3;
    if (overlapX && p.grinding !== o && p.y > GROUND - k.h + 3 && p.hurt <= 0) hit(run);
    if (!o.cleared && sx + k.w / 2 < PLAYER_X - HALF_W) {
      o.cleared = true;
      if (!o.hitThis && o.grindCounted !== true) {
        if (o.kind === "cone") run.stats.cones += 1;
        addPoints(run, k.clear, o.kind === "cone" ? "OLLIE" : "SALTO");
      }
    }
    if (overlapX && p.hurt > 0) o.hitThis = true;
  }
  // stars
  for (const s of run.stars) {
    if (s.taken) continue;
    const sx = screenX(run, s.x);
    if (Math.abs(sx - PLAYER_X) < 12 && Math.abs(s.y - (p.y - BODY_H / 2)) < 22) {
      s.taken = true; run.stats.stars += 1; run.score += 25; emit(run, "star", { x: sx, y: s.y });
    }
  }
  run.obstacles = run.obstacles.filter((o) => screenX(run, o.x) > -80);
  run.stars = run.stars.filter((s) => screenX(run, s.x) > -20 && !s.taken);
}

function land(run, y) {
  const p = run.player;
  p.y = y; p.vy = 0; p.grounded = y === GROUND; p.holdJump = false;
  emit(run, "land");
  if (p.flipping) { p.flipping = false; p.flip = 0; bail(run); }
}

function bail(run) {
  const p = run.player;
  run.combo = 0;
  p.stumble = 0.6;
  emit(run, "bail", { text: "¡CAÍDA!" });
}

function hit(run) {
  const p = run.player;
  run.lives -= 1;
  run.combo = 0;
  run.stats.hits += 1;
  run.stats.cleanDistance = 0;
  p.hurt = INVULNERABLE;
  p.stumble = 0.4;
  emit(run, "hit");
  if (run.lives <= 0) { run.over = true; emit(run, "gameover"); }
}

export const meters = (run) => Math.floor(run.distance / 20);
export { screenX, HALF_W, BODY_H, FLIP_TIME };
