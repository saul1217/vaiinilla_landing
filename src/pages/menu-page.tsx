import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { defaultOptionIds, previewForProduct, validateSelections } from '../lib/cart';
import { rememberPlace } from '../lib/last-place';
import { formatMoney } from '../lib/money';
import type { CatalogProduct, CatalogResponse, PublicEstablishment } from '../types/api';

export function MenuPage() {
  const { slug = '' } = useParams();
  const { addLine, cart } = useCart();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [optionIds, setOptionIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    if (categoryId == null) return list;
    return list.filter((product) => product.categoria_id === categoryId);
  }, [catalog, categoryId]);

  function openProduct(product: CatalogProduct) {
    setSelected(product);
    setOptionIds(defaultOptionIds(product));
    setQuantity(1);
    setNotice(null);
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

  function addToCart() {
    if (!selected || !place) return;
    const invalid = validateSelections(selected, optionIds);
    if (invalid) {
      setError(invalid);
      return;
    }
    addLine(place.slug, place.nombre, selected, optionIds, quantity);
    setNotice(`${selected.nombre} se agregó al carrito.`);
    setSelected(null);
    setError(null);
  }

  const preview = selected ? previewForProduct(selected, optionIds, quantity) : null;
  const cartCount = cart?.slug === slug ? cart.lines.reduce((sum, line) => sum + line.quantity, 0) : 0;

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">Menú</p>
          <h1>{place?.nombre ?? 'Cafetería'}</h1>
          <p className="app-lead">Consulta disponibilidad y arma tu pedido para llevar.</p>
          {error ? <p className="feedback">{error}</p> : null}
          {notice ? <p className="feedback feedback--ok">{notice}</p> : null}
          {loading ? <p role="status">Cargando menú…</p> : null}
          <div className="chip-row">
            <button className={categoryId == null ? 'chip is-on' : 'chip'} type="button" onClick={() => setCategoryId(null)}>
              Todo
            </button>
            {catalog?.categorias
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((category) => (
                <button
                  key={category.id}
                  className={categoryId === category.id ? 'chip is-on' : 'chip'}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.nombre}
                </button>
              ))}
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <article className={product.disponible ? 'menu-card' : 'menu-card unavailable'} key={product.id}>
                {product.imagen_url ? (
                  <img src={product.imagen_url} alt="" width="320" height="160" />
                ) : null}
                <h3>{product.nombre}</h3>
                <p>{product.descripcion}</p>
                <div className="menu-card__meta">
                  <span>{formatMoney(product.precio_digital)}</span>
                  <span>{product.disponible ? `${product.tiempo_estimado_min} min` : 'No disponible'}</span>
                </div>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={!product.disponible}
                  onClick={() => openProduct(product)}
                >
                  Agregar
                </button>
              </article>
            ))}
          </div>
          {selected ? (
            <section className="panel-card" style={{ marginTop: 28 }} aria-labelledby="product-detail">
              <h2 id="product-detail">{selected.nombre}</h2>
              <p>{selected.descripcion}</p>
              {selected.ingredientes ? <p>Ingredientes: {selected.ingredientes}</p> : null}
              {selected.alergenos ? <p>Alérgenos: {selected.alergenos}</p> : null}
              {selected.grupos_opcion.map((group) => (
                <fieldset className="options" key={group.id}>
                  <legend>
                    {group.nombre} ({group.min_selecciones}-{group.max_selecciones})
                  </legend>
                  {group.opciones.map((option) => (
                    <label key={option.id}>
                      <input
                        type={group.max_selecciones === 1 ? 'radio' : 'checkbox'}
                        name={`group-${group.id}`}
                        checked={optionIds.includes(option.id)}
                        onChange={() => toggleOption(group.id, option.id, group.max_selecciones)}
                      />
                      {option.nombre} {option.precio_extra !== '0.00' ? `+ ${formatMoney(option.precio_extra)}` : ''}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div className="qty">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Menos">
                  −
                </button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Más">
                  +
                </button>
                <strong>{preview ? formatMoney(preview.line) : ''}</strong>
              </div>
              <div className="hero__actions" style={{ marginTop: 18 }}>
                <button className="btn btn--primary" type="button" onClick={addToCart}>
                  Agregar al carrito
                </button>
                <button className="btn btn--ghost" type="button" onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>
            </section>
          ) : null}
          {cartCount > 0 ? (
            <p style={{ marginTop: 28 }}>
              <Link className="btn btn--dark" to={`/e/${slug}/carrito`}>
                Ver carrito ({cartCount})
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </PageShell>
  );
}
