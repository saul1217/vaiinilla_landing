import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { rememberPlace } from '../lib/last-place';
import { rememberSpace } from '../lib/space-session';

export function TableJoinPage() {
  const { slug = '', token = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .resolveSpace(token, slug)
      .then((resolved) => {
        if (!active) return;
        rememberPlace(resolved.establecimiento_slug);
        rememberSpace({
          slug: resolved.establecimiento_slug,
          espacioId: resolved.espacio_id,
          nombre: resolved.espacio_nombre,
        });
        void navigate(`/e/${resolved.establecimiento_slug}`, { replace: true });
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [navigate, slug, token]);

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Mesa"
          title="Abriendo tu mesa"
          back={error ? { to: '/pedir', label: 'Volver' } : undefined}
        />
        {error ? (
          <>
            <p className="alumno-error">{error}</p>
            <Link className="alumno-btn alumno-btn--lime" to="/pedir">
              Elegir cafetería
            </Link>
          </>
        ) : (
          <p role="status">Resolviendo el código de mesa…</p>
        )}
      </main>
    </AppShell>
  );
}
