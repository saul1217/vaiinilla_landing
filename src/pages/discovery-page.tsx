import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { enableGuestExplore } from '../lib/guest-explore';
import { lastPlaceSlug, rememberPlace } from '../lib/last-place';
import { rememberSpace } from '../lib/space-session';
import type { PublicEstablishment } from '../types/api';

export function DiscoveryPage() {
  const { ready } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PublicEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableCode, setTableCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [resolving, setResolving] = useState(false);
  const [step, setStep] = useState<'list' | 'picker'>('list');

  useEffect(() => {
    if (!ready) return;
    enableGuestExplore();
  }, [ready]);

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
          const remembered = lastPlaceSlug();
          setSelectedId((current) => {
            if (current && result.establishments.some((item) => item.id === current)) return current;
            const preferred = result.establishments.find((item) => item.slug === remembered);
            return preferred?.id ?? result.establishments[0]?.id ?? null;
          });
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

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const recommended = useMemo(() => {
    const remembered = lastPlaceSlug();
    return items.find((item) => item.slug === remembered) ?? items[0] ?? null;
  }, [items]);

  async function resolveTableCode() {
    if (!tableCode.trim()) {
      setError('Escribe el código de la mesa.');
      return;
    }
    setResolving(true);
    setError(null);
    try {
      const resolved = await api.resolveSpace(tableCode.trim(), selected?.slug);
      rememberPlace(resolved.establecimiento_slug);
      rememberSpace({
        slug: resolved.establecimiento_slug,
        espacioId: resolved.espacio_id,
        nombre: resolved.espacio_nombre,
      });
      void navigate(`/e/${resolved.establecimiento_slug}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setResolving(false);
    }
  }

  function openPicker() {
    if (!selected) return;
    setError(null);
    setClientId(sessionStorage.getItem(`vaiinilla.buyer.client-id.${selected.slug}`) ?? '');
    setStep('picker');
  }

  function continueToMenu() {
    if (!selected) return;
    if (selected.identificador_cliente_obligatorio && !clientId.trim()) {
      setError(`Captura tu ${selected.identificador_cliente_etiqueta.toLowerCase()} para continuar.`);
      return;
    }
    if (clientId.trim()) {
      sessionStorage.setItem(`vaiinilla.buyer.client-id.${selected.slug}`, clientId.trim());
    }
    rememberPlace(selected.slug);
    void navigate(`/e/${selected.slug}`);
  }

  if (!ready) {
    return (
      <AppShell tab="none">
        <main id="main-content" className="alumno-main" role="status">
          Validando sesión…
        </main>
      </AppShell>
    );
  }

  if (step === 'picker' && selected) {
    return (
      <AppShell tab="menu">
        <main id="main-content" className="alumno-main">
          <AlumnoPageHeader
            kicker="Sede"
            title={selected.nombre}
            back={{ onClick: () => setStep('list'), label: 'Volver' }}
            lead={
              selected.identificador_cliente_obligatorio
                ? `Este lugar pide ${selected.identificador_cliente_etiqueta.toLowerCase()}.`
                : 'Acceso libre. Puedes abrir el menú o usar el código de tu mesa.'
            }
          />
          {error ? <p className="alumno-error">{error}</p> : null}
          <div className="alumno-picker">
            <div>
              {selected.identificador_cliente_obligatorio ? (
                <label className="alumno-field">
                  {selected.identificador_cliente_etiqueta}
                  <input
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              ) : null}
              <button className="alumno-btn alumno-btn--lime" type="button" onClick={continueToMenu}>
                Abrir menú
              </button>
            </div>
            <div className="alumno-card">
              <h2>Mesa</h2>
              <p className="alumno-muted">Si ya estás sentado, usa el código del QR.</p>
              <label className="alumno-field">
                Código de mesa
                <input
                  value={tableCode}
                  onChange={(event) => setTableCode(event.target.value)}
                  placeholder="Usar código"
                  autoComplete="off"
                />
              </label>
              <button
                className="alumno-btn alumno-btn--ghost"
                type="button"
                disabled={resolving}
                onClick={() => void resolveTableCode()}
              >
                {resolving ? 'Buscando mesa…' : 'Usar código'}
              </button>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="menu">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Hoy"
          title="¿Dónde comes hoy?"
          lead="Elige tu establecimiento. El menú se puede ver sin iniciar sesión."
        />
        <div className="alumno-discovery">
          <div className="alumno-discovery__list">
            <div className="alumno-search-wrap">
              <SearchIcon />
              <label className="sr-only" htmlFor="search-places">
                Buscar establecimiento
              </label>
              <input
                id="search-places"
                className="alumno-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca por nombre"
                autoComplete="off"
              />
            </div>
            {error ? <p className="alumno-error">{error}</p> : null}
            {loading ? <p role="status">Cargando establecimientos…</p> : null}
            {!loading && items.length === 0 && !error ? (
              <div className="alumno-empty">
                <img src="/vaini/cutout-frente.png" alt="" />
                <p>No hay establecimientos publicados todavía.</p>
              </div>
            ) : (
              <div className="alumno-radio-list" role="radiogroup" aria-label="Establecimientos">
                {items.map((place) => {
                  const isRecommended = recommended?.id === place.id;
                  const access = place.identificador_cliente_obligatorio
                    ? place.identificador_cliente_etiqueta
                    : 'Acceso libre';
                  return (
                    <button
                      key={place.id}
                      type="button"
                      role="radio"
                      aria-checked={selected?.id === place.id}
                      className={selected?.id === place.id ? 'alumno-radio is-on' : 'alumno-radio'}
                      onClick={() => setSelectedId(place.id)}
                    >
                      <span className="alumno-dot" />
                      <span>
                        <strong>{place.nombre}</strong>
                        <span>
                          {access}
                          {isRecommended ? ' · Recomendado' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {selected ? (
            <section className="alumno-sticky-cafe" aria-label="Lugar activo">
              <p>Lugar activo</p>
              <strong>{selected.nombre}</strong>
              <button className="alumno-btn alumno-btn--lime" type="button" onClick={openPicker}>
                Continuar
              </button>
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 0 1 5.9 12.13l3.74 3.73-1.28 1.28-3.73-3.74A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  );
}
