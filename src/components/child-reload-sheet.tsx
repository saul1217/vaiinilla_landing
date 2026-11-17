import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { walletQrUrl } from '../lib/env';
import { firstName, type Dependent } from '../lib/guardianship';
import { formatAmount } from '../lib/money';
import { CardReloadPanel, type CardReloadClient } from '../pages/wallet-reload-page';
import type { WalletData } from '../types/api';
import { ParentSheet } from './parent-sheet';

/** Recargar al hijo (Expo `ChildReloadSheet`): con tarjeta a su cartera o en Caja con su QR. */
export function ChildReloadSheet({
  child,
  childToken,
  wallet,
  client,
  onSettled,
  onClosed,
}: {
  child: Dependent;
  childToken: string;
  wallet: WalletData;
  client: CardReloadClient;
  onSettled: () => void;
  onClosed: () => void;
}) {
  const first = firstName(child.name);
  const [tab, setTab] = useState<'card' | 'qr'>('card');
  const [qr, setQr] = useState<string | null>(null);
  const childPath = `/cuenta/hijos/${encodeURIComponent(child.userId)}`;

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(walletQrUrl(child.userId), { margin: 1, width: 320 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [child.userId]);

  return (
    <ParentSheet id="child-reload-title" title={`Recargar a ${first}`} onClosed={onClosed}>
      {() => (
        <div className="parent-sheet__body">
          <div className="alumno-chips parent-sheet__modes" role="tablist" aria-label="Cómo recargas">
            <button type="button" role="tab" aria-selected={tab === 'card'} className={`alumno-chip${tab === 'card' ? ' is-on' : ''}`} onClick={() => setTab('card')}>
              Con tarjeta
            </button>
            <button type="button" role="tab" aria-selected={tab === 'qr'} className={`alumno-chip${tab === 'qr' ? ' is-on' : ''}`} onClick={() => setTab('qr')}>
              En caja (QR)
            </button>
          </div>
          {tab === 'card' ? (
            <CardReloadPanel
              token={childToken}
              wallet={wallet}
              client={client}
              returnPath={childPath}
              onSettled={onSettled}
              done={{ to: childPath, label: 'Listo', title: (amount) => `Listo, entraron ${formatAmount(amount)} al saldo de ${first}` }}
            />
          ) : (
            <div className="parent-sheet__qr">
              <p className="alumno-muted">En Caja dile el nombre de tu hijo o que escanee este código QR.</p>
              {qr ? <img className="wallet-qr" src={qr} alt={`QR de ${child.name}`} /> : null}
              <strong>{child.name}</strong>
            </div>
          )}
        </div>
      )}
    </ParentSheet>
  );
}