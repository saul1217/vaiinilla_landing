// Self-playing order tracker for the landing: advances through the real order states
// while it is on screen, with one progress bar that springs to each step.
import { useEffect, useRef, useState } from 'react';
import { SOFT, createSpring, prefersReducedMotion } from '../lib/spring';

const STEPS = [
  { label: 'Pagado', headline: 'Pago recibido', detail: 'Tu pedido ya llegó a cocina.' },
  { label: 'Preparando', headline: 'Lo están preparando', detail: 'Sigue con lo tuyo, te avisamos.' },
  { label: 'Listo', headline: '¡Listo para recoger!', detail: 'Muestra tu código en la barra.' },
  { label: 'Entregado', headline: 'Buen provecho', detail: 'Pedido entregado.' },
] as const;

const STEP_MS = 2200;
const READY = 2;

export function OrderTrackerDemo() {
  const [step, setStep] = useState(prefersReducedMotion() ? READY : 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef(createSpring(0, SOFT));

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (!entry?.isIntersecting) return;
      timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS.length), STEP_MS);
    }, { threshold: 0.4 });
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const progress = progressRef.current;
    const unsubscribe = progress.subscribe((value) => {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${value})`;
    });
    return () => {
      unsubscribe();
      progress.stop();
    };
  }, []);

  useEffect(() => {
    progressRef.current.set(step / (STEPS.length - 1));
  }, [step]);

  const current = STEPS[step] ?? STEPS[0];
  return (
    <div ref={rootRef} className="tracker-demo" aria-label="Ejemplo de seguimiento de un pedido">
      <div className="tracker-demo__head">
        <span className="tracker-demo__order">Pedido #93</span>
        <span className={`tracker-demo__badge${step >= READY ? ' is-ready' : ''}`}>{current.label}</span>
      </div>
      <div key={step} className="tracker-demo__status">
        <strong>{current.headline}</strong>
        <span>{current.detail}</span>
      </div>
      <div className="tracker-demo__bar" aria-hidden="true">
        <span ref={fillRef} className="tracker-demo__fill" />
      </div>
      <ol className="tracker-demo__steps">
        {STEPS.map((item, index) => (
          <li key={item.label} className={index <= step ? 'is-done' : undefined} aria-current={index === step ? 'step' : undefined}>
            {item.label}
          </li>
        ))}
      </ol>
      <div className={`tracker-demo__code${step === READY ? ' is-shown' : ''}`} aria-hidden={step !== READY}>
        <span>Código de retiro</span>
        <strong>#93</strong>
      </div>
    </div>
  );
}
