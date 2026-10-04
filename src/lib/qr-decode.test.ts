import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { decodeQrImage } from './qr-decode';

/** Dibuja un QR real como imagen RGBA, igual que un cuadro de la cámara. */
function qrImage(text: string, scale = 6, margin = 4) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = (modules.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, size };
}

describe('lectura de QR de la cámara', () => {
  it('lee el enlace de una mesa en un QR real', async () => {
    const url = 'https://vaiinilla.app/renasci-bar/m/esp_hf6PBueav8XTQi84vUZfLHbo9SXlwFvhlAWxm2GJloA';
    const { data, size } = qrImage(url);
    await expect(decodeQrImage(data, size, size)).resolves.toBe(url);
  });

  it('una imagen sin QR no inventa nada', async () => {
    const blank = new Uint8ClampedArray(120 * 120 * 4).fill(255);
    await expect(decodeQrImage(blank, 120, 120)).resolves.toBeNull();
  });
});
