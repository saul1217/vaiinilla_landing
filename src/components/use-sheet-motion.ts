// Native-style sheet motion: slides up on mount, follows a downward drag, and
// animates out before the caller unmounts it. Upward drags rubber-band.
import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react';
import { canAnimate, createSpring, prefersReducedMotion } from '../lib/spring';

const IOS_SHEET_EASE = 'cubic-bezier(.32, .72, 0, 1)';
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.8; // px per ms

export function useSheetMotion(onClosed: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!canAnimate(el) || prefersReducedMotion()) return;
    const animation = el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], {
      duration: 460,
      easing: IOS_SHEET_EASE,
    });
    return () => animation.cancel();
  }, []);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const close = useCallback(() => {
    const el = ref.current;
    if (closing.current) return;
    closing.current = true;
    if (!canAnimate(el) || prefersReducedMotion()) {
      onClosedRef.current();
      return;
    }
    const backdrop = el.parentElement?.querySelector('.alumno-motion-backdrop');
    if (canAnimate(backdrop ?? null)) backdrop!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    const current = getComputedStyle(el).transform;
    const animation = el.animate(
      [{ transform: current === 'none' ? 'none' : current }, { transform: 'translateY(100%)' }],
      { duration: 300, easing: IOS_SHEET_EASE, fill: 'forwards' },
    );
    animation.onfinish = () => onClosedRef.current();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { y: event.clientY, t: event.timeStamp, dy: 0, v: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const raw = event.clientY - d.y;
    const dt = Math.max(1, event.timeStamp - d.t);
    d.v = (raw - d.dy) / dt;
    d.dy = raw;
    d.t = event.timeStamp;
    const offset = raw >= 0 ? raw : -Math.sqrt(-raw) * 4;
    el.style.transform = `translateY(${offset}px)`;
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    if (d.dy > DISMISS_DISTANCE || d.v > DISMISS_VELOCITY) {
      close();
      return;
    }
    const back = createSpring(Math.max(d.dy, -20), { stiffness: 520, damping: 34 });
    const unsubscribe = back.subscribe((value) => {
      el.style.transform = value === 0 ? '' : `translateY(${value}px)`;
    });
    back.set(0);
    window.setTimeout(unsubscribe, 700);
  }, [close]);

  return {
    ref,
    close,
    dragHandle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
