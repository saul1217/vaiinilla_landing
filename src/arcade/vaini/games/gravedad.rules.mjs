// Gravedad: el autobús 17 de noche. Vaini corre por el piso o el techo; un toque invierte la gravedad.
import { rng } from "../rng.mjs";

export const K = {
  X: 100, FLOOR: 228, CEIL: 44, HALF_H: 17, HALF_W: 9, GRAVITY: 2400, VMAX: 780,
  SPEED0: 140, SPEED_MAX: 250, OB_H: 34,
};
export const KINDS = { floor: ["asiento", "mochila"], ceiling: ["paraguas", "agarradera"] };

export function create(seed = 3) {
  return {
    seed, rand: rng(seed), t: 0, dist: 0, started: false, over: false, deadT: 0, score: 0,
    dir: 1, y: K.FLOOR - K.HALF_H, vy: 0, speed: K.SPEED0, nextAt: 250, obstacles: [], flipT: 9, events: [],
  };
}

export const floorC = () => K.FLOOR - K.HALF_H;
export const ceilC = () => K.CEIL + K.HALF_H;

export function tap(s) {
  if (s.over) return;
  s.started = true;
  s.dir *= -1;
  s.flipT = 0;
  s.events.push({ type: "flip", dir: s.dir });
}

export function step(s, dt) {
  s.t += dt;
  s.flipT += dt;
  if (!s.started) { s.dist += 60 * dt; return; }
  if (s.over) { s.deadT += dt; return; }

  s.speed = Math.min(K.SPEED_MAX, K.SPEED0 + s.score * 2.2);
  s.dist += s.speed * dt;
  s.vy = Math.max(-K.VMAX, Math.min(K.VMAX, s.vy + K.GRAVITY * s.dir * dt));
  s.y += s.vy * dt;
  const f = floorC(), c = ceilC();
  if (s.y >= f) { if (s.vy > 200) s.events.push({ type: "land", dir: 1 }); s.y = f; s.vy = 0; }
  if (s.y <= c) { if (s.vy < -200) s.events.push({ type: "land", dir: -1 }); s.y = c; s.vy = 0; }

  if (s.dist >= s.nextAt) {
    const onFloor = s.rand() < 0.5;
    const names = onFloor ? KINDS.floor : KINDS.ceiling;
    const w = 28 + Math.floor(s.rand() * 26);
    s.obstacles.push({ x: 480 + 30, w, floor: onFloor, kind: names[Math.floor(s.rand() * names.length)], passed: false });
    s.nextAt = s.dist + s.speed * 0.95 + 60 + s.rand() * 90;
  }
  for (const o of s.obstacles) {
    o.x -= s.speed * dt;
    if (!o.passed && o.x + o.w < K.X - K.HALF_W) { o.passed = true; s.score++; s.events.push({ type: "score", n: s.score }); }
    const oy0 = o.floor ? K.FLOOR - K.OB_H : K.CEIL, oy1 = o.floor ? K.FLOOR : K.CEIL + K.OB_H;
    const hit = K.X + K.HALF_W - 3 > o.x && K.X - K.HALF_W + 3 < o.x + o.w &&
      s.y + K.HALF_H - 3 > oy0 && s.y - K.HALF_H + 3 < oy1;
    if (hit) { s.over = true; s.events.push({ type: "hit" }); return; }
  }
  s.obstacles = s.obstacles.filter((o) => o.x > -80);
}
