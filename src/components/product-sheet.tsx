// Product detail sheet with the same anatomy as Android's ProductDetailSheet:
// photo hero with round actions and price chip, meta cards, option tiles and a
// bottom dock with the selection summary, quantity and the add button.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/money';
import type { CatalogProduct } from '../types/api';
import { MotionSheet } from './motion-sheet';

export interface ProductSheetProps {
  product: CatalogProduct;
  placeName: string | null;
  photoUrl: string | null;
  optionIds: number[];
  quantity: number;
  lineTotal: string | null;
  error: string | null;
  canAddToCart: boolean;
  loginHref: string;
  onToggleOption: (groupId: number, optionId: number, max: number) => void;
  onClearGroup: (groupId: number) => void;
  onQuantityChange: (delta: number) => void;
  onAdd: () => boolean;
  onBuyWithoutAccount: () => void;
  onClosed: () => void;
}

export function ProductSheet(props: ProductSheetProps) {
  const { product, photoUrl, optionIds, quantity, lineTotal, error, canAddToCart } = props;
  const [photoReady, setPhotoReady] = useState(false);
  const selectedNames = product.grupos_opcion
    .flatMap((group) => group.opciones)
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.nombre);
  const customized = product.grupos_opcion.some((group) =>
    group.opciones.some((option) => option.precio_extra !== '0.00' && optionIds.includes(option.id)),
  );
  const price = lineTotal ? formatMoney(lineTotal) : '';

  return (
    <MotionSheet className="alumno-sheet alumno-psheet" labelledBy="product-detail" onClosed={props.onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-psheet__panel">
          <div className="alumno-psheet__scroll">
            <div className="alumno-psheet__hero" {...dragHandle}>
              <span className="alumno-psheet__grabber" aria-hidden="true" />
              {photoUrl ? (
                <img
                  className={photoReady ? 'alumno-psheet__photo is-ready' : 'alumno-psheet__photo'}
                  src={photoUrl}
                  alt=""
                  onLoad={() => setPhotoReady(true)}
                />
              ) : null}
              {!photoUrl || !photoReady ? (
                <img className="alumno-psheet__vaini" src="/vaini/cutout-frente.png" alt="" aria-hidden="true" />
              ) : null}
              <button className="alumno-psheet__action alumno-psheet__action--back" type="button" onClick={close} aria-label="Volver">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="alumno-psheet__action alumno-psheet__action--close" type="button" onClick={close} aria-label="Cerrar">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
              {customized ? <span className="alumno-psheet__tag">Personalizado</span> : null}
              <span className="alumno-psheet__price" aria-hidden="true">
                <span key={price} className="alumno-ticker">{price}</span>
              </span>
            </div>

            <div className="alumno-psheet__body">
              {props.placeName ? <p className="alumno-psheet__eyebrow">{props.placeName}</p> : null}
              <h2 id="product-detail" className="alumno-psheet__title">
                {product.nombre}
              </h2>
              {product.descripcion ? <p className="alumno-psheet__lead">{product.descripcion}</p> : null}

              <div className="alumno-psheet__meta">
                <MetaCard icon="leaf" label="Ingredientes" value={product.ingredientes || 'Consulta en cafetería'} />
                <MetaCard icon="clock" label="Tiempo estimado" value={`${product.tiempo_estimado_min} min`} />
                {product.alergenos && !/^sin /i.test(product.alergenos) ? (
                  <MetaCard icon="warning" label="Alérgenos" value={product.alergenos} wide />
                ) : null}
              </div>

              {product.grupos_opcion.map((group) => {
                const single = group.max_selecciones === 1;
                const noneSelected = group.opciones.every((option) => !optionIds.includes(option.id));
                return (
                  <fieldset className="alumno-psheet__group" key={group.id}>
                    <legend>
                      <span>{group.nombre}</span>
                      <span className="alumno-psheet__need">{group.min_selecciones > 0 ? 'Obligatorio' : 'Opcional'}</span>
                    </legend>
                    <div className="alumno-psheet__tiles">
                      {group.min_selecciones === 0 ? (
                        <OptionTile
                          type={single ? 'radio' : 'checkbox'}
                          name={`group-${group.id}`}
                          label="Sin extra"
                          checked={noneSelected}
                          onChange={() => props.onClearGroup(group.id)}
                        />
                      ) : null}
                      {group.opciones.map((option) => (
                        <OptionTile
                          key={option.id}
                          type={single ? 'radio' : 'checkbox'}
                          name={`group-${group.id}`}
                          label={option.precio_extra === '0.00' ? option.nombre : `${option.nombre} +${formatMoney(option.precio_extra)}`}
                          checked={optionIds.includes(option.id)}
                          onChange={() => props.onToggleOption(group.id, option.id, group.max_selecciones)}
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>

          <div className="alumno-psheet__dock">
            <div className="alumno-psheet__summary">
              <div>
                <p className="alumno-psheet__summary-label">{customized ? 'Tu personalización' : 'Tu selección'}</p>
                <p className="alumno-psheet__summary-value">{selectedNames.join(' · ') || 'Sin opciones adicionales'}</p>
              </div>
              <div className="alumno-psheet__qty">
                <button type="button" onClick={() => props.onQuantityChange(-1)} aria-label="Menos" disabled={quantity <= 1}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
                <span key={quantity} className="alumno-ticker" aria-live="polite">{quantity}</span>
                <button type="button" onClick={() => props.onQuantityChange(1)} aria-label="Más" disabled={quantity >= 20}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
            {canAddToCart ? (
              <button
                className="alumno-psheet__add"
                type="button"
                onClick={() => {
                  if (props.onAdd()) close();
                }}
              >
                Agregar · <span key={price} className="alumno-ticker">{price}</span>
              </button>
            ) : (
              <>
                <Link className="alumno-psheet__add" to={props.loginHref}>
                  Iniciar sesión para comprar
                </Link>
                <button className="alumno-link alumno-psheet__guest" type="button" onClick={props.onBuyWithoutAccount}>
                  Comprar sin cuenta
                </button>
              </>
            )}
            {error ? <p className="alumno-psheet__error" role="alert">{error}</p> : null}
          </div>
        </div>
      )}
    </MotionSheet>
  );
}

function OptionTile({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={checked ? 'alumno-psheet__tile is-on' : 'alumno-psheet__tile'}>
      <input className="alumno-sr-only" type={type} name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
      <span className="alumno-psheet__check" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </label>
  );
}

const META_ICONS = {
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14m0 0 7-7',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warning: 'M12 9v4m0 3.5v.5M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
} as const;

function MetaCard({ icon, label, value, wide = false }: { icon: keyof typeof META_ICONS; label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'alumno-psheet__metacard is-wide' : 'alumno-psheet__metacard'}>
      <span className="alumno-psheet__metaicon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={META_ICONS[icon]} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}
