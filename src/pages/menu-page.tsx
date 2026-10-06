import { useEffect, useMemo, useState } from 'react';
import { GuestOrdersBanner } from '../components/guest-orders-banner';
import { Link, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { defaultOptionIds, previewForProduct, validateSelections } from '../lib/cart';
import { productImageUrl } from '../lib/catalog-images';
import { sortProductsForTodo } from '../lib/catalog-order';
import { initialsFrom } from '../lib/initials';
import { rememberPlace } from '../lib/last-place';
import { formatAmount } from '../lib/money';
import { piecesLabel, splitPieces } from '../lib/product-pieces';
import { NotFoundPage } from './not-found-page';
import type { CatalogProduct, CatalogResponse, PublicEstablishment } from '../types/api';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { MotionSheet } from '../components/motion-sheet';
import { ProductSheet } from '../components/product-sheet';
import { SeatedToast } from '../components/seated-toast';
import { peekResource, resourceKeys } from '../lib/resource-cache';

export function MenuPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { addLine, cart } = useCart();
  // Lo ya cargado se ve al instante; la carga de abajo lo actualiza en segundo plano.
  const [place, setPlace] = useState<PublicEstablishment | null>(() => peekResource(resourceKeys.establishment(slug)) ?? null);
  // Compra sin cuenta: cualquiera agrega al carrito, salvo donde se pide con matrícula.
  const canAddToCart = Boolean(user) || place?.identificador_cliente_obligatorio !== true;
  const [catalog, setCatalog] = useState<CatalogResponse | null>(() => peekResource(resourceKeys.catalog(slug)) ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [optionIds, setOptionIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(() => !peekResource(resourceKeys.catalog(slug)));
  const [rentsCourts, setRentsCourts] = useState(false);
  // Cambio de tienda con carrito ajeno: se confirma antes de vaciarlo.
  const [switchCart, setSwitchCart] = useState<{ count: number; from: string } | null>(null);
  const [pendingAdd, setPendingAdd] = useState<{
    product: CatalogProduct;
    optionIds: number[];
    quantity: number;
    notes?: string;
  } | null>(null);

  // "Rentar cancha" solo se ofrece si el negocio tiene al menos una cancha con precio por hora.
  useEffect(() => {
    let active = true;
    setRentsCourts(false);
    void api
      .getPublicSpaces(slug)
      .then((spaces) => {
        if (active) setRentsCourts(spaces.some((item) => item.espacio?.tipo === 'cancha' && Boolean(item.precio_hora)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    if (!peekResource(resourceKeys.catalog(slug))) setLoading(true);
    Promise.all([api.getEstablishment(slug), api.getGuestCatalog(slug)])
      .then(([nextPlace, nextCatalog]) => {
        if (!active) return;
        setPlace(nextPlace);
        setCatalog(nextCatalog);
        rememberPlace(nextPlace.slug);
        setMissing(false);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof VaiinillaApiError && cause.status === 404) {
          setMissing(true);
          return;
        }
        setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const products = useMemo(() => {
    const list = catalog?.productos ?? [];
    const categories = catalog?.categorias ?? [];
    const byCategory =
      categoryId == null
        ? sortProductsForTodo(list, categories)
        : list.filter((product) => product.categoria_id === categoryId);
    const needle = query.trim().toLowerCase();
    if (!needle) return byCategory;
    return byCategory.filter((product) => {
      const haystack = [product.nombre, product.descripcion, product.ingredientes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [catalog, categoryId, query]);

  const selectedThumb = productImageUrl(selected?.imagen_url);

  function openProduct(product: CatalogProduct) {
    if (!product.disponible) return;
    setSelected(product);
    setOptionIds(defaultOptionIds(product));
    setQuantity(1);
    setError(null);
  }

  function toggleOption(groupId: number, optionId: number, max: number) {
    setOptionIds((current) => {
      const group = selected?.grupos_opcion.find((item) => item.id === groupId);
      if (!group) return current;
      const groupIds = new Set(group.opciones.map((option) => option.id));
      const withoutGroup = current.filter((id) => !groupIds.has(id));
      if (max === 1) return [...withoutGroup, optionId];
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      return [...withoutGroup, optionId];
    });
  }

  function clearOptionGroup(groupId: number) {
    const group = selected?.grupos_opcion.find((item) => item.id === groupId);
    if (!group) return;
    const groupIds = new Set(group.opciones.map((option) => option.id));
    setOptionIds((current) => current.filter((id) => !groupIds.has(id)));
  }

  // keepOpen lets the sheet animate out itself instead of vanishing on unmount.
  function addCurrentProduct({ keepOpen = false, notes = '' }: { keepOpen?: boolean; notes?: string } = {}) {
    if (!selected || !place) return false;
    const invalid = validateSelections(selected, optionIds);
    if (invalid) {
      setError(invalid);
      return false;
    }
    // El carrito es de una sola tienda: agregar en otra lo vacía, y eso se confirma.
    if (cart && cart.slug !== slug && cart.lines.length > 0) {
      setPendingAdd({ product: selected, optionIds, quantity, notes });
      setSwitchCart({
        count: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
        from: cart.establishmentName,
      });
      if (!keepOpen) setSelected(null);
      setError(null);
      return false;
    }
    addLine(place.slug, place.nombre, selected, optionIds, quantity, notes);
    if (!keepOpen) setSelected(null);
    setError(null);
    return true;
  }

  const preview = selected ? previewForProduct(selected, optionIds, quantity) : null;

  function confirmSwitchCart(close: () => void) {
    if (pendingAdd && place) {
      addLine(place.slug, place.nombre, pendingAdd.product, pendingAdd.optionIds, pendingAdd.quantity, pendingAdd.notes);
    }
    setPendingAdd(null);
    setSwitchCart(null);
    close();
  }
  const cartCount = cart?.slug === slug ? cart.lines.reduce((sum, line) => sum + line.quantity, 0) : 0;
  const menuActions = () => (
    <>
      <Link className="alumno-icon-btn" to={`/e/${slug}/carrito`} aria-label="Carrito">
        <CartIcon />
        {cartCount > 0 ? <span className="alumno-badge">{cartCount}</span> : null}
      </Link>
      <Link className="alumno-avatar" to="/cuenta" aria-label="Cuenta">
        {initialsFrom(user?.displayName, user?.email)}
      </Link>
    </>
  );

  if (missing) {
    return (
      <NotFoundPage
        title="No encontramos este lugar"
        lead="Revisa el enlace o elige otro lugar para pedir."
        cta={{ to: '/pedir', label: 'Elegir lugar' }}
      />
    );
  }

  const searching = query.trim() !== '';

  return (
    <AppShell tab="menu">
      <SeatedToast />
      <main id="main-content" className="alumno-main alumno-main--catalog">
        {/* Los vivos viven en su tab Pedidos; aquí solo un atajo compacto para no empujar el menú. */}
        <GuestOrdersBanner slug={slug} />
        <div className="alumno-deskhead">
          <AlumnoPageHeader
            kicker="Menú de hoy"
            title={place?.nombre ?? 'Menú'}
            actions={menuActions()}
          />
          <div className="alumno-deskhead__utility">
            <div className="alumno-top__actions">{menuActions()}</div>
            <div className="alumno-search-wrap">
              <SearchIcon />
              <label className="sr-only" htmlFor="search-menu">
                Buscar en el menú
              </label>
              <input
                id="search-menu"
                className="alumno-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        {error && !selected ? <p className="alumno-error">{error}</p> : null}
        {rentsCourts ? (
          <Link className="alumno-courts-entry" to={`/e/${slug}/canchas`}>
            <span>
              <strong>Rentar una cancha</strong>
              <small>Elige día y hora. Se paga al apartar.</small>
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14m-5-5 5 5-5 5" />
            </svg>
          </Link>
        ) : null}
        {loading ? <LoadingSkeleton shape="products" label="Cargando menú…" /> : null}
        <div className="alumno-chips">
          <button className={categoryId == null ? 'alumno-chip is-on' : 'alumno-chip'} type="button" onClick={() => setCategoryId(null)}>
            Todo
          </button>
          {catalog?.categorias
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((category) => (
              <button
                key={category.id}
                className={categoryId === category.id ? 'alumno-chip is-on' : 'alumno-chip'}
                type="button"
                onClick={() => setCategoryId(category.id)}
              >
                {category.nombre}
              </button>
            ))}
        </div>
        <div className="alumno-grid alumno-arrive">
            {products.map((product) => {
              const thumb = productImageUrl(product.imagen_url);
              const label = splitPieces(product.nombre);
              return (
            <button
              key={product.id}
              type="button"
              className={product.disponible ? 'alumno-product' : 'alumno-product is-off'}
              onClick={() => openProduct(product)}
            >
              {thumb ? (
                <img src={thumb} alt="" width="160" height="112" />
              ) : (
                <span className="alumno-product__ph alumno-product__ph--vaini" aria-hidden="true">
                  <img src="/vaini/cutout-frente.png" alt="" />
                </span>
              )}
              <div>
                <h2>{label.name}</h2>
                <p>
                  {formatAmount(product.precio_digital)}
                  {label.pieces ? <span className="alumno-pieces"> · {piecesLabel(label.pieces)}</span> : null}
                </p>
              </div>
            </button>
              );
            })}
        </div>
        {catalog && searching && products.length === 0 ? (
          <div className="alumno-empty alumno-arrive" role="status">
            <img src="/vaini/cutout-frente.png" alt="" />
            <h2>No encontramos “{query.trim()}” en el menú</h2>
            <button className="alumno-btn alumno-btn--lime" type="button" onClick={() => setQuery('')}>
              Limpiar búsqueda
            </button>
          </div>
        ) : null}
      </main>
      {selected ? (
        <ProductSheet
          product={selected}
          placeName={place?.nombre ?? null}
          photoUrl={selectedThumb}
          optionIds={optionIds}
          quantity={quantity}
          lineTotal={preview?.line ?? null}
          error={error}
          canAddToCart={canAddToCart}
          loginHref={`/cuenta?next=/e/${slug}`}
          onToggleOption={toggleOption}
          onClearGroup={clearOptionGroup}
          onQuantityChange={(delta) => setQuantity((value) => Math.min(20, Math.max(1, value + delta)))}
          onAdd={(notes) => addCurrentProduct({ keepOpen: true, notes })}
          onClosed={() => setSelected(null)}
        />
      ) : null}
      {switchCart ? (
        <MotionSheet
          className="alumno-sheet alumno-codesheet"
          labelledBy="switch-title"
          onClosed={() => {
            setSwitchCart(null);
            setPendingAdd(null);
          }}
        >
          {(close, dragHandle) => (
            <div className="alumno-codesheet__panel">
              <div className="alumno-codesheet__grab" {...dragHandle}>
                <span aria-hidden="true" />
              </div>
              <h2 id="switch-title">¿Cambiar de tienda?</h2>
              <p className="alumno-muted">
                Tienes {switchCart.count === 1 ? '1 producto' : `${switchCart.count} productos`} de{' '}
                {switchCart.from} en tu carrito. Si agregas aquí, ese carrito se vacía.
              </p>
              <div className="alumno-tracking__actions">
                <button
                  className="alumno-btn alumno-btn--lime"
                  type="button"
                  onClick={() => confirmSwitchCart(close)}
                >
                  Vaciar y agregar aquí
                </button>
                <button className="alumno-btn" type="button" onClick={close}>
                  Conservar mi carrito
                </button>
              </div>
            </div>
          )}
        </MotionSheet>
      ) : null}
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

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 6V5a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 .98 1.2l-1.5 8A2 2 0 0 1 16.7 17H8.3a2 2 0 0 1-1.97-1.8l-1.5-8A1 1 0 0 1 5.8 6H7Zm2 0h6V5a3 3 0 0 0-6 0v1Z"
      />
    </svg>
  );
}
