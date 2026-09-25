// Deliver an order at the table: the backend requires the buyer's QR token, so
// the waiter scans the QR (BarcodeDetector where it exists, jsQR elsewhere, e.g.
// iOS Safari) or pastes the code.
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/api-error';
import type { BoardOrder } from '../lib/mesero-api';
import { MotionSheet } from './motion-sheet';

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

function detectorCtor(): DetectorCtor | null {
  const ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function DeliverSheet({
  order,
  onDeliver,
  onClosed,
}: {
  order: BoardOrder;
  onDeliver: (qrToken: string) => Promise<void>;
  onClosed: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canScan = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
  const [mode, setMode] = useState<'scan' | 'type'>(() => (canScan ? 'scan' : 'type'));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const closeRef = useRef<() => void>(() => {});
  const submitting = useRef(false);

  async function submit(token: string) {
    if (submitting.current || !token.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onDeliver(token);
      setDone(true);
      navigator.vibrate?.(40);
      window.setTimeout(() => closeRef.current(), 900);
    } catch (cause) {
      setError(errorMessage(cause));
      submitting.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== 'scan' || done) return;
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const Ctor = detectorCtor();
    const detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let jsQR: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;
    if (!detector) void import('jsqr').then((mod) => (jsQR = mod.default));

    const read = async (): Promise<string | null> => {
      if (detector) {
        const [hit] = await detector.detect(video);
        return hit?.rawValue ?? null;
      }
      if (!jsQR || !ctx || !video.videoWidth) return null;
      const scale = Math.min(1, 480 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(frame.data, frame.width, frame.height)?.data ?? null;
    };
    const scan = async () => {
      if (stopped) return;
      try {
        const value = await read();
        if (value) {
          void submit(value);
          return;
        }
      } catch {
        // frame not ready yet
      }
      timer = window.setTimeout(() => void scan(), 200);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        video.srcObject = media;
        void video.play().then(scan);
      })
      .catch(() => {
        setError('No se pudo abrir la cámara. Pega el código del QR.');
        setMode('type');
      });
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, done]);

  return (
    <MotionSheet className="alumno-sheet alumno-codesheet mesero-sheet" labelledBy="deliver-title" onClosed={onClosed}>
      {(close, dragHandle) => {
        closeRef.current = close;
        return (
          <div className="alumno-codesheet__panel">
            <div className="alumno-codesheet__grab" {...dragHandle}>
              <span aria-hidden="true" />
            </div>
            <h2 id="deliver-title">Entregar #{order.folio}</h2>
            <p className="alumno-codesheet__lead">
              {order.cliente?.nombre ?? 'Cliente'} · {order.items_resumen}
            </p>

            {done ? (
              <div className="mesero-done" role="status">
                <svg viewBox="0 0 52 52" aria-hidden="true">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M15 27l7 7 15-16" />
                </svg>
                <strong>Entregado</strong>
              </div>
            ) : mode === 'scan' ? (
              <div className="mesero-scan">
                <video ref={videoRef} playsInline muted aria-label="Cámara para escanear el QR del cliente" />
                <span className="mesero-scan__frame" aria-hidden="true" />
                <p>Apunta al QR que muestra el cliente en su pedido.</p>
              </div>
            ) : (
              <form
                className="mesero-type"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(code);
                }}
              >
                <label htmlFor="deliver-code">Código del QR</label>
                <input
                  id="deliver-code"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Pega el código del QR"
                />
                <button className="alumno-btn alumno-btn--lime" type="submit" disabled={busy || !code.trim()}>
                  {busy ? 'Entregando…' : 'Confirmar entrega'}
                </button>
              </form>
            )}

            {error ? <p className="alumno-error">{error}</p> : null}
            {!done ? (
              <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={() => setMode(mode === 'scan' ? 'type' : 'scan')} hidden={!canScan}>
                {mode === 'scan' ? 'Escribir el código' : 'Escanear el QR'}
              </button>
            ) : null}
            {!done ? (
              <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
                Cancelar
              </button>
            ) : null}
          </div>
        );
      }}
    </MotionSheet>
  );
}
