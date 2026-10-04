import { describe, expect, it } from 'vitest';
import { parseEntry } from './space-entry';

describe('lo que se lee en un QR, una etiqueta NFC o el teclado', () => {
  it('el enlace de una mesa da su token (con o sin /e)', () => {
    expect(parseEntry('https://vaiinilla.app/renasci-bar/m/esp_abc')).toEqual({ kind: 'space', token: 'esp_abc' });
    expect(parseEntry('https://www.vaiinilla.app/e/renasci-bar/m/esp_abc')).toEqual({ kind: 'space', token: 'esp_abc' });
  });

  it('el QR general de la tienda abre su menú', () => {
    expect(parseEntry('https://vaiinilla.app/e/renasci-bar')).toEqual({ kind: 'store', slug: 'renasci-bar' });
  });

  it('un código de 4 dígitos es una mesa', () => {
    expect(parseEntry(' 1736 ')).toEqual({ kind: 'space', token: '1736' });
  });

  it('lo que no es de Vaiinilla se rechaza', () => {
    expect(parseEntry('https://otro-sitio.com/renasci-bar/m/esp_abc')).toBeNull();
    expect(parseEntry('hola')).toBeNull();
    expect(parseEntry('123')).toBeNull();
    expect(parseEntry('https://vaiinilla.app/pedir')).toBeNull();
  });
});
