// Morphs an element's height whenever `key` changes (expand/collapse, content
// swap), so the box grows or shrinks instead of snapping. Children marked
// `data-morph-in` blur in with a small stagger after an expand.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { canAnimate, prefersReducedMotion } from './spring';

const EASE = 'cubic-bezier(.16, 1, .3, 1)';

export function useHeightMorph<T extends HTMLElement>(ref: RefObject<T | null>, key: unknown) {
  const last = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = last.current;
    const to = el.getBoundingClientRect().height;
    last.current = to;
    if (from === null || Math.abs(from - to) < 1 || !canAnimate(el) || prefersReducedMotion()) return;

    const grow = to > from;
    const box = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: grow ? 520 : 420,
      easing: EASE,
    });
    el.style.overflow = 'clip';
    box.onfinish = box.oncancel = () => {
      el.style.overflow = '';
      last.current = el.getBoundingClientRect().height;
    };

    const parts = grow ? [...el.querySelectorAll<HTMLElement>('[data-morph-in] > *')] : [];
    const reveals = parts.map((part, index) =>
      part.animate(
        [
          { opacity: 0, transform: 'translateY(8px)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', filter: 'none' },
        ],
        { duration: 420, delay: 60 + index * 45, easing: EASE, fill: 'backwards' },
      ),
    );
    return () => {
      box.cancel();
      reveals.forEach((reveal) => reveal.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
