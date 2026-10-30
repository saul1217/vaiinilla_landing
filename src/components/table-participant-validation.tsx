import { useEffect, useRef } from 'react';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { clientSessionForPlace } from '../lib/client-session-for-place';
import { readTableParticipant } from '../lib/table-participant';
import { validateTableParticipant } from '../lib/validate-table-participant';

/** Validate a saved table identity once authentication is ready at startup. */
export function TableParticipantValidation() {
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const identity = readTableParticipant();
    if (!identity) return;
    void clientSessionForPlace({ slug: identity.slug, user, context, openClientSession })
      .then((client) => validateTableParticipant(client.access_token))
      .catch(() => undefined);
  }, [context, openClientSession, ready, user]);

  return null;
}
