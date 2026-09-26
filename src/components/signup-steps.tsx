// Sign-up one question per screen, like the iOS/Android apps:
// email → password (reveal toggle) → name → legal. The last step submits the
// form, so account creation stays in AuthScreens.onPassword.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { LegalVersions } from '../types/api';

const STEPS = [
  { key: 'email', icon: 'M4 6h16v12H4zM4 7l8 6 8-6', title: '¿Cuál es tu correo?', lead: 'Te enviaremos un enlace para verificarlo.' },
  { key: 'password', icon: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z', title: 'Crea una contraseña', lead: 'Usa al menos 8 caracteres.' },
  { key: 'name', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0', title: '¿Cómo te llamas?', lead: 'Así te llamará la cafetería al entregar tu pedido.' },
  { key: 'legal', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Zm-3 9 2 2 4-4', title: 'Último paso', lead: 'Acepta los documentos para crear tu cuenta.' },
] as const;

export interface SignupStepsProps {
  email: string;
  password: string;
  nombre: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  legal: LegalVersions | null;
  busy: boolean;
  configured: boolean;
  error: string | null;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onNombre: (value: string) => void;
  onTerms: (value: boolean) => void;
  onPrivacy: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onExit: () => void;
  onLogin: () => void;
}

export function SignupSteps(props: SignupStepsProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;

  const email = props.email.trim();
  const canAdvance = [
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    props.password.length >= 8,
    props.nombre.trim().length > 0,
    props.acceptedTerms && props.acceptedPrivacy && Boolean(props.legal) && !props.busy && props.configured,
  ][step];

  useEffect(() => {
    // Wait for the slide to settle; focusing mid-transition drops the keyboard request on iOS.
    const id = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => window.clearTimeout(id);
  }, [step]);

  function go(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  function back() {
    if (step === 0) props.onExit();
    else go(step - 1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canAdvance) return;
    if (isLast) props.onSubmit(event);
    else go(step + 1);
  }

  return (
    <main id="main-content" className="alumno-signup">
      <form className="alumno-signup__form" onSubmit={submit} noValidate>
        <header className="alumno-signup__bar">
          <button className="alumno-signup__back" type="button" onClick={back} aria-label={step === 0 ? 'Cerrar' : 'Atrás'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="alumno-signup__dots" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((item, index) => (
              <span key={item.key} className={index < step ? 'is-done' : index === step ? 'is-on' : undefined} />
            ))}
          </div>
          {step === 0 ? (
            <button className="alumno-signup__login" type="button" onClick={props.onLogin}>
              Inicia sesión
            </button>
          ) : (
            <span className="alumno-signup__login" aria-hidden="true" />
          )}
        </header>

        <section key={current.key} className={`alumno-signup__page is-${direction > 0 ? 'forward' : 'back'}`}>
          <span className="alumno-signup__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d={current.icon} />
            </svg>
          </span>
          <h1>{current.title}</h1>
          <p className="alumno-signup__lead">{current.lead}</p>

          <div className="alumno-signup__field">
            {current.key === 'email' ? (
              <input
                ref={inputRef}
                className="alumno-signup__hero"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="Correo"
                aria-label="Correo"
                value={props.email}
                onChange={(event) => props.onEmail(event.target.value)}
              />
            ) : null}
            {current.key === 'password' ? (
              <div className="alumno-signup__secret">
                <input
                  ref={inputRef}
                  className="alumno-signup__hero"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Contraseña"
                  aria-label="Contraseña"
                  value={props.password}
                  onChange={(event) => props.onPassword(event.target.value)}
                />
                <button type="button" onClick={() => setReveal((value) => !value)} aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {reveal ? null : <path d="M4 4l16 16" />}
                  </svg>
                </button>
              </div>
            ) : null}
            {current.key === 'name' ? (
              <input
                ref={inputRef}
                className="alumno-signup__hero"
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Tu nombre"
                aria-label="Nombre"
                value={props.nombre}
                onChange={(event) => props.onNombre(event.target.value)}
              />
            ) : null}
            {current.key === 'legal' ? (
              <div className="alumno-signup__legal">
                <LegalToggle
                  checked={props.acceptedTerms}
                  onChange={props.onTerms}
                  label="Acepto los términos y condiciones"
                  href={props.legal?.terminos_url}
                  linkLabel={props.legal ? `Leer términos ${props.legal.terminos_version}` : null}
                />
                <LegalToggle
                  checked={props.acceptedPrivacy}
                  onChange={props.onPrivacy}
                  label="Acepto el aviso de privacidad"
                  href={props.legal?.privacidad_url}
                  linkLabel={props.legal ? `Leer privacidad ${props.legal.privacidad_version}` : null}
                />
                {props.legal ? null : <p className="alumno-muted">Cargando los documentos legales…</p>}
              </div>
            ) : null}
          </div>
          {props.error ? <p className="alumno-error">{props.error}</p> : null}
        </section>

        <footer className="alumno-signup__dock">
          <button className="alumno-btn alumno-btn--lime" type="submit" disabled={!canAdvance}>
            {isLast ? (props.busy ? 'Creando…' : 'Crear cuenta') : 'Continuar'}
          </button>
        </footer>
      </form>
    </main>
  );
}

function LegalToggle({
  checked,
  onChange,
  label,
  href,
  linkLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  href?: string;
  linkLabel: string | null;
}) {
  return (
    <div className="alumno-signup__toggle">
      <label>
        <span>{label}</span>
        <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </label>
      {href && linkLabel ? (
        <a href={href} target="_blank" rel="noreferrer">
          {linkLabel}
        </a>
      ) : null}
    </div>
  );
}
