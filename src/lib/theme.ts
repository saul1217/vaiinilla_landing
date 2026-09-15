export type ThemePreference = 'system' | 'light' | 'dark' | 'amoled';
export type ResolvedTheme = 'light' | 'dark' | 'amoled';

export const THEME_STORAGE_KEY = 'vaiinilla.buyer.theme.v1';

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
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function themeColorFor(resolved: ResolvedTheme): string {
  if (resolved === 'amoled') return '#000000';
  if (resolved === 'dark') return '#171817';
  return '#F4F1E7';
}
