// Port of Android WaitingArcadeCard.kt: four one-tap games played while an order
// is on its way. Units are CSS px (Android dp), physics values copied 1:1.

export type ArcadeKind = 'flappy' | 'brinca' | 'apila' | 'gravedad' | 'skate';
export type ArcadeStatus = 'idle' | 'play' | 'dead';

export const ARCADE_KINDS: { kind: ArcadeKind; label: string; hint: string }[] = [
  { kind: 'flappy', label: 'Flappy', hint: 'Toca para volar' },
  { kind: 'brinca', label: 'Brinca', hint: 'Toca para brincar' },
  { kind: 'apila', label: 'Apila', hint: 'Toca para soltar' },
  { kind: 'gravedad', label: 'Gravedad', hint: 'Toca para cambiar la gravedad' },
  { kind: 'skate', label: 'Skate', hint: 'Toca para empezar' },
];

/** Things that just happened; the card turns them into sound, particles and shake. */
export interface ArcadeEvent {
  type: 'jump' | 'flap' | 'land' | 'score' | 'perfect' | 'drop' | 'gravity';
  x: number;
  y: number;
  /** Apila: the piece sliced off the block. */
  cut?: { x: number; w: number };
}

export interface ArcadeGame {
  readonly kind: ArcadeKind;
  score: number;
  events: ArcadeEvent[];
  reset(width: number, height: number): void;
  tap(): void;
  /** Advances physics; true when the run ended on this step. */
  step(dt: number, width: number, height: number): boolean;
}

type Random = () => number;

export class BrincaGame implements ArcadeGame {
  readonly kind = 'brinca';
  score = 0;
  events: ArcadeEvent[] = [];
  y = 0;
  vy = 0;
  speed = 175;
  nextIn = 0.6;
  obstacles: { x: number; w: number; h: number }[] = [];
  private pendingJump = false;
  private floor = 0;

  constructor(private random: Random = Math.random) {}

  floorY(height: number) {
    return height - 52;
  }

  reset(_width: number, height: number) {
    this.events = [];
    this.score = 0;
    this.y = this.floorY(height);
    this.vy = 0;
    this.speed = 175;
    this.nextIn = 0.6;
    this.obstacles = [];
  }

  tap() {
    this.pendingJump = true;
  }

  step(dt: number, width: number, height: number) {
    this.floor = this.floorY(height);
    if (this.pendingJump && this.y >= this.floor - 0.5) {
      this.vy = -575;
      this.events.push({ type: 'jump', x: 64, y: this.floor });
    }
    this.pendingJump = false;
    this.speed = Math.min(310, this.speed + 2.5 * dt);
    this.vy += 1750 * dt;
    this.y += this.vy * dt;
    if (this.y > this.floor) {
      if (this.vy > 200) this.events.push({ type: 'land', x: 64, y: this.floor });
      this.y = this.floor;
      this.vy = 0;
    }
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      this.nextIn = 0.85 + this.random() * 0.65;
      this.obstacles.push({ x: width + 20, w: 14 + this.random() * 6, h: 22 + this.random() * 22 });
    }
    const mx = 64;
    const r = 14;
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      if (mx + r > o.x && mx - r < o.x + o.w && this.y + r * 0.4 > this.floor - o.h) return true;
    }
    this.obstacles = this.obstacles.filter((o) => o.x >= -30);
    const before = Math.floor(this.score / 10);
    this.score += dt * 10;
    if (Math.floor(this.score / 10) > before) this.events.push({ type: 'score', x: 64, y: this.y - 40 });
    return false;
  }
}

export class FlappyGame implements ArcadeGame {
  readonly kind = 'flappy';
  score = 0;
  events: ArcadeEvent[] = [];
  y = 0;
  vy = 0;
  speed = 150;
  nextIn = 0;
  columns: { x: number; gapTop: number; gap: number; passed: boolean }[] = [];

  constructor(private random: Random = Math.random) {}

  reset(_width: number, height: number) {
    this.events = [];
    this.score = 0;
    this.y = height * 0.45;
    this.vy = 0;
    this.speed = 150;
    this.nextIn = 0;
    this.columns = [];
  }

  tap() {
    this.vy = -430;
    this.events.push({ type: 'flap', x: 70, y: this.y });
  }

  step(dt: number, width: number, height: number) {
    this.vy += 1650 * dt;
    this.y += this.vy * dt;
    this.speed = Math.min(235, this.speed + 3 * dt);
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      this.nextIn = 1.5;
      this.columns.push({ x: width + 30, gapTop: 80 + this.random() * Math.max(1, height - 220), gap: 122, passed: false });
    }
    const mx = 70;
    const r = 13;
    for (const c of this.columns) {
      c.x -= this.speed * dt;
      if (!c.passed && c.x + 46 < mx - r) {
        c.passed = true;
        this.score += 1;
        this.events.push({ type: 'score', x: 70, y: this.y });
      }
      if (mx + r > c.x && mx - r < c.x + 46 && (this.y - r < c.gapTop || this.y + r > c.gapTop + c.gap)) return true;
    }
    this.columns = this.columns.filter((c) => c.x >= -60);
    return this.y > height - 30 || this.y < -20;
  }
}

export class ApilaGame implements ArcadeGame {
  readonly kind = 'apila';
  score = 0;
  events: ArcadeEvent[] = [];
  stack: { x: number; w: number }[] = [];
  pos = 0;
  dir = 1;
  readonly blockH = 20;
  cam = 0;
  fall: { x: number; w: number; y: number; vy: number } | null = null;
  private pendingDrop = false;
  private died = false;

  top() {
    return this.stack[this.stack.length - 1] ?? { x: 0, w: 150 };
  }

  topY(height: number) {
    return height - 46 - (this.stack.length - 1) * this.blockH + this.cam;
  }

  reset(width: number) {
    this.events = [];
    this.score = 0;
    this.stack = [{ x: width / 2 - 75, w: 150 }];
    this.pos = 0;
    this.dir = 1;
    this.cam = 0;
    this.fall = null;
    this.pendingDrop = false;
    this.died = false;
  }

  tap() {
    this.pendingDrop = true;
  }

  private drop(width: number, height: number) {
    const top = this.top();
    const l = Math.max(this.pos, top.x);
    const r = Math.min(this.pos + top.w, top.x + top.w);
    const w = r - l;
    if (w <= 0) {
      this.fall = { x: this.pos, w: top.w, y: this.topY(height) - this.blockH, vy: 0 };
      return true;
    }
    const snap = Math.abs(this.pos - top.x) < 4;
    const y = this.topY(height) - this.blockH;
    if (snap) this.events.push({ type: 'perfect', x: top.x + top.w / 2, y });
    else {
      const cutX = this.pos < top.x ? this.pos : r;
      this.events.push({ type: 'drop', x: l + w / 2, y, cut: { x: cutX, w: top.w - w } });
    }
    this.stack.push({ x: snap ? top.x : l, w: snap ? top.w : w });
    this.score += 1;
    const odd = this.score % 2 === 1;
    this.pos = odd ? width - this.top().w : 0;
    this.dir = odd ? -1 : 1;
    return false;
  }

  step(dt: number, width: number, height: number) {
    if (this.pendingDrop) {
      this.pendingDrop = false;
      if (this.drop(width, height)) this.died = true;
    }
    const top = this.top();
    const speed = Math.min(300, 130 + this.score * 9);
    this.pos += this.dir * speed * dt;
    if (this.pos < 0) {
      this.pos = 0;
      this.dir = 1;
    }
    if (this.pos + top.w > width) {
      this.pos = width - top.w;
      this.dir = -1;
    }
    const want = Math.max(0, this.stack.length * this.blockH - (height - 150));
    this.cam += (want - this.cam) * Math.min(1, dt * 6);
    if (this.fall) {
      this.fall.vy += 1600 * dt;
      this.fall.y += this.fall.vy * dt;
    }
    return this.died;
  }
}

export class GravedadGame implements ArcadeGame {
  readonly kind = 'gravedad';
  score = 0;
  events: ArcadeEvent[] = [];
  gdir = 1;
  y = 0;
  vy = 0;
  speed = 180;
  nextIn = 0.8;
  obstacles: { x: number; w: number; side: number; passed: boolean }[] = [];

  constructor(private random: Random = Math.random) {}

  ceilY() {
    return 58;
  }

  floorY(height: number) {
    return height - 58;
  }

  reset(_width: number, height: number) {
    this.events = [];
    this.score = 0;
    this.gdir = 1;
    this.y = this.floorY(height);
    this.vy = 0;
    this.speed = 180;
    this.nextIn = 0.8;
    this.obstacles = [];
  }

  tap() {
    this.gdir *= -1;
    this.events.push({ type: 'gravity', x: 64, y: this.y });
  }

  step(dt: number, width: number, height: number) {
    this.speed = Math.min(300, this.speed + 2.5 * dt);
    this.vy += 2300 * this.gdir * dt;
    this.y += this.vy * dt;
    const target = this.gdir > 0 ? this.floorY(height) : this.ceilY();
    if ((this.gdir > 0 && this.y > target) || (this.gdir < 0 && this.y < target)) {
      if (Math.abs(this.vy) > 200) this.events.push({ type: 'land', x: 64, y: target });
      this.y = target;
      this.vy = 0;
    }
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      this.nextIn = 1 + this.random() * 0.6;
      this.obstacles.push({ x: width + 20, w: 38 + this.random() * 42, side: this.random() < 0.5 ? 1 : -1, passed: false });
    }
    const mx = 64;
    const r = 13;
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      if (!o.passed && o.x + o.w < mx - r) {
        o.passed = true;
        this.score += 1;
        this.events.push({ type: 'score', x: 64, y: this.y });
      }
      if (mx + r > o.x && mx - r < o.x + o.w) {
        const surface = o.side > 0 ? this.floorY(height) : this.ceilY();
        if (Math.abs(this.y - surface) < 22) return true;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x >= -100);
    return false;
  }
}

export function createGame(kind: ArcadeKind, random: Random = Math.random): ArcadeGame {
  if (kind === 'flappy') return new FlappyGame(random);
  if (kind === 'apila') return new ApilaGame();
  if (kind === 'gravedad') return new GravedadGame(random);
  return new BrincaGame(random);
}

// ---------- scores (top 8 per game, like PrefsArcadeScoreStore) ----------

const STORE_KEY = 'vaiinilla.arcade';

export function readScores(kind: ArcadeKind): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, unknown>;
    const list = raw[kind];
    return Array.isArray(list) ? list.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function recordScore(kind: ArcadeKind, score: number) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, number[]>;
    raw[kind] = [...readScores(kind), score].sort((a, b) => b - a).slice(0, 8);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(raw));
  } catch {
    // Private mode or blocked storage: the run still counts on screen.
  }
}

const SEEDS: Record<ArcadeKind, [string, number][]> = {
  flappy: [['LA COCINA', 9], ['DOÑA V', 6], ['CAJA', 4]],
  brinca: [['LA COCINA', 32], ['DOÑA V', 24], ['MESERO', 18]],
  apila: [['DOÑA V', 14], ['LA COCINA', 11], ['MESERO', 8]],
  gravedad: [['MESERO', 15], ['DOÑA V', 12], ['LA COCINA', 9]],
  skate: [['LA COCINA', 4200], ['DOÑA V', 2600], ['MESERO', 1500]],
};

export interface ArcadeBoardRow {
  name: string;
  points: number;
  me: boolean;
}

export function leaderboard(kind: ArcadeKind): ArcadeBoardRow[] {
  return [
    ...SEEDS[kind].map(([name, points]) => ({ name, points, me: false })),
    ...readScores(kind).map((points) => ({ name: 'TÚ', points, me: true })),
  ]
    .sort((a, b) => b.points - a.points)
    .slice(0, 7);
}
