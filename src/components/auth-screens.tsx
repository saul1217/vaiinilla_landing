import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
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
import { enableGuestBuy, enableGuestExplore } from '../lib/guest-explore';
import { unpublishedLegalTestingEnabled } from '../lib/legal';
import { entryAfterAccess } from '../lib/space-session';
import { staffAccesses } from '../lib/staff-access';
import { markVerificationSent } from '../lib/verification';
import type { LegalVersions, SessionAccess } from '../types/api';
import { AlumnoBack, AlumnoLockup, AlumnoLogo } from './alumno-brand';
import { SignupSteps } from './signup-steps';
import { StaffNotice } from './staff-notice';

type AuthMode = 'splash' | 'entrar' | 'alta' | 'totp' | 'google-legal' | 'staff';

interface AuthCopy {
  kicker: string;
  headline: ReactNode;
  lead: string;
  panelKicker: string;
  panelTitle: string;
}

const SPLASH_BUBBLES = [
  { src: '/vaini/scene-laptop.png', className: 'is-1' },
  { src: '/vaini/scene-taller.png', className: 'is-2' },
  { src: '/assets/vaini-oxxo.jpg', className: 'is-3' },
  { src: '/vaini/scene-karate.png', className: 'is-4' },
  { src: '/vaini/scene-bloques.png', className: 'is-5' },
  { src: '/assets/vaini-tacos.jpg', className: 'is-6' },
  { src: '/vaini/scene-puente.png', className: 'is-7' },
  { src: '/assets/vaini-camion.jpg', className: 'is-8' },
  { src: '/assets/vaini-moto.jpg', className: 'is-9' },
] as const;

const AUTH_SCENES = [
  { src: '/assets/vaini-oxxo.jpg', className: 'is-oxxo' },
  { src: '/assets/vaini-tacos.jpg', className: 'is-tacos' },
  { src: '/assets/vaini-camion.jpg', className: 'is-camion' },
  { src: '/assets/vaini-moto.jpg', className: 'is-moto' },
] as const;

const AUTH_COPY = {
  entrar: {
    kicker: 'Cliente',
    headline: (
      <>
        Tu lugar.
        <br />
        <span className="alumno-auth__accent">A tu ritmo.</span>
      </>
    ),
    lead: 'Pide, sigue tu pedido y paga desde un solo lugar.',
    panelKicker: 'Acceso seguro',
    panelTitle: 'Inicia sesión',
  },
  alta: {
    kicker: 'Nueva cuenta',
    headline: (
      <>
        Únete a Vaiinilla.
        <br />
        <span className="alumno-auth__accent">Sin filas.</span>
      </>
    ),
    lead: 'Crea tu cuenta para pedir y pagar en cualquier establecimiento de comida.',
    panelKicker: 'Registro',
    panelTitle: 'Crear cuenta',
  },
  'google-legal': {
    kicker: 'Nueva cuenta',
    headline: (
      <>
        Únete a Vaiinilla.
        <br />
        <span className="alumno-auth__accent">Sin filas.</span>
      </>
    ),
    lead: 'Acepta los documentos vigentes para terminar de crear tu cuenta.',
    panelKicker: 'Registro',
    panelTitle: 'Crear cuenta',
  },
  staff: {
    kicker: 'Equipo',
    headline: (
      <>
        Tu lugar de trabajo.
        <br />
        <span className="alumno-auth__accent">En su panel.</span>
      </>
    ),
    lead: 'Las cuentas del equipo atienden desde el panel de Vaiinilla.',
    panelKicker: 'Cuenta del equipo',
    panelTitle: 'Tu cuenta es del equipo',
  },
  totp: {
    kicker: 'Acceso seguro',
    headline: (
      <>
        Un paso más.
        <br />
        <span className="alumno-auth__accent">Y entras.</span>
      </>
    ),
    lead: 'Abre tu aplicación autenticadora y captura los 6 dígitos.',
    panelKicker: 'Segundo factor',
    panelTitle: 'Verificación',
  },
} as const satisfies Record<Exclude<AuthMode, 'splash'>, AuthCopy>;

export function AuthScreens({
  next = '/pedir',
  allowExplore = false,
  onExplored,
  onFlowChange,
  unregisteredUser = null,
}: {
  next?: string;
  allowExplore?: boolean;
  onExplored?: () => void;
  /**
   * Avisa mientras un inicio de sesión está en curso o el aviso del equipo está a la vista.
   * Firebase activa la sesión antes de que termine la revisión de accesos: quien muestra esta
   * pantalla debe mantenerla montada hasta que el flujo termine.
   */
  onFlowChange?: (active: boolean) => void;
  /** Sesión abierta cuyo alta quedó a medias: la pantalla abre directo en aceptar términos. */
  unregisteredUser?: User | null;
}) {
  const { configured, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(unregisteredUser ? 'google-legal' : 'splash');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState(unregisteredUser?.displayName ?? '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legal, setLegal] = useState<LegalVersions | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(unregisteredUser);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staff, setStaff] = useState<SessionAccess[]>([]);
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

  /** Devuelve los accesos de la cuenta; si es nueva, la da de alta (sin accesos todavía). */
  async function enrollIfNeeded(nextUser: User, displayName?: string): Promise<SessionAccess[]> {
    const token = await firebaseIdToken(nextUser);
    try {
      return await api.listAccesses(token);
    } catch (cause) {
      // Sin documentos legales no se puede dar de alta: se sigue como antes.
      if (!legalReady || !legal) return [];
      if (!(cause instanceof VaiinillaApiError) || cause.code !== 'IDENTITY_NOT_REGISTERED') {
        throw cause;
      }
      await api.registerIdentity(token, {
        nombre: (displayName ?? nombre).trim() || nextUser.displayName || 'Cliente',
        terminos_version: legal.terminos_version,
        privacidad_version: legal.privacidad_version,
      });
      return [];
    }
  }

  async function finish(nextUser: User, displayName?: string) {
    const accesses = await enrollIfNeeded(nextUser, displayName);
    setResolver(null);
    setPendingGoogleUser(null);
    setTotpCode('');
    // Una cuenta del equipo no es un cliente más: se le avisa y se le lleva a su panel.
    const team = staffAccesses(accesses);
    if (team.length > 0) {
      setStaff(team);
      setMode('staff');
      return;
    }
    leave();
  }

  /** Termina el flujo y lleva a la vista de cliente. */
  function leave() {
    void navigate(entryAfterAccess(next));
    onFlowChange?.(false);
  }

  /** El correo de verificación se dispara al crear la cuenta (una sola vez por alta). */
  async function sendVerificationEmail(target: User): Promise<void> {
    if (target.emailVerified) return;
    const token = await firebaseIdToken(target);
    await api.sendVerificationEmail(token);
    markVerificationSent();
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
        const created = await createPasswordAccount(email, password, nombre);
        await finish(created);
        // Sin verificar no se puede pedir: el correo se manda aquí; si falla,
        // /cuenta lo reenvía (la cuenta ya quedó creada).
        await sendVerificationEmail(created).catch(() => undefined);
        return;
      }
      onFlowChange?.(true);
      const result = await passwordSignIn(email.trim().toLowerCase(), password);
      if (result.mfaResolver) {
        setResolver(result.mfaResolver);
        setMode('totp');
        return;
      }
      if (result.user) await finish(result.user);
    } catch (cause) {
      onFlowChange?.(false);
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
      onFlowChange?.(true);
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
      onFlowChange?.(false);
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
      onFlowChange?.(true);
      await finish(pendingGoogleUser, pendingGoogleUser.displayName ?? nombre);
      await sendVerificationEmail(pendingGoogleUser).catch(() => undefined);
    } catch (cause) {
      onFlowChange?.(false);
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
      onFlowChange?.(true);
      await finish(await completeTotpSignIn(resolver, totpCode));
    } catch (cause) {
      onFlowChange?.(false);
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

  function buyAsGuest() {
    enableGuestBuy();
    onExplored?.();
    void navigate(entryAfterAccess(next));
  }

  function goBack() {
    setError(null);
    setNotice(null);
    if (mode === 'totp') {
      setMode('entrar');
      setResolver(null);
      setTotpCode('');
      return;
    }
    // Sin aceptar términos no hay alta: la sesión de Firebase no puede quedar abierta a medias.
    if (mode === 'google-legal') void signOut().finally(() => onFlowChange?.(false));
    setPendingGoogleUser(null);
    setMode('splash');
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
        <header className="alumno-splash__bar">
          <AlumnoLockup linked={false} />
          {allowExplore ? (
            <button className="alumno-splash__explore" type="button" onClick={explore}>
              Explorar
            </button>
          ) : null}
        </header>
        <div className="alumno-splash__stage">
          <div className="alumno-splash__orbit" aria-hidden="true">
            {SPLASH_BUBBLES.map((bubble) => (
              <span key={bubble.className} className={`alumno-splash__bubble ${bubble.className} is-scene`}>
                <img src={bubble.src} alt="" />
              </span>
            ))}
          </div>
          <div className="alumno-splash__vaini">
            <img src="/vaini/cutout-frente.png" alt="Vaini, la mascota de Vaiinilla" />
          </div>
        </div>
        <div className="alumno-splash__copy">
          <h1>
            Tu lugar, <em>a tu ritmo.</em>
          </h1>
          <p>Pide, sigue tu pedido y paga desde un solo lugar.</p>
        </div>
        {error ? <p className="alumno-error">{error}</p> : null}
        <div className="alumno-splash__actions">
          <button
            className="alumno-btn alumno-btn--lime alumno-splash__google"
            type="button"
            disabled={busy || !configured}
            onClick={() => void onGoogle()}
          >
            <span className="alumno-splash__google-mark">
              <GoogleMark />
            </span>
            Continuar con Google
          </button>
          <button className="alumno-btn alumno-btn--ghost" type="button" onClick={buyAsGuest}>
            Comprar sin cuenta
          </button>
          <p className="alumno-splash__login">
            ¿Ya tienes cuenta?{' '}
            <button className="alumno-link" type="button" onClick={() => setMode('entrar')}>
              Iniciar sesión
            </button>
          </p>
          <button className="alumno-splash__email" type="button" onClick={() => setMode('alta')}>
            Crear cuenta con correo
          </button>
        </div>
      </main>
    );
  }

  if (mode === 'alta') {
    return (
      <SignupSteps
        email={email}
        password={password}
        nombre={nombre}
        acceptedTerms={acceptedTerms}
        acceptedPrivacy={acceptedPrivacy}
        legal={legal}
        busy={busy}
        configured={configured}
        error={error}
        onEmail={setEmail}
        onPassword={setPassword}
        onNombre={setNombre}
        onTerms={setAcceptedTerms}
        onPrivacy={setAcceptedPrivacy}
        onSubmit={(event) => void onPassword(event)}
        onExit={goBack}
        onLogin={() => {
          setError(null);
          setMode('entrar');
        }}
      />
    );
  }

  const copy: AuthCopy = AUTH_COPY[mode];

  return (
    <AuthSplit mode={mode} onBack={mode === 'staff' ? undefined : goBack} copy={copy}>
      {mode === 'staff' ? (
        <StaffNotice accesses={staff} onContinueAsClient={leave} />
      ) : mode === 'totp' ? (
        <>
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
          </form>
        </>
      ) : (
        <form
          onSubmit={(event) =>
            void (mode === 'google-legal' ? confirmGoogleLegal(event) : onPassword(event))
          }
        >
          {error ? <p className="alumno-error">{error}</p> : null}
          {notice ? <p className="alumno-ok">{notice}</p> : null}
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
              {mode === 'entrar' ? (
                <label className="alumno-field">
                  Contraseña
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="current-password"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <p className="alumno-lead">Acepta los documentos vigentes para terminar de crear tu cuenta.</p>
          )}
          {mode === 'entrar' ? (
            <p className="alumno-auth__forgot">
              <button className="alumno-link" type="button" onClick={() => void onForgot()}>
                ¿La olvidaste?
              </button>
            </p>
          ) : null}
          {mode === 'google-legal' ? (
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
            <button
              className="alumno-btn alumno-btn--google"
              type="button"
              disabled={busy || !configured}
              onClick={() => void onGoogle()}
            >
              <GoogleMark />
              Continuar con Google
            </button>
          ) : null}
          {mode === 'google-legal' ? null : (
            <p className="alumno-auth__switch">
              <button
                className="alumno-link"
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode(mode === 'entrar' ? 'alta' : 'entrar');
                }}
              >
                {mode === 'entrar' ? 'Crear cuenta' : 'Ya tengo cuenta'}
              </button>
            </p>
          )}
          <p className="alumno-muted alumno-auth__legal">Al continuar aceptas {legalLinks}.</p>
        </form>
      )}
    </AuthSplit>
  );
}

function AuthSplit({
  mode,
  onBack,
  copy,
  children,
}: {
  mode: Exclude<AuthMode, 'splash'>;
  onBack?: () => void;
  copy: AuthCopy;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className={`alumno-auth alumno-auth--${mode}`}>
      <div className="alumno-auth__mosaic" aria-hidden="true">
        {AUTH_SCENES.map((scene) => (
          <img key={scene.className} className={`alumno-auth__scene ${scene.className}`} src={scene.src} alt="" />
        ))}
      </div>
      <section className="alumno-auth__brand">
        <AlumnoLogo onDark className="alumno-auth__logo" />
        <p className="alumno-kicker">{copy.kicker}</p>
        <h2 className="alumno-auth__headline">{copy.headline}</h2>
        <p className="alumno-auth__brand-lead">{copy.lead}</p>
      </section>
      <section className="alumno-auth__panel">
        {onBack ? <AlumnoBack onClick={onBack}>Volver</AlumnoBack> : null}
        <AlumnoLogo className="alumno-auth__window-logo" alt="" />
        <div className="alumno-auth__mark" aria-hidden="true">
          <img src="/brand/vaiinilla-mark.png" alt="" />
        </div>
        <p className="alumno-kicker">{copy.panelKicker}</p>
        <h1>{copy.panelTitle}</h1>
        {children}
      </section>
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
