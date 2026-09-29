// Vuela: Vaini cuelga de un globo y pasa entre lápices. Un toque = un aleteo.
// Cada 8 lápices sube el nivel: más velocidad, hueco más estrecho y, desde el nivel 3, lápices que se mueven.
import { rng } from "../rng.mjs";

export const K = {
  X: 120, R: 9, GROUND: 246, GRAVITY: 820, FLAP: -236, FALL_MAX: 330,
  SPEED0: 92, SPEED_MAX: 165, PILLAR_W: 30, GAP0: 100, GAP_MIN: 80, SPACING_PX: 150, TOP: 60, BOTTOM: 196,
  PER_LEVEL: 8, MOVING_FROM: 3,
};

export const levelOf = (score) => Math.floor(score / K.PER_LEVEL) + 1;
/** Difficulty knobs for a given level, in one place so drawing and tests read the same numbers. */
export function tuning(level) {
  return {
    speed: Math.min(K.SPEED_MAX, K.SPEED0 + (level - 1) * 9),
    gap: Math.max(K.GAP_MIN, K.GAP0 - (level - 1) * 2.5),
    amp: level >= K.MOVING_FROM ? Math.min(26, (level - K.MOVING_FROM + 1) * 6) : 0,
    freq: 1.1 + level * 0.07,
  };
}

export function create(seed = 7) {
  return {
    seed, rand: rng(seed), t: 0, dist: 0, started: false, over: false, deadT: 0,
    score: 0, level: 1, y: 118, vy: 0, speed: K.SPEED0, nextAt: 210, prevGap: 128, pillars: [], flapT: 9, levelT: 9, events: [],
  };
}

export function tap(s) {
  if (s.over) return;
  s.started = true;
  s.vy = K.FLAP;
  s.flapT = 0;
  s.events.push({ type: "flap" });
}

export const gapCenter = (p, t) => {
  const c = p.baseY + p.amp * Math.sin(t * p.freq + p.phase);
  return Math.max(p.gap / 2 + 26, Math.min(K.GROUND - 16 - p.gap / 2, c));
};

export function step(s, dt) {
  s.t += dt;
  s.flapT += dt;
  s.levelT += dt;
  if (!s.started) {                       // idle: hover on the title screen
    s.y = 118 + Math.sin(s.t * 3) * 6;
    s.dist += K.SPEED0 * 0.5 * dt;
    return;
  }
  if (s.over) {                           // fall to the ground after a hit, world stops
    s.deadT += dt;
    s.vy = Math.min(K.FALL_MAX, s.vy + K.GRAVITY * dt);
    s.y = Math.min(K.GROUND - 18, s.y + s.vy * dt);
    return;
  }
  const tune = tuning(s.level);
  s.speed = tune.speed;
  s.dist += s.speed * dt;
  s.vy = Math.min(K.FALL_MAX, s.vy + K.GRAVITY * dt);
  s.y += s.vy * dt;
  if (s.y < -8) { s.y = -8; s.vy = Math.max(0, s.vy); }

  if (s.dist >= s.nextAt) {
    s.nextAt = s.dist + K.SPACING_PX;
    const lo = K.TOP + tune.gap / 2, hi = K.BOTTOM - tune.gap / 2 + 20;
    const c = Math.max(lo, Math.min(hi, s.prevGap + (s.rand() - 0.5) * 120));
    s.prevGap = c;
    s.pillars.push({ x: 480 + 20, baseY: c, gapY: c, gap: tune.gap, amp: tune.amp, freq: tune.freq, phase: s.rand() * 6.28, passed: false });
  }
  for (const p of s.pillars) {
    p.x -= s.speed * dt;
    p.gapY = gapCenter(p, s.t);
    if (!p.passed && p.x + K.PILLAR_W < K.X - K.R) {
      p.passed = true; s.score++;
      s.events.push({ type: "score", n: s.score });
      const lv = levelOf(s.score);
      if (lv > s.level) { s.level = lv; s.levelT = 0; s.events.push({ type: "level", n: lv }); }
    }
    const inX = K.X + K.R > p.x + 2 && K.X - K.R < p.x + K.PILLAR_W - 2;
    if (inX && (s.y - K.R < p.gapY - p.gap / 2 || s.y + K.R > p.gapY + p.gap / 2)) return die(s);
  }
  s.pillars = s.pillars.filter((p) => p.x > -60);
  if (s.y + K.R + 8 > K.GROUND) return die(s);
}

function die(s) {
  s.over = true;
  s.vy = -120;
  s.events.push({ type: "hit" });
}
