import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { firebaseAuthMessage } from '../lib/api-error';
import { passwordProblem } from '../lib/auth-validation';
import {
  applyEmailVerificationCode,
  applyPasswordReset,
  firebaseConfigured,
  inspectPasswordResetCode,
} from '../lib/firebase';

// Páginas de los enlaces de los correos de acceso (QA-057, QA-043). El backend arma
// el enlace con el dominio de esta web y solo `mode` + `oobCode`; aquí se aplica con
// Firebase, sin pasar por la página de Firebase.

interface EmailAction {
  code: string | null;
  mode: string | null;
}

/** Lee el enlace y lo quita de la barra: el código es de un solo uso y no debe quedar en el historial. */
function captureAction(): EmailAction {
  const url = new URL(window.location.href);
  const action = {
    code: url.searchParams.get('oobCode')?.trim() || null,
    mode: url.searchParams.get('mode')?.trim() || null,
  };
  if (url.search) window.history.replaceState(window.history.state, '', url.pathname);
  return action;
}

type VerifyState = 'checking' | 'success' | 'error';

export function EmailVerificationPage() {
  const [action] = useState(captureAction);
  const [state, setState] = useState<VerifyState>('checking');
  const [message, setMessage] = useState('Estamos comprobando tu enlace.');

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!firebaseConfigured || action.mode !== 'verifyEmail' || !action.code) {
        setState('error');
        setMessage('El enlace está incompleto. Pide un correo de verificación nuevo desde tu cuenta.');
        return;
      }
      try {
        await applyEmailVerificationCode(action.code);
        if (!active) return;
        setState('success');
        setMessage('Tu correo quedó verificado. Ya puedes usar saldo y tarjeta.');
      } catch (cause) {
        if (!active) return;
        setState('error');
        setMessage(firebaseAuthMessage(cause));
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [action]);

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Verificación de correo"
          title={
            state === 'checking' ? 'Un momento…' : state === 'success' ? 'Correo verificado' : 'No pudimos verificarlo'
          }
        />
        <p className={state === 'error' ? 'alumno-error' : 'alumno-lead'} role={state === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
        {state !== 'checking' ? (
          <Link className="alumno-btn alumno-btn--lime" to="/cuenta">
            {state === 'success' ? 'Ir a mi cuenta' : 'Volver a mi cuenta'}
          </Link>
        ) : null}
      </main>
    </AppShell>
  );
}

type ResetState = 'checking' | 'ready' | 'success' | 'error';

export function PasswordResetPage() {
  const [action] = useState(captureAction);
  const [state, setState] = useState<ResetState>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('Estamos comprobando tu enlace.');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!firebaseConfigured || action.mode !== 'resetPassword' || !action.code) {
        setState('error');
        setMessage('El enlace está incompleto. Pide uno nuevo desde «Olvidé mi contraseña».');
        return;
      }
      try {
        const owner = await inspectPasswordResetCode(action.code);
        if (!active) return;
        setEmail(owner);
        setState('ready');
      } catch (cause) {
        if (!active) return;
        setState('error');
        setMessage(firebaseAuthMessage(cause));
      }
    }
    void inspect();
    return () => {
      active = false;
    };
  }, [action]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      setFieldError(problem);
      return;
    }
    if (password !== confirmation) {
      setFieldError('Las contraseñas no coinciden');
      return;
    }
    if (!action.code) return;
    setFieldError(null);
    setBusy(true);
    try {
      await applyPasswordReset(action.code, password);
      setState('success');
      setMessage('Listo, tu contraseña cambió. Entra con la nueva.');
    } catch (cause) {
      setFieldError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Recuperar contraseña"
          title={
            state === 'ready'
              ? 'Crea una contraseña nueva'
              : state === 'success'
                ? 'Contraseña actualizada'
                : state === 'error'
                  ? 'No pudimos usar el enlace'
                  : 'Un momento…'
          }
          lead={state === 'ready' && email ? email : undefined}
        />
        {state === 'ready' ? (
          <form noValidate onSubmit={(event) => void onSubmit(event)}>
            {fieldError ? (
              <p className="alumno-error" role="alert">
                {fieldError}
              </p>
            ) : null}
            <label className="alumno-field">
              Contraseña nueva
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="alumno-field">
              Confírmala
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <button className="alumno-btn alumno-btn--lime" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        ) : (
          <>
            <p className={state === 'error' ? 'alumno-error' : 'alumno-lead'} role={state === 'error' ? 'alert' : 'status'}>
              {message}
            </p>
            {state !== 'checking' ? (
              <Link className="alumno-btn alumno-btn--lime" to="/cuenta">
                {state === 'success' ? 'Entrar a mi cuenta' : 'Volver al acceso'}
              </Link>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
