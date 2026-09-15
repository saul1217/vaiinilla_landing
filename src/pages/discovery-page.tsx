import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import type { PublicEstablishment } from '../types/api';

export function DiscoveryPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PublicEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void api
        .listEstablishments(query)
        .then((result) => {
          if (!active) return;
          setItems(result.establishments);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(errorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">Comprador</p>
          <h1>Encuentra tu cafetería</h1>
          <p className="app-lead">
            Explora el menú sin iniciar sesión. Para confirmar el pedido entra con tu cuenta de
            alumno.
          </p>
          <div className="search-row">
            <label className="sr-only" htmlFor="search-places">
              Buscar cafetería
            </label>
            <input
              id="search-places"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca por nombre"
              autoComplete="off"
            />
          </div>
          {error ? <p className="feedback">{error}</p> : null}
          {loading ? <p role="status">Cargando cafeterías…</p> : null}
          {!loading && items.length === 0 && !error ? (
            <div className="empty-state">No hay cafeterías publicadas todavía.</div>
          ) : (
            <div className="card-grid">
              {items.map((place) => (
                <article className="place-card" key={place.id}>
                  <h2>{place.nombre}</h2>
                  <p>Menú público. Pedido para llevar.</p>
                  <Link className="btn btn--primary" to={`/e/${place.slug}`}>
                    Ver menú
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}
