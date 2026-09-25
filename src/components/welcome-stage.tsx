// Android WelcomeMascotStage: eleven bubbles burst out of Vaini along a small arc
// (spin, scale 0.18 → 1) and settle at fixed spots above the mascot.
import { useLayoutEffect, useRef } from 'react';
import { canAnimate, prefersReducedMotion } from '../lib/spring';

// [image, x, y, size, start, curve, rotation], same values as StudentAuthLandingScreen.kt.
const BUBBLES = [
  ['jamaica', 0.47, 0.06, 34, 0.05, -18, -22],
  ['waffle', 0.2, 0.08, 32, 0.1, 22, 18],
  ['mascot_play', 0.61, 0.13, 46, 0.16, -26, -28],
  ['mascot_karate', 0.33, 0.15, 44, 0.22, 24, 30],
  ['torta', 0.76, 0.05, 34, 0.28, -20, -18],
  ['mascot_workshop', 0.3, 0.34, 40, 0.35, 28, 26],
  ['mascot_laptop', 0.08, 0.17, 38, 0.4, -26, -32],
  ['burrito', 0.16, 0.38, 28, 0.46, 20, 20],
  ['fruta', 0.66, 0.36, 32, 0.52, -22, -24],
  ['mascot_travel', 0.91, 0.19, 38, 0.56, 24, 32],
  ['quesadilla', 0.85, 0.4, 28, 0.58, -18, -20],
] as const;

const TIMELINE_MS = 2300;
const STEPS = 24;

// cubic-bezier(.22, 1, .36, 1) solved for y at x.
function easeOutLiz(x: number) {
  let t = x;
  for (let i = 0; i < 6; i++) {
    const bx = 3 * (1 - t) ** 2 * t * 0.22 + 3 * (1 - t) * t * t * 0.36 + t ** 3;
    const dx = 3 * (1 - t) ** 2 * 0.22 + 6 * (1 - t) * t * (0.36 - 0.22) + 3 * t * t * (1 - 0.36);
    if (dx === 0) break;
    t = Math.min(1, Math.max(0, t - (bx - x) / dx));
  }
  return 3 * (1 - t) ** 2 * t + 3 * (1 - t) * t * t + t ** 3;
}

export function WelcomeStage() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage || prefersReducedMotion()) return;
    const { width, height } = stage.getBoundingClientRect();
    const originX = width * 0.5;
    const originY = height * 0.66;
    const animations = [...stage.querySelectorAll<HTMLElement>('.alumno-welcome__bubble')].flatMap((el, index) => {
      const spec = BUBBLES[index];
      if (!spec || !canAnimate(el)) return [];
      const [, x, y, , start, curve, rotation] = spec;
      const fromX = originX - width * x;
      const fromY = originY - height * y;
      const frames = Array.from({ length: STEPS + 1 }, (_, step) => {
        const raw = step / STEPS;
        const p = easeOutLiz(raw);
        const arc = Math.sin(Math.PI * p);
        const scale = 0.18 + 0.82 * p;
        return {
          opacity: Math.min(1, raw * 4),
          transform: `translate(-50%, -50%) translate(${fromX * (1 - p) + curve * arc}px, ${fromY * (1 - p) - 8 * arc}px) rotate(${rotation * (1 - p)}deg) scale(${scale})`,
        };
      });
      return [el.animate(frames, { duration: TIMELINE_MS * 0.38, delay: 100 + start * TIMELINE_MS, fill: 'backwards' })];
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, []);

  return (
    <div className="alumno-welcome" ref={ref} aria-hidden="true">
      {BUBBLES.map(([name, x, y, size]) => (
        <img
          key={name}
          className="alumno-welcome__bubble"
          src={`/vaini/welcome/${name}.webp`}
          alt=""
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: size * 1.2, height: size * 1.2 }}
        />
      ))}
      <span className="alumno-welcome__disc" />
      <img className="alumno-welcome__vaini" src="/vaini/cutout-frente.png" alt="" />
    </div>
  );
}
