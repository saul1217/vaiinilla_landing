// Sesión de cliente del invitado para la mesa compartida: la llave del navegador
// (localStorage) renueva el JWT de 15 min por negocio. El QR físico es la autoridad
// para entrar al espacio; la llave es la identidad. Contrato: backend
// docs/compra-sin-cuenta.md (tercera vuelta) y docs/mesa-compartida.md.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { guestSession, readGuest } from './guest-session';

const RENEW_MS = 10 * 60 * 1000;

export interface GuestSpaceToken {
  token: string | null;
  /** Sesión fresca con este nombre (renueva o da de alta con la llave). */
  ensure: (alias?: string) => Promise<string>;
}

/** JWT del invitado en este negocio para /mesas. Nulo para registrados. */
export function useGuestSpaceToken(slug: string | null): GuestSpaceToken {
  const { user, ready } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  const ensure = useCallback(
    async (alias?: string): Promise<string> => {
      if (!slug) throw new Error('Elige un establecimiento para unirte a la mesa.');
      const nombre = alias?.trim() || readGuest()?.nombre;
      if (!nombre) throw new Error('Escribe tu nombre para unirte a la mesa.');
      const session = await guestSession(slug, nombre);
      setToken(session.access_token);
      return session.access_token;
    },
    [slug],
  );

  useEffect(() => {
    if (!ready || user || !slug) return;
    if (!readGuest()) return;
    // Al entrar (y al volver otro día) la sesión se renueva sola con la llave.
    void ensure().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ensure().catch(() => undefined);
    }, RENEW_MS);
    return () => window.clearInterval(timer);
  }, [ensure, ready, slug, user]);

  return { token, ensure };
}
