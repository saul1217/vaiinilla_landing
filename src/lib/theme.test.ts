import { describe, expect, it } from 'vitest';
import { resolveTheme, themeColorFor } from './theme';
import { normalizeResolvedSpace } from './resolved-space';

describe('theme', () => {
  it('resuelve sistema a oscuro cuando el OS lo pide', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('amoled', false)).toBe('amoled');
    expect(themeColorFor('light')).toBe('#F4F1E7');
    expect(themeColorFor('dark')).toBe('#171817');
    expect(themeColorFor('amoled')).toBe('#000000');
  });
});

describe('mesa QR', () => {
  it('normaliza el payload anidado de /publico/espacios/resolver', () => {
    expect(
      normalizeResolvedSpace(
        {
          espacio: { id: 12, nombre: 'Mesa 4' },
          establecimiento: { slug: 'demo-a', nombre: 'Cafetería Demo A' },
        },
        'demo-a',
      ),
    ).toEqual({
      espacio_id: 12,
      espacio_nombre: 'Mesa 4',
      establecimiento_slug: 'demo-a',
      establecimiento_nombre: 'Cafetería Demo A',
    });
  });
});
