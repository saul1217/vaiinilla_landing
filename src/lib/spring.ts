// Interruptible spring values driven by one shared requestAnimationFrame loop.
// Retargeting mid-flight keeps the current velocity, so repeated taps never jump.

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

export const SNAPPY: SpringConfig = { stiffness: 520, damping: 34 };
export const BOUNCY: SpringConfig = { stiffness: 420, damping: 18 };
export const SOFT: SpringConfig = { stiffness: 180, damping: 24 };

type Listener = (value: number, velocity: number) => void;

export interface Spring {
  readonly value: number;
  set(target: number): void;
  jump(value: number): void;
  subscribe(listener: Listener): () => void;
  stop(): void;
}

interface SpringState {
  value: number;
  target: number;
  velocity: number;
  config: Required<SpringConfig>;
  listeners: Set<Listener>;
}

const live = new Set<SpringState>();
let lastFrame = 0;
let ticking = false;

function tick(now: number) {
  const dt = Math.min(1 / 30, (now - lastFrame) / 1000);
  lastFrame = now;
  for (const s of live) {
    // Semi-implicit Euler in four substeps stays stable for stiff UI springs.
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      const force = -s.config.stiffness * (s.value - s.target) - s.config.damping * s.velocity;
      s.velocity += (force / s.config.mass) * h;
      s.value += s.velocity * h;
    }
    if (Math.abs(s.velocity) < 0.01 && Math.abs(s.value - s.target) < 0.001) {
      s.value = s.target;
      s.velocity = 0;
      live.delete(s);
    }
    s.listeners.forEach((listener) => listener(s.value, s.velocity));
  }
  if (live.size > 0) requestAnimationFrame(tick);
  else ticking = false;
}

function start(s: SpringState) {
  live.add(s);
  if (!ticking) {
    ticking = true;
    lastFrame = performance.now();
    requestAnimationFrame(tick);
  }
}

export function createSpring(initial: number, config: SpringConfig = SNAPPY): Spring {
  const s: SpringState = {
    value: initial,
    target: initial,
    velocity: 0,
    config: { mass: 1, ...config },
    listeners: new Set(),
  };
  return {
    get value() {
      return s.value;
    },
    set(target) {
      s.target = target;
      if (prefersReducedMotion()) {
        s.value = target;
        s.velocity = 0;
        s.listeners.forEach((listener) => listener(target, 0));
        return;
      }
      start(s);
    },
    jump(value) {
      s.value = s.target = value;
      s.velocity = 0;
      live.delete(s);
      s.listeners.forEach((listener) => listener(value, 0));
    },
    subscribe(listener) {
      s.listeners.add(listener);
      listener(s.value, s.velocity);
      return () => s.listeners.delete(listener);
    },
    stop() {
      live.delete(s);
      s.listeners.clear();
    },
  };
}

/** False in jsdom and very old browsers; callers then skip the animation, never the state change. */
export function canAnimate(el: Element | null): el is Element {
  return !!el && typeof el.animate === 'function';
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
