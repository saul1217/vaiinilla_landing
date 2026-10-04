// NFC: la etiqueta guarda el mismo enlace que el QR. En iPhone y en la mayoría de
// Android, acercar el teléfono abre el enlace solo; en Chrome Android además se puede
// leer aquí mismo, sin salir de la app.
import { useEffect, useRef, useState } from 'react';
import { MotionSheet } from './motion-sheet';

interface NdefRecord {
  recordType: string;
  data?: DataView;
}
interface NdefReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', listener: (event: { message: { records: NdefRecord[] } }) => void): void;
}
type NdefWindow = Window & { NDEFReader?: new () => NdefReader };

function canReadNfc(): boolean {
  return typeof window !== 'undefined' && typeof (window as NdefWindow).NDEFReader === 'function';
}

export function NfcSheet({ onResult, onClosed }: { onResult: (text: string) => void; onClosed: () => void }) {
  const live = canReadNfc();
  const [failed, setFailed] = useState(false);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    const Reader = (window as NdefWindow).NDEFReader;
    if (!Reader) return;
    const abort = new AbortController();
    const reader = new Reader();
    reader.addEventListener('reading', ({ message }) => {
      const record = message.records.find((r) => r.recordType === 'url' && r.data);
      if (!record?.data) return;
      abort.abort();
      resultRef.current(new TextDecoder().decode(record.data));
    });
    reader.scan({ signal: abort.signal }).catch(() => setFailed(true));
    return () => abort.abort();
  }, []);

  return (
    <MotionSheet className="alumno-sheet alumno-codesheet" labelledBy="nfc-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <h2 id="nfc-title">Acerca tu teléfono</h2>
          <div className="alumno-nfc" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="alumno-codesheet__lead" role="status">
            {live && !failed
              ? 'Pon la parte de atrás de tu teléfono sobre la etiqueta de la mesa.'
              : 'Acerca la parte de arriba de tu teléfono a la etiqueta de la mesa: tu teléfono abre Vaiinilla solo.'}
          </p>
          {failed ? (
            <p className="alumno-codesheet__error">Activa el NFC en los ajustes de tu teléfono, o escribe el código.</p>
          ) : null}
          <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
            Cancelar
          </button>
        </div>
      )}
    </MotionSheet>
  );
}
