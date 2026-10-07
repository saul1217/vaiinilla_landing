// Thumb-reach "Pedir" bar for phones: slides up once the hero buttons leave the screen
// and hides again while the closing call to action or the footer is visible.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SNAPPY, createSpring } from '../lib/spring';

const HIDDEN_OFFSET = 140;

export function StickyOrderBar({
  watch,
  children,
}: {
  watch: readonly string[];
  children: ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(createSpring(HIDDEN_OFFSET, SNAPPY));
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      setShown(visible.size === 0);
    });
    watch.forEach((selector) => {
      const target = document.querySelector(selector);
      if (target) observer.observe(target);
    });
    return () => observer.disconnect();
  }, [watch]);

  useEffect(() => {
    const offset = offsetRef.current;
    const unsubscribe = offset.subscribe((value) => {
      if (barRef.current) barRef.current.style.transform = `translateY(${value}%)`;
    });
    return () => {
      unsubscribe();
      offset.stop();
    };
  }, []);

  useEffect(() => {
    offsetRef.current.set(shown ? 0 : HIDDEN_OFFSET);
  }, [shown]);

  return (
    <div ref={barRef} className="sticky-order" aria-hidden={!shown} inert={!shown}>
      {children}
    </div>
  );
}
