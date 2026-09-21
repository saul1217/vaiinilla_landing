import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
  const [location, setLocation] = useState<{ latitud: number; longitud: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    enableGuestExplore();
  }, [ready]);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void api
        .listEstablishments(query, undefined, 50, location ?? undefined)
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
  }, [location, query]);

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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Tu navegador no permite ordenar por cercanía.');
      return;
    }
    setLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitud: Number(position.coords.latitude.toFixed(6)),
          longitud: Number(position.coords.longitude.toFixed(6)),
        });
        setLocationMessage('Mostrando lugares cercanos a ti.');
        setLocating(false);
      },
      () => {
        setLocationMessage('No compartiste tu ubicación. Puedes buscar por nombre.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
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
        <main id="main-content" className="alumno-main alumno-main--picker">
          <AlumnoPageHeader
            kicker="Lugar"
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
      <main id="main-content" className="alumno-main alumno-main--discover">
        <div className="alumno-deskhead">
          <AlumnoPageHeader
            kicker="Hoy"
            title="¿Dónde comes hoy?"
            lead="Elige tu establecimiento. El menú se puede ver sin iniciar sesión."
          />
          <div className="alumno-discovery-tools">
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
            <button className={location ? 'alumno-location-btn is-on' : 'alumno-location-btn'} type="button" onClick={useMyLocation} disabled={locating}>
              <LocationIcon />
              {locating ? 'Buscando lugares…' : location ? 'Cerca de mí' : 'Usar mi ubicación'}
            </button>
            {locationMessage ? <span className="alumno-location-note" role="status">{locationMessage}</span> : null}
          </div>
        </div>
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading ? <p role="status">Cargando establecimientos…</p> : null}
        <div className="alumno-discovery">
          <div className="alumno-discovery__list">
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
                      <span className="alumno-place-thumb" aria-hidden="true">
                        <PlaceImage src={place.imagen_url} alt="" />
                      </span>
                      <span className="alumno-radio__body">
                        <span className="alumno-place-kicker">
                          {location ? 'Cerca de ti' : isRecommended ? 'Recomendado para ti' : 'Establecimiento'}
                        </span>
                        <strong>{place.nombre}</strong>
                        <span className="alumno-radio__meta">
                          <span className="alumno-status-dot" aria-hidden="true" />
                          {access}
                        </span>
                      </span>
                      <span className="alumno-radio__arrow" aria-hidden="true">↗</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {selected ? (
            <section className="alumno-sticky-cafe" aria-label="Lugar activo">
              <div className="alumno-place-hero">
                <PlaceImage
                  src={selected.imagen_url}
                  alt={`${selected.nombre} en Vaiinilla`}
                />
                <span className="alumno-place-badge">Menú disponible</span>
              </div>
              <div className="alumno-sticky-cafe__content">
                <p>Tu próximo antojo</p>
                <strong>{selected.nombre}</strong>
                {selected.descripcion ? <span>{selected.descripcion}</span> : null}
                <div className="alumno-place-facts">
                  <span><span className="alumno-status-dot" aria-hidden="true" /> {selected.identificador_cliente_obligatorio ? `Pide ${selected.identificador_cliente_etiqueta.toLowerCase()}` : 'Acceso libre'}</span>
                  {selected.direccion ? <span>⌖ {selected.direccion}</span> : null}
                  {selected.horario ? <span>◷ {selected.horario}</span> : null}
                </div>
                {(selected.instagram_url || selected.facebook_url || selected.tiktok_url || selected.whatsapp_url || selected.sitio_web_url) ? (
                  <div className="alumno-place-socials" aria-label="Redes y enlaces del establecimiento">
                    {selected.instagram_url ? <SocialLink href={selected.instagram_url} label="Instagram" kind="instagram" /> : null}
                    {selected.facebook_url ? <SocialLink href={selected.facebook_url} label="Facebook" kind="facebook" /> : null}
                    {selected.tiktok_url ? <SocialLink href={selected.tiktok_url} label="TikTok" kind="tiktok" /> : null}
                    {selected.whatsapp_url ? <SocialLink href={selected.whatsapp_url} label="WhatsApp" kind="whatsapp" /> : null}
                    {selected.sitio_web_url ? <SocialLink href={selected.sitio_web_url} label="Sitio web" kind="website" /> : null}
                  </div>
                ) : null}
                <button className="alumno-btn alumno-btn--lime" type="button" onClick={openPicker}>
                  Entrar al menú
                </button>
              </div>
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

function PlaceImage({ src, alt }: { src?: string | null; alt: string }) {
  const [imageSrc, setImageSrc] = useState(src || '/vaini/cutout-frente.png');

  useEffect(() => {
    setImageSrc(src || '/vaini/cutout-frente.png');
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      onError={() => setImageSrc('/vaini/cutout-frente.png')}
    />
  );
}

type SocialKind = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'website';

function SocialLink({ href, label, kind }: { href: string; label: string; kind: SocialKind }) {
  return (
    <a
      className={`alumno-social-link alumno-social-link--${kind}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir ${label}`}
      title={label}
      style={{ '--social-color': socialColor(kind) } as CSSProperties}
    >
      <SocialIcon kind={kind} />
      <span className="sr-only">{label}</span>
    </a>
  );
}

function socialColor(kind: SocialKind) {
  return {
    instagram: '#E4405F',
    facebook: '#1877F2',
    tiktok: '#69C9D0',
    whatsapp: '#25D366',
    website: '#B4E04D',
  }[kind];
}

function SocialIcon({ kind }: { kind: SocialKind }) {
  if (kind === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>;
  }
  if (kind === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8h3V4h-3c-3.31 0-5 1.79-5 5v3H6v4h3v4h4v-4h3.2l.8-4H13V9c0-.67.33-1 1-1Z" /></svg>;
  }
  if (kind === 'tiktok') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.2 3h3.1c.28 1.74 1.25 2.83 2.7 3.2v3.13c-1.05-.02-2.02-.29-2.83-.77v6.25A6.18 6.18 0 1 1 11 8.67v3.24a2.94 2.94 0 1 0 2.94 2.9V3h.26Z" /></svg>;
  }
  if (kind === 'whatsapp') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a8.8 8.8 0 0 0-7.6 13.25L3 21l4.9-1.28A8.8 8.8 0 1 0 12 3Zm0 15.95a7.1 7.1 0 0 1-3.62-.99l-.26-.16-2.9.76.77-2.82-.17-.28A7.1 7.1 0 1 1 12 18.95Zm3.9-5.3c-.21-.1-1.24-.61-1.43-.68-.19-.07-.33-.1-.47.1-.14.2-.54.68-.66.82-.12.14-.24.15-.45.05-.21-.1-.87-.32-1.66-1.03-.61-.54-1.03-1.2-1.15-1.4-.12-.2-.01-.31.09-.41.09-.09.21-.24.31-.36.1-.12.14-.2.21-.34.07-.14.04-.26-.02-.36-.05-.1-.47-1.13-.65-1.55-.17-.4-.34-.35-.47-.36h-.4c-.14 0-.36.05-.55.26-.19.2-.72.7-.72 1.72s.74 2  .84 2.14c.1.14 1.46 2.23 3.54 3.13.49.21.87.34 1.17.44.49.16.94.14 1.3.08.4-.06 1.24-.51 1.41-1 .17-.5.17-.92.12-1.01-.05-.09-.19-.14-.4-.24Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.5 5.5h17v13h-17zM4 6l8 6 8-6" /></svg>;
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M12 21s7-6.14 7-12A7 7 0 0 0 5 9c0 5.86 7 12 7 12Z"
      />
      <circle cx="12" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
