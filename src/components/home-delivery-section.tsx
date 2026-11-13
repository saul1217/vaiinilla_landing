import { useState } from 'react';
import type { HomeDeliveryQuote } from '../types/api';
import {
  areaOf,
  feeLabel,
  joinStreet,
  phoneProblem,
  streetOf,
  type HomeAddressDraft,
  type HomeDeliveryOffer,
} from '../lib/home-delivery';

/**
 * «Te lo llevan a» del carrito, como `HomeDeliverySection` de Android: la dirección que salió del
 * mapa, si llega y cuánto cuesta, la calle (si el mapa no la encontró), la referencia y el teléfono.
 */
export function HomeDeliverySection({
  draft,
  pickedAddress,
  quote,
  fee,
  offer,
  problem,
  onDraftChange,
  onOpenMap,
}: {
  draft: HomeAddressDraft;
  /** La dirección tal como la dio el mapa: de ahí sale la colonia si la persona escribe la calle. */
  pickedAddress: string;
  quote: HomeDeliveryQuote | null;
  fee: string;
  offer: HomeDeliveryOffer;
  problem: string | null;
  onDraftChange: (draft: HomeAddressDraft) => void;
  onOpenMap: () => void;
}) {
  const [typedStreet, setTypedStreet] = useState('');
  const hasPoint = draft.lat != null && draft.lng != null;
  // El mapa solo dio la colonia o el punto: la calle y el número se escriben aparte.
  const asksStreet = hasPoint && !streetOf(pickedAddress);
  const phoneError = draft.phone.trim() ? phoneProblem(draft.phone) : null;
  return (
    <div className="alumno-card alumno-home-delivery" aria-labelledby="home-delivery-title">
      <p id="home-delivery-title" className="alumno-home-delivery__kicker">Te lo llevan a</p>
      <p className={draft.address ? 'alumno-home-delivery__address' : 'alumno-muted'}>
        {draft.address || 'Aún no eliges dónde. Abre el mapa.'}
      </p>
      {quote ? (
        quote.llega ? (
          <p className="alumno-home-map__chips">
            <span className="alumno-chip alumno-chip--ok">
              {['Sí llegamos', quote.distancia_km ? `${quote.distancia_km} km` : null].filter(Boolean).join(' · ')}
            </span>
            <span className="alumno-chip">{feeLabel(fee)}</span>
          </p>
        ) : (
          <p className="alumno-error">
            {offer.radiusKm ? `Fuera de la zona de entrega (hasta ${offer.radiusKm} km).` : 'Fuera de la zona de entrega.'}
          </p>
        )
      ) : (
        <p className="alumno-muted">{feeLabel(fee)}{offer.minimum ? ` · mínimo ${offer.minimum.replace(/\.00$/, '')}` : ''}</p>
      )}
      <button type="button" className="alumno-btn alumno-btn--ghost" onClick={onOpenMap}>
        {hasPoint ? 'Cambiar en el mapa' : 'Elegir en el mapa'}
      </button>
      {asksStreet ? (
        <label className="alumno-field">
          <span>Calle y número</span>
          <input
            value={typedStreet}
            maxLength={120}
            autoComplete="address-line1"
            placeholder="Ej. Aldama 1408"
            onChange={(event) => {
              setTypedStreet(event.target.value);
              onDraftChange({ ...draft, address: joinStreet(event.target.value, areaOf(pickedAddress)) });
            }}
          />
        </label>
      ) : null}
      <label className="alumno-field">
        <span>Referencia (opcional)</span>
        <input
          value={draft.reference}
          maxLength={200}
          placeholder="Portón negro, entre calles…"
          onChange={(event) => onDraftChange({ ...draft, reference: event.target.value })}
        />
      </label>
      <label className="alumno-field">
        <span>Teléfono</span>
        <input
          value={draft.phone}
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="10 dígitos"
          aria-invalid={phoneError ? true : undefined}
          onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
        />
      </label>
      {phoneError ? <p className="alumno-error">{phoneError}</p> : null}
      {problem && problem !== phoneError ? <p className="alumno-muted alumno-home-delivery__problem">{problem}</p> : null}
    </div>
  );
}
