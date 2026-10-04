// jsQR solo se descarga cuando hace falta: al abrir el escáner en un navegador sin lector
// nativo (iPhone). Así no pesa en la app de quien nunca escanea.
type Decoder = (typeof import('jsqr'))['default'];
let decoder: Promise<Decoder> | null = null;

export function loadQrDecoder(): Promise<Decoder> {
  decoder ??= import('jsqr').then((module) => module.default);
  return decoder;
}

/** Lee el texto de un QR en una imagen RGBA (un cuadro de la cámara). */
export async function decodeQrImage(data: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  const jsQR = await loadQrDecoder();
  return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}
