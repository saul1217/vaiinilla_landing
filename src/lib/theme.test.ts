import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isDarkTheme,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  themeColorFor,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  vaiThemeFor,
  writeThemePreference,
} from './theme';
import { normalizeResolvedSpace } from './resolved-space';

describe('theme', () => {
  afterEach(() => vi.restoreAllMocks());
  it('resuelve sistema a oscuro cuando el OS lo pide', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('amoled', false)).toBe('amoled');
  });

  it('pinta la barra del navegador con el papel de cada modo', () => {
    expect(themeColorFor('light')).toBe('#F4F1E7');
    expect(themeColorFor('dark')).toBe('#171817');
    expect(themeColorFor('amoled')).toBe('#000000');
  });

  it('rota como VaiinillaThemeMode.next() de Android: sistema, claro, oscuro, AMOLED', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('amoled');
    expect(nextThemePreference('amoled')).toBe('system');
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual(['system', 'light', 'dark', 'amoled']);
  });

  it('AMOLED usa las reglas oscuras y marca su modo exacto para los tokens de Android', () => {
    expect(isDarkTheme('amoled')).toBe(true);
    expect(isDarkTheme('dark')).toBe(true);
    expect(isDarkTheme('light')).toBe(false);
    expect(vaiThemeFor('light')).toBe('claro');
    expect(vaiThemeFor('dark')).toBe('oscuro');
    expect(vaiThemeFor('amoled')).toBe('amoled');
  });

  it('conserva una preferencia AMOLED guardada', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'amoled');
    expect(readThemePreference()).toBe('amoled');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('amoled');
    expect(THEME_STORAGE_KEY).toBe('vaiinilla.buyer.theme.v1');
  });

  it('ignora un valor guardado que no es un modo', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readThemePreference()).toBe('system');
  });

  it('usa sistema si falla la lectura del almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readThemePreference()).toBe('system');
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
