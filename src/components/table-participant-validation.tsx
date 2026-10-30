import { useEffect, useRef } from 'react';
import { useAuth } from '../context/auth-context';
import { readStoredClientContext } from '../lib/client-session';
import { readTableParticipant } from '../lib/table-participant';
import { validateTableParticipant } from '../lib/validate-table-participant';

/** Validate a saved table identity once authentication is ready at startup. */
export function TableParticipantValidation() {
  const { ready } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const identity = readTableParticipant();
    if (!identity) return;
    const token = readStoredClientContext()?.context.access_token;
    if (!token) return;
    void validateTableParticipant(token).catch(() => undefined);
  }, [ready]);

  return null;
}
