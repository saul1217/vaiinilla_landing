// "How it works" steps: a grid on wide screens, a swipeable row on phones with one
// indicator that springs to the step in view.
import { useEffect, useRef, useState } from 'react';
import { SNAPPY, createSpring } from '../lib/spring';

export interface Step {
  title: string;
  body: string;
  image: string;
  alt: string;
}

const DOT_GAP = 18;

export function StepsCarousel({ steps }: { steps: readonly Step[] }) {
  const trackRef = useRef<HTMLOListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const positionRef = useRef(createSpring(0, SNAPPY));
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const card = track.firstElementChild as HTMLElement | null;
      if (!card) return;
      const stride = card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0');
      setActive(Math.max(0, Math.min(steps.length - 1, Math.round(track.scrollLeft / stride))));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
  }, [steps.length]);

  useEffect(() => {
    const position = positionRef.current;
    const unsubscribe = position.subscribe((value, velocity) => {
      const stretch = 1 + Math.min(0.6, Math.abs(velocity) / 40);
      if (indicatorRef.current) {
        indicatorRef.current.style.transform = `translateX(${value * DOT_GAP}px) scaleX(${stretch})`;
      }
    });
    return () => {
      unsubscribe();
      position.stop();
    };
  }, []);

  useEffect(() => {
    positionRef.current.set(active);
  }, [active]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (track && card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  };

  return (
    <div className="steps">
      <ol ref={trackRef} className="steps__track">
        {steps.map((step, index) => (
          <li key={step.title} className="step-card" data-reveal>
            <span className="step-card__n">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="step-card__phone device">
              <div className="device__screen">
                <img src={step.image} alt={step.alt} width="720" height="1476" loading="lazy" />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="steps__dots" role="tablist" aria-label="Pasos">
        <span ref={indicatorRef} className="steps__indicator" aria-hidden="true" />
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={`Paso ${index + 1}: ${step.title}`}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
