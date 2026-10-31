// "¿Ya estás en el lugar?": entrada por código, cámara o etiqueta NFC.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { enterSpace, parseEntry, storeDestination } from '../lib/space-entry';
import { NfcSheet } from './nfc-sheet';
import { QrScannerSheet } from './qr-scanner-sheet';
import { TableCodeSheet } from './table-code-sheet';

type Sheet = 'qr' | 'code' | 'nfc' | null;

export function PlaceEntry({
  prominent = false,
  autoOpen = null,
}: {
  prominent?: boolean;
  autoOpen?: Sheet;
}) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet>(autoOpen);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) setSheet(autoOpen);
  }, [autoOpen]);

  async function enter(text: string) {
    const target = parseEntry(text);
    if (!target) {
      setError('Ese código no es de Vaiinilla. Revisa el número de tu mesa o usa la cámara.');
      return;
    }
    if (target.kind === 'store') {
      void navigate(storeDestination(target.slug));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { destination, nombre } = await enterSpace(target.token);
      setSheet(null);
      void navigate(destination, { state: { seatedAt: nombre } });
    } catch (cause) {
      setError(
        cause instanceof VaiinillaApiError && cause.status === 404
          ? 'No encontramos ese código. Revisa los 4 números de la mesa o del papel del mesero.'
          : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  function open(next: Exclude<Sheet, null>) {
    setError(null);
    setSheet(next);
  }

  return (
    <section className={prominent ? 'alumno-entry is-prominent' : 'alumno-entry'} aria-labelledby="place-entry-title">
      <h2 id="place-entry-title">{prominent ? 'Escribe el número de tu mesa' : '¿Ya estás en el lugar?'}</h2>
      <p>Escribe los 4 números que ves en la mesa o en el papel del mesero.</p>
      <div className="alumno-entry__options">
        <button type="button" className="alumno-entry__option is-main" onClick={() => open('code')}>
          <EntryIcon kind="code" />
          <span>Escribir número de mesa</span>
        </button>
      </div>
      <div className="alumno-entry__more">
        <button className="alumno-entry__more-toggle" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          {moreOpen ? 'Ocultar opciones' : 'Más opciones'}
        </button>
        {moreOpen ? (
          <div className="alumno-entry__options">
            <button type="button" className="alumno-entry__option" onClick={() => open('qr')}>
              <EntryIcon kind="qr" />
              <span>Usar cámara</span>
            </button>
            <button type="button" className="alumno-entry__option" onClick={() => open('nfc')}>
              <EntryIcon kind="nfc" />
              <span>Acercar el teléfono a la etiqueta</span>
            </button>
          </div>
        ) : null}
      </div>
      {error && sheet === null ? <p className="alumno-error">{error}</p> : null}

      {sheet === 'qr' ? (
        <QrScannerSheet
          onResult={(text) => {
            setSheet(null);
            void enter(text);
          }}
          onClosed={() => setSheet((current) => (current === 'qr' ? null : current))}
        />
      ) : null}
      {sheet === 'nfc' ? (
        <NfcSheet
          onResult={(text) => {
            setSheet(null);
            void enter(text);
          }}
          onClosed={() => setSheet((current) => (current === 'nfc' ? null : current))}
        />
      ) : null}
      {sheet === 'code' ? (
        <TableCodeSheet
          code={code}
          resolving={busy}
          error={error}
          onChange={(next) => {
            setCode(next.replace(/\D/g, ''));
            setError(null);
          }}
          onConfirm={() => void enter(code)}
          onClosed={() => setSheet((current) => (current === 'code' ? null : current))}
        />
      ) : null}
    </section>
  );
}

function EntryIcon({ kind }: { kind: 'qr' | 'code' | 'nfc' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'qr' ? (
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM16 16h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
      ) : kind === 'code' ? (
        <path d="M5 6h3M5 12h3M5 18h3M11 6h3M11 12h3M11 18h3M17 6h2M17 12h2M17 18h2" />
      ) : (
        <path d="M7 7a7 7 0 0 1 0 10M10.5 9.5a3.5 3.5 0 0 1 0 5M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      )}
    </svg>
  );
}
