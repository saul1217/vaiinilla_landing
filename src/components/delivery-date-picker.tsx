import { deliveryDayLabel } from '../lib/preorder';

/**
 * «¿Para qué día lo quieres?» de los encargos, como el selector de días de Android: solo los días
 * que el negocio puede entregar con los días de preparación del carrito y su hora de corte.
 */
export function DeliveryDatePicker({
  dates,
  selected,
  today,
  problem,
  onSelect,
}: {
  dates: string[];
  selected: string | null;
  today: string;
  problem: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="alumno-card alumno-delivery-date">
      <p id="delivery-date-title" className="alumno-home-delivery__kicker">¿Para qué día lo quieres?</p>
      {dates.length ? (
        <div className="alumno-delivery-date__days" role="radiogroup" aria-labelledby="delivery-date-title">
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={selected === date}
              data-date={date}
              className={`alumno-chip${selected === date ? ' is-on' : ''}`}
              onClick={() => onSelect(date)}
            >
              {deliveryDayLabel(date, today)}
            </button>
          ))}
        </div>
      ) : null}
      {problem ? <p className="alumno-muted alumno-home-delivery__problem">{problem}</p> : null}
    </div>
  );
}
