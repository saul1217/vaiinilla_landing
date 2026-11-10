/**
 * Los mismos modos que la app de Android (`VaiinillaThemeMode`): sistema, claro,
 * oscuro y AMOLED (negro real). Sistema se resuelve a claro u oscuro según el
 * teléfono, así que lo que se pinta siempre es uno de tres modos.
 */
export type ThemePreference = 'system' | 'light' | 'dark' | 'amoled';
export type ResolvedTheme = 'light' | 'dark' | 'amoled';

export const THEME_STORAGE_KEY = 'vaiinilla.buyer.theme.v1';

/** En el orden de `VaiinillaThemeMode` en Android. */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'amoled', label: 'AMOLED' },
];

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark' || value === 'amoled';
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return 'system';
  }
  return isThemePreference(stored) ? stored : 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // El tema sigue aplicándose en memoria aunque el almacenamiento esté bloqueado.
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/** Como `VaiinillaThemeMode.next()`: sistema, claro, oscuro, AMOLED y de vuelta a sistema. */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  switch (preference) {
    case 'system':
      return 'light';
    case 'light':
      return 'dark';
    case 'dark':
      return 'amoled';
    case 'amoled':
      return 'system';
  }
}

/** AMOLED usa las reglas de modo oscuro que ya existen y solo lleva el papel a negro real. */
export function isDarkTheme(resolved: ResolvedTheme): boolean {
  return resolved !== 'light';
}

/** Valor de `data-vai-theme` para los tokens de `styles/android-tokens.css`. */
export function vaiThemeFor(resolved: ResolvedTheme): 'claro' | 'oscuro' | 'amoled' {
  if (resolved === 'amoled') return 'amoled';
  return resolved === 'dark' ? 'oscuro' : 'claro';
}

/** La barra del navegador toma el color del papel de cada modo, como la barra de estado en Android. */
export function themeColorFor(resolved: ResolvedTheme): string {
  if (resolved === 'amoled') return '#000000';
  if (resolved === 'dark') return '#171817';
  return '#F4F1E7';
}
