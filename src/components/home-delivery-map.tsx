import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { HomeDeliveryQuote } from '../types/api';
import { feeLabel, locationLabel, normalizeMoney, samePoint } from '../lib/home-delivery';
import { reverseAddress, searchAddress, type GeoPoint } from '../lib/geocoding';

const STREET_ZOOM = 17;
const AREA_ZOOM = 14;
/** Sin punto ni ubicación del negocio: todo México. */
const MEXICO: GeoPoint = { lat: 23.6345, lng: -102.5528 };
const SETTLE_MS = 700;

export interface MapPick {
  point: GeoPoint;
  address: string;
  quote: HomeDeliveryQuote;
}

/**
 * El mapa para elegir la entrega, como `HomeMapPicker` de Android: el pin se queda en el centro y se
 * mueve el mapa. Al detenerse se busca la calle del punto y se le pregunta al negocio si llega.
 * Cerrar sin confirmar deja la dirección como estaba. Leaflet se carga solo al abrirlo.
 */
export function HomeDeliveryMap({
  initial,
  fallbackCenter,
  radiusKm,
  onQuote,
  onConfirm,
  onClose,
}: {
  initial: GeoPoint | null;
  /** La zona del negocio (ficha pública), para no abrir en todo México. */
  fallbackCenter: GeoPoint | null;
  radiusKm: string | null;
  onQuote: (point: GeoPoint) => Promise<HomeDeliveryQuote>;
  onConfirm: (pick: MapPick) => void;
  onClose: () => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const settleTimer = useRef<number | null>(null);
  const requestId = useRef(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [chosen, setChosen] = useState(Boolean(initial));
  const [point, setPoint] = useState<GeoPoint | null>(initial);
  const [address, setAddress] = useState<string | null>(null);
  const [quote, setQuote] = useState<HomeDeliveryQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const onQuoteRef = useRef(onQuote);
  onQuoteRef.current = onQuote;
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const lastSettled = useRef<GeoPoint | null>(null);

  async function settle(next: GeoPoint) {
    if (!chosenRef.current || samePoint(next, lastSettled.current)) return;
    lastSettled.current = next;
    const id = ++requestId.current;
    setPoint(next);
    setAddress(null);
    setQuote(null);
    setNotice(null);
    setBusy(true);
    try {
      const [found, nextQuote] = await Promise.all([reverseAddress(next), onQuoteRef.current(next)]);
      if (id !== requestId.current) return;
      setAddress(found ?? locationLabel(next.lat, next.lng));
      setQuote(nextQuote);
    } catch {
      if (id !== requestId.current) return;
      lastSettled.current = null;
      setNotice('No pudimos calcular el envío. Mueve el mapa o intenta de nuevo.');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        if (disposed || !container.current) return;
        const start = initial ?? fallbackCenter ?? MEXICO;
        const zoom = initial ? STREET_ZOOM : fallbackCenter ? AREA_ZOOM : 5;
        const instance = L.map(container.current, { zoomControl: true, attributionControl: true }).setView(
          [start.lat, start.lng],
          zoom,
        );
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(instance);
        instance.on('movestart', () => {
          if (settleTimer.current) window.clearTimeout(settleTimer.current);
        });
        instance.on('moveend', () => {
          if (settleTimer.current) window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(() => {
            const center = instance.getCenter();
            void settleRef.current({ lat: center.lat, lng: center.lng });
          }, SETTLE_MS);
        });
        instance.on('dragstart', () => setChosen(true));
        map.current = instance;
        if (initial) void settleRef.current(initial);
      } catch {
        if (!disposed) setMapError('No pudimos cargar el mapa. Revisa tu conexión e intenta de nuevo.');
      }
    })();
    return () => {
      disposed = true;
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      map.current?.remove();
      map.current = null;
    };
    // Solo al montar: el mapa vive mientras el diálogo está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flyTo(next: GeoPoint) {
    setChosen(true);
    chosenRef.current = true;
    setNotice(null);
    if (map.current) map.current.flyTo([next.lat, next.lng], STREET_ZOOM, { duration: 0.7 });
    else void settle(next);
  }

  async function runSearch() {
    const text = search.trim();
    if (!text || searching) return;
    setSearching(true);
    setNotice(null);
    try {
      const found = await searchAddress(text);
      if (found) flyTo(found);
      else setNotice('No encontramos esa dirección. Agrega la colonia y la ciudad.');
    } catch {
      setNotice('No pudimos buscar la dirección. Mueve el mapa hasta tu casa.');
    } finally {
      setSearching(false);
    }
  }

  function goToMyLocation() {
    if (!('geolocation' in navigator)) {
      setNotice('No pudimos saber dónde estás. Busca tu calle.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => flyTo({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setNotice('Sin permiso de ubicación. Busca tu calle o mueve el mapa.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const reaches = quote?.llega === true;
  const fee = normalizeMoney(quote?.costo);
  const canConfirm = Boolean(point && address && quote && reaches && !busy);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-map-title"
      className="alumno-home-map"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <header className="alumno-home-map__head">
        <h2 id="home-map-title">¿Dónde te lo llevamos?</h2>
        <button type="button" className="alumno-paysheet__close" onClick={onClose} aria-label="Cerrar sin cambiar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <form
        className="alumno-home-map__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <input
          aria-label="Buscar dirección"
          value={search}
          maxLength={300}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Calle, número y colonia, o pega un enlace de Google Maps"
        />
        <button type="submit" className="alumno-btn alumno-btn--ghost" disabled={searching || !search.trim()}>
          {searching ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      <div className="alumno-home-map__canvas">
        <div ref={container} className="alumno-home-map__leaflet" data-testid="home-map" />
        <span className="alumno-home-map__pin" aria-hidden="true" />
        {!chosen ? <p className="alumno-home-map__hint">Mueve el mapa hasta tu casa o usa tu ubicación.</p> : null}
        {mapError ? <p className="alumno-error alumno-home-map__hint">{mapError}</p> : null}
      </div>
      <div className="alumno-home-map__foot">
        <button type="button" className="alumno-btn alumno-btn--ghost" onClick={goToMyLocation}>
          Usar mi ubicación
        </button>
        <p className="alumno-home-map__address" aria-live="polite">
          {busy ? 'Calculando el envío…' : address ?? (chosen ? '' : 'Aún no eliges dónde.')}
        </p>
        {quote && !busy ? (
          reaches ? (
            <p className="alumno-home-map__chips">
              <span className="alumno-chip alumno-chip--ok">
                {['Sí llegamos', quote.distancia_km ? `${quote.distancia_km} km` : null].filter(Boolean).join(' · ')}
              </span>
              {fee ? <span className="alumno-chip">{feeLabel(fee)}</span> : null}
            </p>
          ) : (
            <p className="alumno-error">
              {radiusKm ? `Fuera de la zona de entrega (hasta ${radiusKm} km).` : 'Fuera de la zona de entrega.'}
            </p>
          )
        ) : null}
        {notice ? <p className="alumno-error">{notice}</p> : null}
        <button
          type="button"
          className="alumno-btn alumno-btn--lime"
          disabled={!canConfirm}
          onClick={() => {
            if (point && address && quote) onConfirm({ point, address, quote });
          }}
        >
          Entregar aquí
        </button>
      </div>
    </section>
  );
}
