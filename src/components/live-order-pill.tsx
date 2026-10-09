// Floating order status on the hero phone: one pill that morphs its width between
// "Preparando" and "Listo" so the visitor sees the product working before scrolling.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BOUNCY, createSpring, prefersReducedMotion } from '../lib/spring';

const STATES = [
  { tone: 'cooking', title: 'Preparando', detail: 'Pedido #93 · 2 productos' },
  { tone: 'ready', title: '¡Listo para recoger!', detail: 'Pasa a la barra con tu código' },
] as const;

const CYCLE_MS = 2800;

export function LiveOrderPill() {
  const [index, setIndex] = useState(0);
  const pillRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(createSpring(0, BOUNCY));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % STATES.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const width = widthRef.current;
    const unsubscribe = width.subscribe((value) => {
      if (pillRef.current && value > 0) pillRef.current.style.width = `${value}px`;
    });
    return () => {
      unsubscribe();
      width.stop();
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const target = content.scrollWidth;
    if (widthRef.current.value === 0) widthRef.current.jump(target);
    else widthRef.current.set(target);
  }, [index]);

  const state = STATES[index] ?? STATES[0];
  return (
    <div ref={pillRef} className={`live-pill live-pill--${state.tone}`} role="status" aria-live="polite">
      <div ref={contentRef} key={state.tone} className="live-pill__content">
        <span className="live-pill__icon" aria-hidden="true">
          {state.tone === 'ready' ? '✓' : <span className="live-pill__pulse" />}
        </span>
        <span className="live-pill__text">
          <strong>{state.title}</strong>
          <small>{state.detail}</small>
        </span>
      </div>
    </div>
  );
}
