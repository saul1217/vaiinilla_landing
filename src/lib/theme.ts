export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vaiinilla.buyer.theme.v1';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return 'system';
  }
  if (stored === 'amoled') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } catch {
      // La preferencia oscura sigue siendo válida aunque no se pueda persistir.
    }
    return 'dark';
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

export function themeColorFor(resolved: ResolvedTheme): string {
  if (resolved === 'dark') return '#171817';
  return '#F4F1E7';
}
