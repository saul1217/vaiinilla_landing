/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { firebaseIdToken } from '../lib/firebase';
import { VaiinillaApiError } from '../lib/api-error';
import type { ClientContextResponse, PublicEstablishment } from '../types/api';

interface BuyerSessionValue {
  context: ClientContextResponse | null;
  opening: boolean;
  openClientSession: (
    user: User,
    establishment: PublicEstablishment,
    identificadorCliente?: string,
  ) => Promise<ClientContextResponse>;
  clearSession: () => void;
}

const BuyerSessionContext = createContext<BuyerSessionValue | null>(null);

export function BuyerSessionProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<ClientContextResponse | null>(null);
  const [opening, setOpening] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setContext(null);
  }, []);

  const openClientSession = useCallback(
    async (user: User, establishment: PublicEstablishment, identificadorCliente?: string) => {
      setOpening(true);
      try {
        const firebaseToken = await firebaseIdToken(user);
        let clientId = identificadorCliente?.trim() || undefined;
        if (!clientId) {
          try {
            const accesses = await api.listAccesses(firebaseToken);
            const match = accesses.find(
              (access) =>
                access.rol === 'cliente' && access.establecimiento.slug === establishment.slug,
            );
            clientId = match?.identificador_cliente ?? undefined;
          } catch {
            // Accesos no disponibles: el identificador se pide en cuenta.
          }
        }
        if (establishment.identificador_cliente_obligatorio && !clientId) {
          throw new VaiinillaApiError(400, {
            code: 'VALIDATION_ERROR',
            message: `Captura tu ${establishment.identificador_cliente_etiqueta.toLowerCase()} para pedir aquí.`,
          });
        }
        const next = await api.createClientContext(firebaseToken, establishment.slug, clientId);
        tokenRef.current = next.access_token;
        setContext(next);
        return next;
      } finally {
        setOpening(false);
      }
    },
    [],
  );

  const value = useMemo<BuyerSessionValue>(
    () => ({ context, opening, openClientSession, clearSession }),
    [clearSession, context, openClientSession, opening],
  );

  return <BuyerSessionContext.Provider value={value}>{children}</BuyerSessionContext.Provider>;
}

export function useBuyerSession(): BuyerSessionValue {
  const context = useContext(BuyerSessionContext);
  if (!context) throw new Error('useBuyerSession debe usarse dentro de BuyerSessionProvider.');
  return context;
}
