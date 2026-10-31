import { describe, expect, it } from 'vitest';
import { readThemePreference, resolveTheme, themeColorFor, THEME_STORAGE_KEY } from './theme';
import { normalizeResolvedSpace } from './resolved-space';

describe('theme', () => {
  it('resuelve sistema a oscuro cuando el OS lo pide', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(themeColorFor('light')).toBe('#F4F1E7');
    expect(themeColorFor('dark')).toBe('#171817');
    expect(themeColorFor('dark')).toBe('#171817');
  });

  it('migra una preferencia AMOLED guardada a oscuro sin cambiar la clave', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'amoled');
    expect(readThemePreference()).toBe('dark');
    expect(THEME_STORAGE_KEY).toBe('vaiinilla.buyer.theme.v1');
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
      espacio_tipo: null,
      establecimiento_slug: 'demo-a',
      establecimiento_nombre: 'Cafetería Demo A',
    });
  });
});
