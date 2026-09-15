import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { walletQrUrl } from '../lib/env';
import { formatMoney } from '../lib/money';
import type { WalletData } from '../types/api';

export function WalletPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (!session) {
          setError('Entra a una cafetería para ver el saldo de ese lugar.');
          return;
        }
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

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/saldo" replace />;

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container" style={{ maxWidth: 720 }}>
          <p className="eyebrow">Wallet</p>
          <h1>Tu saldo</h1>
          {error ? <p className="feedback">{error}</p> : null}
          {wallet ? (
            <section className="panel-card">
              <p>
                {wallet.cliente.nombre}
                {wallet.cliente.identificador_cliente ? ` · ${wallet.cliente.identificador_cliente}` : ''}
              </p>
              <h2>{formatMoney(wallet.wallet.saldo)}</h2>
              <p>Muestra este código en Caja para recargar. La recarga la hace el establecimiento.</p>
              {qr ? <img className="wallet-qr" src={qr} alt="Código QR para recargar saldo en caja" /> : null}
              <p className="muted">
                {walletQrUrl(wallet.wallet.usuario_id || wallet.cliente.usuario_id)}
              </p>
              <h3>Movimientos</h3>
              {wallet.movimientos.length === 0 ? (
                <p className="muted">Todavía no hay movimientos.</p>
              ) : (
                <ul>
                  {wallet.movimientos.map((item) => (
                    <li key={item.id}>
                      {item.descripcion}: {formatMoney(item.monto)} → {formatMoney(item.saldo_posterior)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
          <p style={{ marginTop: 24 }}>
            <Link className="btn btn--ghost" to="/cuenta">
              Volver a cuenta
            </Link>
          </p>
        </div>
      </main>
    </PageShell>
  );
}

export function WalletQrPage() {
  const { id = '' } = useParams();
  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container" style={{ maxWidth: 640 }}>
          <p className="eyebrow">Recarga en caja</p>
          <h1>Código de alumno</h1>
          <p className="app-lead">
            Este enlace identifica a un alumno para recargar saldo en Caja. Si llegaste aquí por
            error, vuelve a tu cuenta.
          </p>
          <p className="muted">{walletQrUrl(id)}</p>
          <Link className="btn btn--primary" to="/cuenta/saldo">
            Ir a mi saldo
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
