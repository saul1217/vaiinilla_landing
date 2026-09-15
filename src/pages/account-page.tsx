import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MultiFactorResolver, User } from 'firebase/auth';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { firebaseAuthMessage, VaiinillaApiError } from '../lib/api-error';
import {
  completeTotpSignIn,
  createPasswordAccount,
  firebaseIdToken,
  passwordSignIn,
} from '../lib/firebase';
import { unpublishedLegalTestingEnabled } from '../lib/legal';
import type { LegalVersions } from '../types/api';

export function AccountPage() {
  const { user, ready, configured, signOut } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/cuenta/pedidos';
  const [mode, setMode] = useState<'entrar' | 'alta'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [legal, setLegal] = useState<LegalVersions | null>(null);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  const subtitle = useMemo(() => {
    if (!configured) return 'Falta configurar Firebase en este entorno. El menú público sí funciona.';
    if (resolver) return 'Abre Google Authenticator y captura el código de 6 dígitos.';
    return 'Usa la misma cuenta de alumno que en la app.';
  }, [configured, resolver]);

  async function enrollIfNeeded(nextUser: User) {
    if (!legalReady || !legal) return;
    const token = await firebaseIdToken(nextUser);
    try {
      await api.listAccesses(token);
    } catch (cause) {
      if (!(cause instanceof VaiinillaApiError) || cause.code !== 'IDENTITY_NOT_REGISTERED') throw cause;
      await api.registerIdentity(token, {
        nombre: nombre.trim() || nextUser.displayName || 'Alumno',
        terminos_version: legal.terminos_version,
        privacidad_version: legal.privacidad_version,
      });
    }
  }

  async function finish(nextUser: User) {
    await enrollIfNeeded(nextUser);
    setResolver(null);
    setTotpCode('');
    void navigate(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured) return;
    setBusy(true);
    try {
      if (mode === 'alta') {
        if (!accepted || !legalReady || !legal) {
          throw new Error('Acepta los términos y la privacidad vigentes para crear tu cuenta.');
        }
        await finish(await createPasswordAccount(email, password, nombre));
        return;
      }
      const result = await passwordSignIn(email.trim().toLowerCase(), password);
      if (result.mfaResolver) {
        setResolver(result.mfaResolver);
        return;
      }
      if (result.user) await finish(result.user);
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

  if (!ready) {
    return (
      <PageShell>
        <main id="main-content" className="app-page">
          <div className="container" role="status">
            Validando sesión…
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container" style={{ maxWidth: 640 }}>
          <p className="eyebrow">Cuenta de alumno</p>
          <h1>
            {user ? 'Tu cuenta' : resolver ? 'Verificación' : mode === 'alta' ? 'Crear cuenta' : 'Entrar'}
          </h1>
          <p className="app-lead">{subtitle}</p>
          {user ? (
            <>
              <nav className="account-nav" aria-label="Cuenta">
                <Link className="btn btn--primary" to="/cuenta/pedidos">
                  Pedidos
                </Link>
                <Link className="btn btn--ghost" to="/cuenta/saldo">
                  Saldo
                </Link>
                <button className="btn btn--dark" type="button" onClick={() => void signOut()}>
                  Salir
                </button>
              </nav>
              <p>
                Sesión de {user.email}. El panel de cafetería vive en{' '}
                <a href="https://app.vaiinilla.app">app.vaiinilla.app</a>.
              </p>
            </>
          ) : resolver ? (
            <form className="panel-card" onSubmit={(event) => void verifyTotp(event)}>
              {error ? <p className="feedback">{error}</p> : null}
              <label className="field">
                Código de 6 dígitos
                <input
                  className="totp-input"
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
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? 'Confirmando…' : 'Confirmar y entrar'}
              </button>
              <p style={{ marginTop: 16 }}>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setResolver(null);
                    setTotpCode('');
                    setError(null);
                  }}
                >
                  Volver al acceso
                </button>
              </p>
            </form>
          ) : (
            <form className="panel-card" onSubmit={(event) => void onSubmit(event)}>
              {error ? <p className="feedback">{error}</p> : null}
              {mode === 'alta' ? (
                <label className="field">
                  Nombre
                  <input value={nombre} onChange={(event) => setNombre(event.target.value)} required autoComplete="name" />
                </label>
              ) : null}
              <label className="field">
                Correo
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="field">
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
              {mode === 'alta' ? (
                <label className="field">
                  <span>
                    <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Acepto{' '}
                    {legal ? (
                      <>
                        <a href={legal.terminos_url} target="_blank" rel="noreferrer">
                          Términos {legal.terminos_version}
                        </a>{' '}
                        y{' '}
                        <a href={legal.privacidad_url} target="_blank" rel="noreferrer">
                          Privacidad {legal.privacidad_version}
                        </a>
                      </>
                    ) : (
                      'los documentos legales vigentes'
                    )}
                    .
                  </span>
                </label>
              ) : null}
              <button className="btn btn--primary" type="submit" disabled={busy || !configured}>
                {busy ? 'Continuando…' : mode === 'alta' ? 'Crear cuenta' : 'Entrar'}
              </button>
              <p style={{ marginTop: 16 }}>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setMode(mode === 'alta' ? 'entrar' : 'alta')}
                >
                  {mode === 'alta' ? 'Ya tengo cuenta' : 'Crear cuenta de alumno'}
                </button>
              </p>
            </form>
          )}
        </div>
      </main>
    </PageShell>
  );
}
