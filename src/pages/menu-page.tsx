import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { defaultOptionIds, previewForProduct, validateSelections } from '../lib/cart';
import { productImageUrl } from '../lib/catalog-images';
import { enableGuestBuy, isGuestBuy } from '../lib/guest-explore';
import { initialsFrom } from '../lib/initials';
import { rememberPlace } from '../lib/last-place';
import { formatMoney } from '../lib/money';
import type { CatalogProduct, CatalogResponse, PublicEstablishment } from '../types/api';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { ProductSheet } from '../components/product-sheet';

export function MenuPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addLine, cart } = useCart();
  const canAddToCart = Boolean(user) || isGuestBuy();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [optionIds, setOptionIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.getEstablishment(slug), api.getGuestCatalog(slug)])
      .then(([nextPlace, nextCatalog]) => {
        if (!active) return;
        setPlace(nextPlace);
        setCatalog(nextCatalog);
        rememberPlace(nextPlace.slug);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
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
    const byCategory = categoryId == null ? list : list.filter((product) => product.categoria_id === categoryId);
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
  function addCurrentProduct({ keepOpen = false } = {}) {
    if (!selected || !place) return false;
    const invalid = validateSelections(selected, optionIds);
    if (invalid) {
      setError(invalid);
      return false;
    }
    addLine(place.slug, place.nombre, selected, optionIds, quantity);
    if (!keepOpen) setSelected(null);
    setError(null);
    return true;
  }

  function buyWithoutAccount() {
    enableGuestBuy();
    if (addCurrentProduct()) void navigate(`/e/${slug}/carrito`);
  }

  const preview = selected ? previewForProduct(selected, optionIds, quantity) : null;
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

  return (
    <AppShell tab="menu">
      <main id="main-content" className="alumno-main alumno-main--catalog">
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
                <h2>{product.nombre}</h2>
                <p>{formatMoney(product.precio_digital)}</p>
              </div>
            </button>
              );
            })}
        </div>
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
          onAdd={() => addCurrentProduct({ keepOpen: true })}
          onBuyWithoutAccount={buyWithoutAccount}
          onClosed={() => setSelected(null)}
        />
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
