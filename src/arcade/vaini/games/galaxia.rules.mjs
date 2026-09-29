// Galaxia: Vaini vuela en una nave y defiende el café de una flota de donas, tazas y cruasanes.
// Arrastras para mover, la nave dispara sola. Cada oleada trae más enemigos, picados más seguidos y balas más rápidas;
// cada 4 oleadas llega un jefe (la cafetera). Las hojas lima mejoran el disparo y los corazones dan una vida.
import { rng } from "../rng.mjs";

export const K = {
  SHIP_Y: 232, SHIP_HALF_W: 10, SHIP_HALF_H: 6, SHIP_SPEED: 340, BULLET_SPEED: 400, FIRE: 0.27, MAX_LIVES: 5, START_LIVES: 3,
  DX: 34, DY: 25, TOP: 46, INVULN: 1.7, ENEMY_R: 8,
};
export const KINDS = { dona: { pts: 10, hp: 1 }, taza: { pts: 20, hp: 1 }, cruasan: { pts: 30, hp: 1 } };

/** One place for how hard a wave is, so drawing, tests and the bot read the same numbers. */
export function wave(n) {
  const boss = n % 4 === 0;
  return {
    boss,
    rows: Math.min(4, 2 + Math.floor((n - 1) / 2)), cols: Math.min(8, 5 + Math.floor((n - 1) / 2)),
    diveEvery: Math.max(0.65, 2.6 - n * 0.17), diveSpeed: 120 + n * 10, bulletSpeed: 110 + n * 8, fireEvery: Math.max(0.38, 1.5 - n * 0.1),
    hpBonus: n >= 11 ? 2 : n >= 6 ? 1 : 0, bossHp: 22 + n * 3,
  };
}

export function create(seed = 9) {
  return {
    seed, rand: rng(seed), t: 0, started: false, over: false, deadT: 0, score: 0,
    x: 240, targetX: 240, lives: K.START_LIVES, invuln: 0, power: 1, fireT: 0, key: 0, lean: 0,
    wave: 0, waveDelay: 0.8, waveT: 9, enemies: [], bullets: [], shots: [], drops: [], boss: null,
    diveT: 2, fireEnemyT: 1.5, ox: 240, breathe: 0, events: [], kills: 0,
  };
}

export const aim = (s, x) => { s.targetX = Math.max(K.SHIP_HALF_W + 4, Math.min(480 - K.SHIP_HALF_W - 4, x)); };
export function tap(s) { if (!s.over) s.started = true; }

function slot(s, e) {
  const w = s.cfg, breathe = 1 + Math.sin(s.t * 1.4) * 0.05;
  return { x: s.ox + (e.col - (w.cols - 1) / 2) * K.DX * breathe, y: K.TOP + e.row * K.DY + Math.sin(s.t * 2 + e.col) * 1.5 };
}

function spawnWave(s) {
  s.wave++;
  s.cfg = wave(s.wave);
  s.waveT = 0;
  s.events.push({ type: "wave", n: s.wave, boss: s.cfg.boss });
  s.bullets.length = 0;
  if (s.cfg.boss) {
    s.boss = { x: 240, y: -50, hp: s.cfg.bossHp, max: s.cfg.bossHp, dir: 1, fireT: 1.6, hit: 0, enter: 0 };
    s.enemies = [];
    return;
  }
  s.boss = null;
  s.enemies = [];
  const kinds = ["cruasan", "taza", "taza", "dona"];
  let i = 0;
  for (let row = 0; row < s.cfg.rows; row++) for (let col = 0; col < s.cfg.cols; col++) {
    const kind = kinds[Math.min(row, 3)];
    const side = (col + row) % 2 ? -1 : 1;
    s.enemies.push({ kind, col, row, x: side > 0 ? 500 : -20, y: -20, state: "enter", t: -i * 0.09, sx: side > 0 ? 500 : -20, hp: KINDS[kind].hp + s.cfg.hpBonus, flash: 0, wob: s.rand() * 6 });
    i++;
  }
}

export function step(s, dt) {
  s.t += dt; s.waveT += dt; s.invuln = Math.max(0, s.invuln - dt);
  if (!s.started) { s.x += (240 + Math.sin(s.t * 1.3) * 90 - s.x) * Math.min(1, dt * 3); s.ox = 240 + Math.sin(s.t * 0.6) * 40; s.cfg = s.cfg || wave(1); return; }
  if (s.over) { s.deadT += dt; return; }

  // ship: follows the finger, or the arrow keys
  if (s.key) aim(s, s.targetX + s.key * K.SHIP_SPEED * dt);
  const dx = s.targetX - s.x;
  s.x += Math.max(-K.SHIP_SPEED * dt, Math.min(K.SHIP_SPEED * dt, dx * 14 * dt));
  s.lean += ((dx / 60) - s.lean) * Math.min(1, dt * 10);

  // auto fire
  s.fireT -= dt;
  if (s.fireT <= 0) {
    s.fireT = K.FIRE - (s.power - 1) * 0.02;
    const offs = s.power === 1 ? [0] : s.power === 2 ? [-6, 6] : [-8, 0, 8];
    offs.forEach((o, i) => s.shots.push({ x: s.x + o, y: K.SHIP_Y - 14, vx: s.power === 3 ? (i - 1) * 40 : 0 }));
    s.events.push({ type: "shoot" });
  }

  // waves
  if (!s.cfg || (s.enemies.length === 0 && !s.boss)) {
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) { spawnWave(s); s.waveDelay = 1.5; }
  }
  if (s.cfg) {
    s.ox = 240 + Math.sin(s.t * 0.6) * (s.cfg.cols >= 7 ? 26 : 50);
    stepEnemies(s, dt);
  }
  stepBoss(s, dt);
  stepShots(s, dt);
}

const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

function stepEnemies(s, dt) {
  const cfg = s.cfg;
  s.diveT -= dt; s.fireEnemyT -= dt;
  const formed = s.enemies.filter((e) => e.state === "formation");
  if (s.diveT <= 0 && formed.length > 1) {
    s.diveT = cfg.diveEvery * (0.75 + s.rand() * 0.5);
    const e = formed[Math.floor(s.rand() * formed.length)];
    e.state = "dive"; e.t = 0; e.sx = e.x; e.aimX = s.x + (s.rand() - 0.5) * 60; e.fired = false;
  }
  if (s.fireEnemyT <= 0 && formed.length) {
    s.fireEnemyT = cfg.fireEvery * (0.7 + s.rand() * 0.6);
    const shooters = formed.filter((e) => !formed.some((o) => o.col === e.col && o.row > e.row));
    const e = shooters[Math.floor(s.rand() * shooters.length)] || formed[0];
    s.bullets.push({ x: e.x, y: e.y + 8, vx: 0, vy: cfg.bulletSpeed });
  }
  for (const e of s.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.t += dt;
    if (e.t < 0) continue;
    const sl = slot(s, e);
    if (e.state === "enter") {                       // swoop in from the side along a curve
      const k = Math.min(1, e.t / 1.3);
      e.x = bez(e.sx, s.ox, sl.x, k) + Math.sin(k * 6 + e.wob) * 6 * (1 - k); e.y = bez(-20, 150, sl.y, k);
      if (k >= 1) e.state = "formation";
    } else if (e.state === "formation") { e.x = sl.x; e.y = sl.y; }
    else if (e.state === "dive") {                   // sine dive toward where the player was
      const k = e.t * cfg.diveSpeed / 230;
      e.y += cfg.diveSpeed * dt;
      e.x = e.sx + (e.aimX - e.sx) * Math.min(1, k * 0.9) + Math.sin(e.t * 4 + e.wob) * 38 * Math.min(1, k);
      if (!e.fired && e.y > 100) { e.fired = true; s.bullets.push({ x: e.x, y: e.y + 6, vx: (s.x - e.x) * 0.4, vy: cfg.bulletSpeed * 0.9 }); }
      if (e.y > 290) { e.state = "return"; e.t = 0; e.y = -20; e.sx = e.x; }
    } else if (e.state === "return") {
      const k = Math.min(1, e.t / 1.0);
      e.x = bez(e.sx, (e.sx + sl.x) / 2, sl.x, k); e.y = bez(-20, 40, sl.y, k);
      if (k >= 1) e.state = "formation";
    }
    // collision with the ship
    if (s.invuln <= 0 && Math.abs(e.x - s.x) < K.ENEMY_R + K.SHIP_HALF_W - 2 && Math.abs(e.y - (K.SHIP_Y - 4)) < K.ENEMY_R + K.SHIP_HALF_H) { hurt(s); killEnemy(s, e, true); }
  }
  s.enemies = s.enemies.filter((e) => !e.dead);
}

function stepBoss(s, dt) {
  const b = s.boss;
  if (!b) return;
  b.hit = Math.max(0, b.hit - dt);
  if (b.y < 62) { b.y += 60 * dt; return; }
  b.x += b.dir * (50 + s.wave * 4) * dt;
  if (b.x > 420) b.dir = -1; if (b.x < 60) b.dir = 1;
  b.fireT -= dt;
  if (b.fireT <= 0) {
    b.fireT = Math.max(0.7, 1.5 - s.wave * 0.05);
    for (const vx of [-50, 0, 50]) s.bullets.push({ x: b.x, y: b.y + 20, vx, vy: s.cfg.bulletSpeed });
    s.events.push({ type: "bossFire" });
  }
}

function stepShots(s, dt) {
  for (const p of s.shots) { p.y -= K.BULLET_SPEED * dt; p.x += p.vx * dt; }
  for (const p of s.shots) {
    for (const e of s.enemies) {
      if (e.dead || e.t < 0 || e.state === "enter") continue;
      if (Math.abs(p.x - e.x) < K.ENEMY_R + 2 && Math.abs(p.y - e.y) < K.ENEMY_R + 3) {
        p.dead = true; e.hp--; e.flash = 0.1;
        if (e.hp <= 0) killEnemy(s, e, e.state === "dive"); else s.events.push({ type: "hitEnemy" });
        break;
      }
    }
    const b = s.boss;
    if (!p.dead && b && b.y >= 60 && Math.abs(p.x - b.x) < 34 && Math.abs(p.y - b.y) < 24) {
      p.dead = true; b.hp--; b.hit = 0.08; s.events.push({ type: "hitEnemy" });
      if (b.hp <= 0) { s.score += 500; s.events.push({ type: "bossDown", x: b.x, y: b.y }); s.drops.push({ x: b.x, y: b.y, kind: "heart", vy: 40 }); s.drops.push({ x: b.x - 20, y: b.y, kind: "leaf", vy: 40 }); s.boss = null; }
    }
  }
  s.shots = s.shots.filter((p) => !p.dead && p.y > -10);
  for (const b of s.bullets) {
    b.x += (b.vx || 0) * dt; b.y += b.vy * dt;
    if (s.invuln <= 0 && Math.abs(b.x - s.x) < K.SHIP_HALF_W && Math.abs(b.y - (K.SHIP_Y - 2)) < K.SHIP_HALF_H + 3) { b.dead = true; hurt(s); }
  }
  s.bullets = s.bullets.filter((b) => !b.dead && b.y < 285 && b.x > -10 && b.x < 490);
  for (const d of s.drops) {
    d.y += d.vy * dt;
    if (Math.abs(d.x - s.x) < 16 && Math.abs(d.y - (K.SHIP_Y - 8)) < 14) {
      d.dead = true;
      if (d.kind === "leaf") { s.power = Math.min(3, s.power + 1); s.score += 50; s.events.push({ type: "power", n: s.power }); }
      else { s.lives = Math.min(K.MAX_LIVES, s.lives + 1); s.events.push({ type: "life" }); }
    }
  }
  s.drops = s.drops.filter((d) => !d.dead && d.y < 285);
}

function killEnemy(s, e, diving) {
  e.dead = true; s.kills++;
  const pts = KINDS[e.kind].pts * (diving ? 2 : 1);
  s.score += pts;
  s.events.push({ type: "kill", x: e.x, y: e.y, kind: e.kind, pts });
  const r = s.rand();
  if (r < 0.1) s.drops.push({ x: e.x, y: e.y, kind: "leaf", vy: 50 });
  else if (r < 0.135) s.drops.push({ x: e.x, y: e.y, kind: "heart", vy: 50 });
}

function hurt(s) {
  s.lives--; s.invuln = K.INVULN; s.power = Math.max(1, s.power - 1);
  s.events.push({ type: "hurt" });
  if (s.lives <= 0) { s.over = true; s.events.push({ type: "hit" }); }
}
