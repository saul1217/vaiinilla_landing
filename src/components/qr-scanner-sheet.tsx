// Escanear el QR de la mesa o de la tienda sin salir de la app (en iPhone la cámara del
// sistema abriría Safari, otra memoria distinta a la app instalada). Usa el lector nativo
// del navegador si existe y, si no, decodifica los cuadros con jsQR.
import { useEffect, useRef, useState } from 'react';
import { decodeQrImage, loadQrDecoder } from '../lib/qr-decode';
import { MotionSheet } from './motion-sheet';

type Status = 'starting' | 'scanning' | 'denied' | 'unsupported';

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorWindow = Window & {
  BarcodeDetector?: new (options: { formats: string[] }) => NativeDetector;
};

const FRAME_MS = 140;
const MAX_SIDE = 640;

export function QrScannerSheet({ onResult, onClosed }: { onResult: (text: string) => void; onClosed: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let done = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const Native = (window as DetectorWindow).BarcodeDetector;
    const detector = Native ? new Native({ formats: ['qr_code'] }) : null;
    if (!detector) void loadQrDecoder();

    const read = async (video: HTMLVideoElement): Promise<string | null> => {
      if (detector) {
        const found = await detector.detect(video).catch(() => []);
        return found[0]?.rawValue ?? null;
      }
      if (!context || !video.videoWidth) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return decodeQrImage(image.data, image.width, image.height);
    };

    const tick = async () => {
      const video = videoRef.current;
      if (done || !video) return;
      const text = await read(video);
      if (done) return;
      if (text) {
        done = true;
        resultRef.current(text);
        return;
      }
      timer = window.setTimeout(() => void tick(), FRAME_MS);
    };

    void media
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (next) => {
        stream = next;
        const video = videoRef.current;
        if (done || !video) return;
        video.srcObject = next;
        await video.play().catch(() => undefined);
        setStatus('scanning');
        void tick();
      })
      .catch(() => setStatus('denied'));

    return () => {
      done = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <MotionSheet className="alumno-sheet alumno-codesheet" labelledBy="qr-scan-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <h2 id="qr-scan-title">Escanea el QR</h2>
          <p className="alumno-codesheet__lead">Apunta al QR de tu mesa, cancha o de la tienda.</p>
          <div className={status === 'scanning' ? 'alumno-scanner is-live' : 'alumno-scanner'}>
            <video ref={videoRef} playsInline muted aria-label="Vista de la cámara" />
            <span className="alumno-scanner__frame" aria-hidden="true" />
          </div>
          {status === 'denied' ? (
            <p className="alumno-codesheet__error">Permite la cámara para escanear, o escribe el código de tu mesa.</p>
          ) : status === 'unsupported' ? (
            <p className="alumno-codesheet__error">Este navegador no abre la cámara. Escribe el código de tu mesa.</p>
          ) : (
            <p className="alumno-codesheet__lead" role="status">
              {status === 'starting' ? 'Abriendo la cámara…' : 'Buscando el QR…'}
            </p>
          )}
          <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
            Cancelar
          </button>
        </div>
      )}
    </MotionSheet>
  );
}
