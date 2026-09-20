import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { AuthScreens } from '../components/auth-screens';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { firebaseIdToken } from '../lib/firebase';
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

  if (!ready) {
    return (
      <AppShell tab="none">
        <main id="main-content" className="alumno-main" role="status">
          Validando sesión…
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tab="none">
        <AuthScreens next={next} allowExplore={next === '/pedir'} />
      </AppShell>
    );
  }

  return <SettingsScreen onSignOut={() => void signOut()} />;
}

function SettingsScreen({ onSignOut }: { onSignOut: () => void }) {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      try {
        let session = context;
        const slug = cart?.slug ?? lastPlaceSlug();
        if (!session && slug) {
          const place = await api.getEstablishment(slug);
          session = await openClientSession(user, place);
        }
        if (!session) return;
        const next = await api.getMyWallet(session.access_token);
        if (!active) return;
        setWallet(next);
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

  async function deleteAccount() {
    if (!user) return;
    const confirmed = window.confirm('¿Eliminar tu cuenta? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const token = await firebaseIdToken(user);
      await api.deleteIdentity(token);
      await signOut();
      void navigate('/pedir');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Cuenta" title="Configuración" lead={user?.email ?? undefined} />
        {error ? <p className="alumno-error">{error}</p> : null}
        <div className="alumno-settings-layout">
          <section className="alumno-card alumno-card--qr">
            <h2>QR para recargar</h2>
            <p className="alumno-muted">Muéstralo en Caja. La recarga la hace el establecimiento.</p>
            {qr ? <img className="wallet-qr" src={qr} alt="Código QR para recargar saldo en caja" /> : null}
            {wallet ? (
              <p className="alumno-muted">{walletQrUrl(wallet.wallet.usuario_id || wallet.cliente.usuario_id)}</p>
            ) : null}
          </section>
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
            <button
              className="alumno-setting alumno-setting--danger"
              type="button"
              disabled={busy}
              onClick={() => void deleteAccount()}
            >
              Eliminar cuenta
            </button>
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
