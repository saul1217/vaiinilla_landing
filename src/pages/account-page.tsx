import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { createPasswordAccount, firebaseIdToken, passwordSignIn } from '../lib/firebase';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .getLegalVersions()
      .then(setLegal)
      .catch((cause: unknown) => {
        if (!unpublishedLegalTestingEnabled) setError(errorMessage(cause));
      });
  }, []);

  const legalReady = Boolean(legal?.terminos_version && legal.privacidad_version);

  const subtitle = useMemo(() => {
    if (!configured) return 'Falta configurar Firebase en este entorno. El menú público sí funciona.';
    return 'Usa la misma cuenta de alumno que en la app.';
  }, [configured]);

  async function enrollIfNeeded(nextUser: NonNullable<typeof user>) {
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured) return;
    setBusy(true);
    try {
      const nextUser =
        mode === 'alta'
          ? await (async () => {
              if (!accepted || !legalReady || !legal) {
                throw new Error('Acepta los términos y la privacidad vigentes para crear tu cuenta.');
              }
              return createPasswordAccount(email, password, nombre);
            })()
          : await passwordSignIn(email, password);
      await enrollIfNeeded(nextUser);
      void navigate(next);
    } catch (cause) {
      setError(errorMessage(cause));
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
          <h1>{user ? 'Tu cuenta' : mode === 'alta' ? 'Crear cuenta' : 'Entrar'}</h1>
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
