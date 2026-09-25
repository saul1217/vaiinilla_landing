// /mesero: sign in with the staff account, pick the venue if there are several
// waiter accesses, exchange Firebase identity for a 15-min staff context (renewed
// before it expires) and show the table board.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { WaiterBoard } from '../components/waiter-board';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { firebaseIdToken } from '../lib/firebase';
import { createStaffContext, createWaiterClient, waiterAccesses } from '../lib/mesero-api';
import type { SessionAccess } from '../types/api';

const PICK_KEY = 'vaiinilla.mesero.membresia';

function remembered() {
  try {
    return window.localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

export function WaiterPage() {
  const { user, ready, signOut } = useAuth();
  const [accesses, setAccesses] = useState<SessionAccess[] | null>(null);
  const [picked, setPicked] = useState<string | null>(remembered);
  const [error, setError] = useState<string | null>(null);
  const context = useRef<{ token: string; expiresAt: number; membresia: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const list = waiterAccesses(await api.listAccesses(await firebaseIdToken(user)));
        if (active) setAccesses(list);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const access = accesses?.find((item) => item.membresia_id === picked) ?? (accesses?.length === 1 ? accesses[0] : null);

  const client = useMemo(() => {
    if (!user || !access) return null;
    return createWaiterClient(async () => {
      const current = context.current;
      if (current && current.membresia === access.membresia_id && Date.now() < current.expiresAt) return current.token;
      const next = await createStaffContext(await firebaseIdToken(user), access.membresia_id);
      context.current = { token: next.access_token, membresia: access.membresia_id, expiresAt: Date.now() + Math.max(60, next.expires_in - 60) * 1000 };
      return next.access_token;
    });
  }, [user, access]);

  function pick(id: string) {
    setPicked(id);
    try {
      window.localStorage.setItem(PICK_KEY, id);
    } catch {
      // remembered only for this visit
    }
  }

  if (!ready) {
    return (
      <AppShell>
        <main id="main-content" className="alumno-main">
          <LoadingSkeleton shape="rows" label="Cargando…" />
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main id="main-content" className="alumno-main mesero-gate">
          <AlumnoPageHeader kicker="Personal" title="Mesas" lead="Entra con la cuenta que te invitó administración como mesero." />
          <Link className="alumno-btn alumno-btn--lime" to="/cuenta?next=/mesero">
            Iniciar sesión
          </Link>
        </main>
      </AppShell>
    );
  }

  if (error || (accesses && accesses.length === 0)) {
    return (
      <AppShell>
        <main id="main-content" className="alumno-main mesero-gate">
          <AlumnoPageHeader kicker="Personal" title="Sin acceso de mesero" lead={error ?? `${user.email ?? 'Esta cuenta'} no tiene un acceso activo de mesero. Pídele a administración que te invite.`} />
          <button className="alumno-btn" type="button" onClick={() => void signOut()}>
            Usar otra cuenta
          </button>
        </main>
      </AppShell>
    );
  }

  if (!accesses) {
    return (
      <AppShell>
        <main id="main-content" className="alumno-main">
          <LoadingSkeleton shape="rows" label="Buscando tus accesos…" />
        </main>
      </AppShell>
    );
  }

  if (!access || !client) {
    return (
      <AppShell>
        <main id="main-content" className="alumno-main mesero-gate">
          <AlumnoPageHeader kicker="Personal" title="¿Dónde trabajas hoy?" />
          <div className="mesero-places alumno-arrive">
            {accesses.map((item) => (
              <button key={item.membresia_id} type="button" onClick={() => pick(item.membresia_id)}>
                <strong>{item.establecimiento.nombre}</strong>
                <span>Mesero</span>
              </button>
            ))}
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WaiterBoard
        client={client}
        placeName={access.establecimiento.nombre}
        onSignOut={
          accesses.length > 1
            ? () => {
                setPicked(null);
                context.current = null;
              }
            : () => void signOut()
        }
      />
    </AppShell>
  );
}
