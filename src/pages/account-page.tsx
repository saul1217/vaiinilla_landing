import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { AuthScreens } from '../components/auth-screens';
import { DeleteAccountPanel } from '../components/delete-account-panel';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { firebaseIdToken } from '../lib/firebase';
import { resolveClientSession } from '../lib/client-session';
import {
  clearVerificationSent,
  markVerificationSent,
  verificationWasSent,
} from '../lib/verification';
import { lastPlaceSlug } from '../lib/last-place';
import { THEME_OPTIONS } from '../lib/theme';
import { walletQrUrl } from '../lib/env';
import { useCart } from '../context/cart-context';
import { useBuyerSession } from '../context/buyer-session';
import type { WalletData } from '../types/api';

export function AccountPage() {
  const { user, ready, signOut } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') || '/pedir';
  // Firebase activa la sesión a mitad del login; la pantalla de acceso sigue montada hasta que
  // termine (por ejemplo, mientras la cuenta del equipo ve su aviso).
  const [signingIn, setSigningIn] = useState(false);
  const registrationPending = useRegistrationPending(user, signingIn);

  if (!ready) {
    return (
      <AppShell tab="none">
        <main id="main-content" className="alumno-main" role="status">
          Validando sesión…
        </main>
      </AppShell>
    );
  }

  if (!user || signingIn || registrationPending) {
    return (
      <AppShell tab="none">
        <AuthScreens
          next={next}
          allowExplore={next === '/pedir'}
          onFlowChange={setSigningIn}
          unregisteredUser={registrationPending ? user : null}
        />
      </AppShell>
    );
  }

  return <SettingsScreen onSignOut={() => void signOut()} />;
}

/**
 * Una sesión de Firebase puede quedar abierta sin alta en Vaiinilla (se cerró la pestaña o falló el
 * registro tras elegir la cuenta de Google). Se detecta aquí para retomar el paso de términos.
 */
function useRegistrationPending(user: User | null, paused: boolean): boolean {
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user || paused) return;
    let active = true;
    void firebaseIdToken(user)
      .then((token) => api.listAccesses(token))
      .then(() => {
        if (active) setPendingUid(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        // Cualquier otro error lo muestra la pantalla de cuenta; solo el alta pendiente cambia de pantalla.
        const pending = cause instanceof VaiinillaApiError && cause.code === 'IDENTITY_NOT_REGISTERED';
        setPendingUid(pending ? user.uid : null);
      });
    return () => {
      active = false;
    };
  }, [user, paused]);

  return Boolean(user && pendingUid === user.uid);
}

function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [allowsBalance, setAllowsBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Verificación de correo: se avisa hasta que Firebase lo confirma.
  const [verified, setVerified] = useState(() => user?.emailVerified ?? true);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    setVerified(user?.emailVerified ?? true);
  }, [user]);

  // Firebase cachea el verificado: al volver a la app (o al entrar) se pregunta
  // de nuevo sin tocar nada, para que el aviso no persiga a quien ya verificó.
  const refreshVerification = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      await user.reload();
    } catch {
      return false;
    }
    if (!user.emailVerified) return false;
    clearVerificationSent();
    setVerified(true);
    // El claim del token queda viejo hasta una hora: se fuerza para que el
    // backend vea el correo verificado en la siguiente llamada.
    await user.getIdToken(true).catch(() => undefined);
    return true;
  }, [user]);

  useEffect(() => {
    if (!user || verified) return;
    void refreshVerification();
    const onFocus = () => {
      void refreshVerification();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshVerification, user, verified]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!resolved) return;
        const [next, place] = await Promise.all([
          api.getMyWallet(resolved.context.access_token),
          resolved.slug ? api.getEstablishment(resolved.slug).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        setError(null);
        setWallet(next);
        setAllowsBalance(place?.permite_saldo !== false);
        const userId = next.wallet.usuario_id || next.cliente.usuario_id;
        setQr(await QRCode.toDataURL(walletQrUrl(userId), { margin: 1, width: 320 }));
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [cart?.slug, context, openClientSession, user]);

  async function resendVerification() {
    if (!user) return;
    setVerifyBusy(true);
    setVerifyError(null);
    setVerifyNotice(null);
    try {
      await api.sendVerificationEmail(await firebaseIdToken(user));
      markVerificationSent();
      setVerifyNotice('Listo, revisa tu bandeja (y el spam). El enlace solo se puede usar una vez.');
    } catch (cause) {
      setVerifyError(errorMessage(cause));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function checkVerified() {
    if (!user) return;
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const ok = await refreshVerification();
      if (!ok) {
        setVerifyNotice('Aún no lo vemos verificado. Abre el enlace del correo e inténtalo de nuevo.');
      }
    } catch (cause) {
      setVerifyError(errorMessage(cause));
    } finally {
      setVerifyBusy(false);
    }
  }

  async function afterDeletion() {
    await signOut();
    void navigate('/pedir');
  }

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Cuenta" title="Configuración" lead={user?.email ?? undefined} />
        {error ? <p className="alumno-error">{error}</p> : null}
        {user && !verified ? (
          <section className="alumno-banner" aria-label="Verifica tu correo">
            <p>
              <strong>
                {verificationWasSent() || verifyNotice
                  ? 'Te enviamos un enlace para verificar tu correo.'
                  : 'Tu correo aún no está verificado.'}
              </strong>{' '}
              Sin verificar no puedes usar saldo ni tarjeta. En caja sí puedes pedir:{' '}
              <Link className="alumno-link" to="/pedir">
                pide como invitado
              </Link>{' '}
              y tus pedidos pasarán a tu cuenta al verificarla. Revisa tu bandeja (y el spam).
            </p>
            {verifyNotice ? <p className="alumno-muted">{verifyNotice}</p> : null}
            {verifyError ? <p className="alumno-error">{verifyError}</p> : null}
            <div className="alumno-tracking__actions">
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={verifyBusy}
                onClick={() => void resendVerification()}
              >
                {verifyBusy ? 'Enviando…' : 'Reenviar correo'}
              </button>
              <button
                className="alumno-btn"
                type="button"
                disabled={verifyBusy}
                onClick={() => void checkVerified()}
              >
                Ya lo verifiqué
              </button>
            </div>
          </section>
        ) : null}
        <div className="alumno-settings-layout">
          {allowsBalance ? (
            <section className="alumno-card alumno-card--qr">
              <h2>QR para recargar</h2>
              <p className="alumno-muted">Muéstralo en Caja. La recarga la hace el establecimiento.</p>
              {qr ? <img className="wallet-qr" src={qr} alt="Código QR para recargar saldo en caja" /> : null}
              {wallet ? (
                <p className="alumno-muted">{walletQrUrl(wallet.wallet.usuario_id || wallet.cliente.usuario_id)}</p>
              ) : null}
            </section>
          ) : null}
          <div>
            <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Tema</h2>
            <div className="alumno-themes">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={preference === option.value ? 'alumno-chip is-on' : 'alumno-chip'}
                  onClick={() => setPreference(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="alumno-setting" type="button" onClick={() => void navigate('/pedir')}>
              Cambiar tienda
            </button>
            <button className="alumno-setting" type="button" onClick={onSignOut}>
              Salir
            </button>
            {user ? <DeleteAccountPanel user={user} onDeleted={afterDeletion} /> : null}
            <p style={{ marginTop: 18 }}>
              <Link className="alumno-link" to="/soporte">
                Soporte
              </Link>
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
