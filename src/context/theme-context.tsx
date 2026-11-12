/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isDarkTheme,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  themeColorFor,
  vaiThemeFor,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Pasa al siguiente modo como `VaiinillaThemeMode.next()` en Android. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readThemePreference(),
  );
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window === 'undefined' ? false : prefersDarkMode(),
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(preference, prefersDark);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
  }, []);

  const cycleTheme = useCallback(
    () => setPreference(nextThemePreference(preference)),
    [preference, setPreference],
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycleTheme }),
    [preference, resolved, setPreference, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      preference: 'system',
      resolved: 'light',
      setPreference: () => undefined,
      cycleTheme: () => undefined,
    };
  }
  return context;
}

export function applyAlumnoTheme(resolved: ResolvedTheme): () => void {
  const root = document.documentElement;
  const previousTheme = root.dataset.theme;
  const previousVaiTheme = root.dataset.vaiTheme;
  const previousScheme = root.style.colorScheme;
  // AMOLED conserva data-theme="dark" para no perder las reglas oscuras que ya existen;
  // data-vai-theme marca el modo exacto para los tokens de Android.
  root.dataset.theme = isDarkTheme(resolved) ? 'dark' : 'light';
  root.dataset.vaiTheme = vaiThemeFor(resolved);
  root.style.colorScheme = isDarkTheme(resolved) ? 'dark' : 'light';
  document.body.dataset.shell = 'alumno';
  const meta = document.querySelector('meta[name="theme-color"]');
  const previousColor = meta?.getAttribute('content') ?? null;
  meta?.setAttribute('content', themeColorFor(resolved));
  return () => {
    if (previousTheme) root.dataset.theme = previousTheme;
    else delete root.dataset.theme;
    if (previousVaiTheme) root.dataset.vaiTheme = previousVaiTheme;
    else delete root.dataset.vaiTheme;
    root.style.colorScheme = previousScheme;
    delete document.body.dataset.shell;
    if (previousColor) meta?.setAttribute('content', previousColor);
  };
}
