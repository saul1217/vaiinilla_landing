import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MultiFactorResolver, User } from 'firebase/auth';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { firebaseAuthMessage, VaiinillaApiError } from '../lib/api-error';
import {
  completeTotpSignIn,
  createPasswordAccount,
  firebaseIdToken,
  googleSignIn,
  passwordSignIn,
  sendPasswordReset,
} from '../lib/firebase';
import { enableGuestExplore } from '../lib/guest-explore';
import { unpublishedLegalTestingEnabled } from '../lib/legal';
import type { LegalVersions } from '../types/api';

type AuthMode = 'splash' | 'entrar' | 'alta' | 'totp' | 'google-legal';

export function AuthScreens({
  next = '/pedir',
  allowExplore = false,
  onExplored,
}: {
  next?: string;
  allowExplore?: boolean;
  onExplored?: () => void;
}) {
  const { configured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legal, setLegal] = useState<LegalVersions | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .getLegalVersions()
      .then(setLegal)
      .catch((cause: unknown) => {
        if (!unpublishedLegalTestingEnabled) setError(firebaseAuthMessage(cause));
      });
  }, []);

  const legalReady = Boolean(legal?.terminos_version && legal.privacidad_version);
  const legalesOk = acceptedTerms && acceptedPrivacy && legalReady && Boolean(legal);

  async function enrollIfNeeded(nextUser: User, displayName?: string) {
    if (!legalReady || !legal) return;
    const token = await firebaseIdToken(nextUser);
    try {
      await api.listAccesses(token);
    } catch (cause) {
      if (!(cause instanceof VaiinillaApiError) || cause.code !== 'IDENTITY_NOT_REGISTERED') {
        throw cause;
      }
      await api.registerIdentity(token, {
        nombre: (displayName ?? nombre).trim() || nextUser.displayName || 'Alumno',
        terminos_version: legal.terminos_version,
        privacidad_version: legal.privacidad_version,
      });
    }
  }

  async function finish(nextUser: User, displayName?: string) {
    await enrollIfNeeded(nextUser, displayName);
    setResolver(null);
    setPendingGoogleUser(null);
    setTotpCode('');
    void navigate(next);
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured) return;
    setBusy(true);
    try {
      if (mode === 'alta') {
        if (!legalesOk || !legal) {
          throw new Error('Acepta los términos y la privacidad vigentes para crear tu cuenta.');
        }
        await finish(await createPasswordAccount(email, password, nombre));
        return;
      }
      const result = await passwordSignIn(email.trim().toLowerCase(), password);
      if (result.mfaResolver) {
        setResolver(result.mfaResolver);
        setMode('totp');
        return;
      }
      if (result.user) await finish(result.user);
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    if (!configured) return;
    setBusy(true);
    try {
      const result = await googleSignIn();
      if (result.mfaResolver) {
        setResolver(result.mfaResolver);
        setMode('totp');
        return;
      }
      if (!result.user) return;
      const token = await firebaseIdToken(result.user);
      try {
        await api.listAccesses(token);
        await finish(result.user);
      } catch (cause) {
        if (cause instanceof VaiinillaApiError && cause.code === 'IDENTITY_NOT_REGISTERED') {
          setPendingGoogleUser(result.user);
          setNombre(result.user.displayName ?? '');
          setMode('google-legal');
          return;
        }
        throw cause;
      }
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirmGoogleLegal(event: FormEvent) {
    event.preventDefault();
    if (!pendingGoogleUser) return;
    if (!legalesOk) {
      setError('Acepta los términos y la privacidad vigentes para crear tu cuenta.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await finish(pendingGoogleUser, pendingGoogleUser.displayName ?? nombre);
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp(event: FormEvent) {
    event.preventDefault();
    if (!resolver || !/^\d{6}$/.test(totpCode)) {
      setError('Captura los 6 dígitos de tu aplicación autenticadora.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await finish(await completeTotpSignIn(resolver, totpCode));
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Escribe tu correo para enviarte el enlace.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setNotice('Te enviamos un correo para restablecer la contraseña.');
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function explore() {
    enableGuestExplore();
    onExplored?.();
    if (window.location.pathname !== '/pedir') void navigate('/pedir');
  }

  const legalLinks = legal ? (
    <>
      <a href={legal.terminos_url} target="_blank" rel="noreferrer">
        Términos {legal.terminos_version}
      </a>
      {' y '}
      <a href={legal.privacidad_url} target="_blank" rel="noreferrer">
        Privacidad {legal.privacidad_version}
      </a>
    </>
  ) : (
    'los documentos legales vigentes'
  );

  if (mode === 'splash') {
    return (
      <main id="main-content" className="alumno-splash">
        <div className="alumno-splash__hero">
          <img src="/vaini/cutout-frente.png" alt="Vaini, la mascota de Vaiinilla" />
          <p className="alumno-kicker">Vaiinilla</p>
          <h1>Tu cafetería, sin filas</h1>
        </div>
        {error ? <p className="alumno-error">{error}</p> : null}
        <div className="alumno-splash__actions">
          <button className="alumno-btn alumno-btn--lime" type="button" onClick={() => setMode('alta')}>
            Crear cuenta
          </button>
          <button
            className="alumno-btn alumno-btn--google"
            type="button"
            disabled={busy || !configured}
            onClick={() => void onGoogle()}
          >
            <GoogleMark />
            Continuar con Google
          </button>
          <button className="alumno-btn alumno-btn--ink" type="button" onClick={() => setMode('entrar')}>
            Iniciar sesión
          </button>
          {allowExplore ? (
            <button className="alumno-link" type="button" onClick={explore}>
              Explorar el menú
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  if (mode === 'totp') {
    return (
      <main id="main-content" className="alumno-main">
        <div className="alumno-banner">
          <p className="alumno-kicker">Segundo factor</p>
          <h1>Verificación</h1>
        </div>
        <p className="alumno-lead">Abre Google Authenticator y captura el código de 6 dígitos.</p>
        <form onSubmit={(event) => void verifyTotp(event)}>
          {error ? <p className="alumno-error">{error}</p> : null}
          <label className="alumno-field">
            Código de 6 dígitos
            <input
              className="alumno-totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              minLength={6}
              maxLength={6}
            />
          </label>
          <button className="alumno-btn alumno-btn--lime" type="submit" disabled={busy}>
            {busy ? 'Confirmando…' : 'Confirmar y entrar'}
          </button>
          <p style={{ marginTop: 16 }}>
            <button
              className="alumno-link"
              type="button"
              onClick={() => {
                setMode('entrar');
                setResolver(null);
                setTotpCode('');
                setError(null);
              }}
            >
              Volver al acceso
            </button>
          </p>
        </form>
      </main>
    );
  }

  const heading = mode === 'alta' || mode === 'google-legal' ? 'Crear cuenta' : 'Inicia sesión';

  return (
    <main id="main-content" className="alumno-main">
      <div className="alumno-banner">
        <p className="alumno-kicker">Alumno</p>
        <h1>{heading}</h1>
      </div>
      <form
        onSubmit={(event) =>
          void (mode === 'google-legal' ? confirmGoogleLegal(event) : onPassword(event))
        }
      >
        {error ? <p className="alumno-error">{error}</p> : null}
        {notice ? <p className="alumno-ok">{notice}</p> : null}
        {mode === 'alta' ? (
          <label className="alumno-field">
            Nombre
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} required autoComplete="name" />
          </label>
        ) : null}
        {mode !== 'google-legal' ? (
          <>
            <label className="alumno-field">
              Correo
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            {mode === 'entrar' || mode === 'alta' ? (
              <label className="alumno-field">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'alta' ? 'new-password' : 'current-password'}
                />
              </label>
            ) : null}
          </>
        ) : (
          <p className="alumno-lead">Acepta los documentos vigentes para terminar el alta con Google.</p>
        )}
        {mode === 'entrar' ? (
          <p style={{ margin: '-6px 0 16px' }}>
            <button className="alumno-link" type="button" onClick={() => void onForgot()}>
              ¿La olvidaste?
            </button>
          </p>
        ) : null}
        {mode === 'alta' || mode === 'google-legal' ? (
          <>
            <label className="alumno-check">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Acepto los{' '}
                {legal ? (
                  <a href={legal.terminos_url} target="_blank" rel="noreferrer">
                    Términos {legal.terminos_version}
                  </a>
                ) : (
                  'Términos'
                )}
                .
              </span>
            </label>
            <label className="alumno-check">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              />
              <span>
                Acepto la{' '}
                {legal ? (
                  <a href={legal.privacidad_url} target="_blank" rel="noreferrer">
                    Privacidad {legal.privacidad_version}
                  </a>
                ) : (
                  'Privacidad'
                )}
                .
              </span>
            </label>
          </>
        ) : null}
        <button className="alumno-btn alumno-btn--lime" type="submit" disabled={busy || !configured}>
          {busy ? 'Continuando…' : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
        {mode === 'entrar' ? (
          <p style={{ marginTop: 14 }}>
            <button
              className="alumno-btn alumno-btn--google"
              type="button"
              disabled={busy || !configured}
              onClick={() => void onGoogle()}
            >
              <GoogleMark />
              Continuar con Google
            </button>
          </p>
        ) : null}
        <p style={{ marginTop: 16 }}>
          <button
            className="alumno-link"
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setMode(mode === 'entrar' ? 'alta' : 'entrar');
            }}
          >
            {mode === 'entrar' ? 'Crear cuenta de alumno' : 'Ya tengo cuenta'}
          </button>
        </p>
        <p className="alumno-muted" style={{ marginTop: 18 }}>
          Al continuar aceptas {legalLinks}.
        </p>
      </form>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
