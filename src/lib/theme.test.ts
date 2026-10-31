import { afterEach, describe, expect, it, vi } from 'vitest';
import { readThemePreference, resolveTheme, themeColorFor, THEME_STORAGE_KEY, writeThemePreference } from './theme';
import { normalizeResolvedSpace } from './resolved-space';

describe('theme', () => {
  afterEach(() => vi.restoreAllMocks());
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
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(THEME_STORAGE_KEY).toBe('vaiinilla.buyer.theme.v1');
  });

  it('usa sistema si falla la lectura del almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readThemePreference()).toBe('system');
  });

  it('mantiene oscuro si falla guardar la migración AMOLED', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('amoled');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(readThemePreference()).toBe('dark');
  });

  it('no lanza si falla guardar una preferencia', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => writeThemePreference('light')).not.toThrow();
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
