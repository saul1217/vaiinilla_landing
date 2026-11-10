import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { applyAlumnoTheme, ThemeProvider, useTheme } from './theme-context';

function mockMatchMedia(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function Probe() {
  const { preference, resolved, cycleTheme } = useTheme();
  return (
    <button type="button" onClick={cycleTheme}>
      {preference}/{resolved}
    </button>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#F4F1E7" />';
    mockMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.vaiTheme;
  });

  it('cycleTheme pasa por sistema, claro, oscuro y AMOLED y lo guarda', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('system/light');
    await user.click(button);
    expect(button).toHaveTextContent('light/light');
    await user.click(button);
    expect(button).toHaveTextContent('dark/dark');
    await user.click(button);
    expect(button).toHaveTextContent('amoled/amoled');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('amoled');
    await user.click(button);
    expect(button).toHaveTextContent('system/light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });
});

describe('applyAlumnoTheme', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#F4F1E7" />';
  });

  it('AMOLED marca data-theme oscuro, data-vai-theme amoled y la barra en negro', () => {
    const root = document.documentElement;
    const restore = applyAlumnoTheme('amoled');
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.vaiTheme).toBe('amoled');
    expect(root.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
    restore();
    expect(root.dataset.theme).toBeUndefined();
    expect(root.dataset.vaiTheme).toBeUndefined();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#F4F1E7');
  });

  it('claro y oscuro cambian la barra del navegador según el tema activo', () => {
    const meta = () => document.querySelector('meta[name="theme-color"]');
    const restoreDark = applyAlumnoTheme('dark');
    expect(document.documentElement.dataset.vaiTheme).toBe('oscuro');
    expect(meta()).toHaveAttribute('content', '#171817');
    restoreDark();
    const restoreLight = applyAlumnoTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.vaiTheme).toBe('claro');
    expect(meta()).toHaveAttribute('content', '#F4F1E7');
    restoreLight();
  });
});
