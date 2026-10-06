import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { errorMessage } from '../lib/api-error';
import { enterSpace } from '../lib/space-entry';
import { isSharableSpace, openingTitle, spaceNoun } from '../lib/space-words';

export function TableJoinPage() {
  const { slug = '', token = '' } = useParams();
  const navigate = useNavigate();
  const { ready } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void enterSpace(token, slug)
      .then(({ destination, tipo, nombre }) => {
        if (!active) return;
        setKind(tipo);
        // Espacio compartible (mesa): antes del menú se elige quién se es.
        if (isSharableSpace(tipo)) {
          const base = slug ? `/e/${slug}/m/${encodeURIComponent(token)}/quien` : `/m/${encodeURIComponent(token)}/quien`;
          void navigate(`${base}?next=${encodeURIComponent(destination)}`, { replace: true });
          return;
        }
        void navigate(destination, { replace: true, state: { seatedAt: nombre } });
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [navigate, ready, slug, token]);

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
