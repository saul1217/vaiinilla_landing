import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { errorMessage } from '../lib/api-error';
import { enterSpace } from '../lib/space-entry';
import { openingTitle, spaceNoun } from '../lib/space-words';

export function TableJoinPage() {
  const { slug = '', token = '' } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void enterSpace(token, Boolean(user), slug)
      .then(({ destination, tipo }) => {
        if (!active) return;
        setKind(tipo);
        void navigate(destination, { replace: true });
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [navigate, ready, slug, token, user]);

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker={spaceNoun(kind).replace(/^./, (c) => c.toUpperCase())}
          title={openingTitle(kind)}
          back={error ? { to: '/pedir', label: 'Volver' } : undefined}
        />
        {error ? (
          <>
            <p className="alumno-error">{error}</p>
            <Link className="alumno-btn alumno-btn--lime" to="/pedir">
              Elegir lugar
            </Link>
          </>
        ) : (
          <p role="status">Resolviendo el código de mesa…</p>
        )}
      </main>
    </AppShell>
  );
}
