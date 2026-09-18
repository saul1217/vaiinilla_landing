import { Link } from 'react-router-dom';
import { productImageUrl } from '../lib/catalog-images';
import { formatAmount } from '../lib/money';
import type { CatalogProduct } from '../types/api';

export function MenuPeek({
  slug,
  products,
  headingId = 'menu-peek',
}: {
  slug: string;
  products: CatalogProduct[];
  headingId?: string;
}) {
  const menuHref = slug ? `/e/${slug}` : '/pedir';

  return (
    <aside className="alumno-cart-peek" aria-labelledby={headingId} data-peek-count={products.length}>
      <h2 className="alumno-section-label" id={headingId}>
        Del menú
      </h2>
      {products.length > 0 ? (
        <>
          <div className="alumno-cart-peek__items">
            {products.map((product) => {
              const thumb = productImageUrl(product.imagen_url);
              return (
                <Link className="alumno-cart-peek__row" key={product.id} to={menuHref}>
                  {thumb ? (
                    <img src={thumb} alt="" />
                  ) : (
                    <span className="alumno-cart-peek__vaini" aria-hidden="true">
                      <img src="/vaini/cutout-frente.png" alt="" />
                    </span>
                  )}
                  <span>
                    <strong>{product.nombre}</strong>
                    <p>{formatAmount(product.precio_digital)}</p>
                  </span>
                </Link>
              );
            })}
          </div>
          <Link className="alumno-link" to={menuHref}>
            Ver todo el menú
          </Link>
        </>
      ) : (
        <>
          <div className="alumno-cart-peek__art" aria-hidden="true">
            <img src="/vaini/scene-laptop.png" alt="" />
          </div>
          <p className="alumno-cart-peek__idle">
            Abre el menú y arma tu pedido. Las sugerencias y tus anteriores aparecen aquí.
          </p>
          <Link className="alumno-btn alumno-btn--lime" to={menuHref}>
            Ir al menú
          </Link>
        </>
      )}
    </aside>
  );
}
