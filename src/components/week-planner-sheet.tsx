import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import {
  closedReason,
  dayShortLabel,
  firstName,
  plannerDates,
  plannerProductIds,
  scheduledOrderPolicyText,
  type ChildMenuCalendar,
  type Dependent,
  type ScheduledDayOrder,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { formatAmount } from '../lib/money';
import type { CatalogProduct, CatalogResponse } from '../types/api';
import { ParentSheet } from './parent-sheet';

type Plan = Record<string, Record<number, number>>;
type Choices = Record<string, Record<number, number[]>>;

const cents = (value: string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/** Lo que no se le puede vender: bloqueado por su tutor o con uno de sus alérgenos. */
function blockedForChild(product: CatalogProduct, child: Dependent): boolean {
  const controls = child.controls;
  if (!controls) return false;
  if (controls.blockedProductIds.includes(product.id) || controls.blockedCategoryIds.includes(product.categoria_id)) return true;
  const productAllergens = (product.alergenos ?? '').toLowerCase();
  return controls.allergens.some((code) => productAllergens.includes(code));
}

function defaultOptions(product: CatalogProduct): number[] {
  return product.grupos_opcion.flatMap((group) => group.opciones.slice(0, group.min_selecciones).map((option) => option.id));
}

function optionsProblem(product: CatalogProduct, picked: number[]): string | null {
  for (const group of product.grupos_opcion) {
    const count = group.opciones.filter((option) => picked.includes(option.id)).length;
    if (count < group.min_selecciones) return `Elige ${group.min_selecciones} en ${group.nombre}.`;
    if (group.max_selecciones > 0 && count > group.max_selecciones) return `Máximo ${group.max_selecciones} en ${group.nombre}.`;
  }
  return null;
}

/**
 * Apartar la comida de varios días (Expo `WeekPlannerSheet`): el menú de cada día, los días sin servicio, lo que
 * no se le vende y las opciones obligatorias de cada platillo. Se descuenta de su saldo al confirmar.
 */
export function WeekPlannerSheet({
  child,
  placeSlug,
  loadCalendar,
  reserve,
  onReserved,
  onClosed,
}: {
  child: Dependent;
  placeSlug: string | null;
  loadCalendar: () => Promise<ChildMenuCalendar>;
  reserve: (days: ScheduledDayOrder[], idempotencyKey: string) => Promise<number>;
  onReserved: (count: number) => void;
  onClosed: () => void;
}) {
  const first = firstName(child.name);
  const [calendar, setCalendar] = useState<ChildMenuCalendar | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>({});
  const [choices, setChoices] = useState<Choices>({});
  const [choosing, setChoosing] = useState<{ product: CatalogProduct; picked: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El mismo plan reintentado reusa su llave; cambiar algo del plan abre un intento nuevo.
  const [key, setKey] = useState(createIdempotencyKey);

  useEffect(() => {
    let active = true;
    Promise.all([loadCalendar(), placeSlug ? api.getGuestCatalog(placeSlug) : Promise.reject(new Error('Sin escuela'))])
      .then(([nextCalendar, nextCatalog]) => {
        if (!active) return;
        setCalendar(nextCalendar);
        setCatalog(nextCatalog);
        setSelected(plannerDates(nextCalendar)[0] ?? null);
        setSlot(nextCalendar.schedule.slots[0] ?? null);
      })
      .catch((cause) => {
        if (active) setLoadError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
    // Se carga una vez al abrir la hoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dates = useMemo(() => (calendar ? plannerDates(calendar) : []), [calendar]);
  const products = useMemo(() => {
    if (!calendar || !catalog || !selected) return [];
    const allowed = plannerProductIds(calendar, selected);
    return catalog.productos.filter((product) => product.disponible && (!allowed || allowed.has(product.id)));
  }, [calendar, catalog, selected]);

  const extras = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of catalog?.productos ?? []) {
      for (const group of product.grupos_opcion) for (const option of group.opciones) map.set(option.id, cents(option.precio_extra));
    }
    return map;
  }, [catalog]);

  const totalCents = useMemo(() => {
    const byId = new Map((catalog?.productos ?? []).map((product) => [product.id, product]));
    let total = 0;
    for (const [date, items] of Object.entries(plan)) {
      for (const [id, quantity] of Object.entries(items)) {
        const product = byId.get(Number(id));
        if (!product || quantity <= 0) continue;
        const optionExtra = (choices[date]?.[product.id] ?? []).reduce((sum, optionId) => sum + (extras.get(optionId) ?? 0), 0);
        total += (cents(product.precio_digital) + optionExtra) * quantity;
      }
    }
    return total;
  }, [catalog, choices, extras, plan]);

  const orders: ScheduledDayOrder[] = Object.keys(plan)
    .sort()
    .flatMap((date) => {
      const items = Object.entries(plan[date] ?? {})
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({ productId: Number(id), quantity, optionIds: [...(choices[date]?.[Number(id)] ?? [])] }));
      return items.length > 0 ? [{ date, slot, items }] : [];
    });

  const change = (date: string, product: CatalogProduct, delta: number, picked?: number[]) => {
    setKey(createIdempotencyKey());
    setError(null);
    setPlan((current) => {
      const day = { ...(current[date] ?? {}) };
      day[product.id] = Math.max(0, (day[product.id] ?? 0) + delta);
      return { ...current, [date]: day };
    });
    if (picked) setChoices((current) => ({ ...current, [date]: { ...(current[date] ?? {}), [product.id]: picked } }));
  };

  const add = (product: CatalogProduct) => {
    if (!selected) return;
    const already = plan[selected]?.[product.id] ?? 0;
    if (product.grupos_opcion.length > 0 && already === 0) {
      setChoosing({ product, picked: choices[selected]?.[product.id] ?? defaultOptions(product) });
      return;
    }
    change(selected, product, 1);
  };

  const submit = async (close: () => void) => {
    if (busy || orders.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const count = await reserve(orders, key);
      onReserved(count);
      close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const today = calendar?.schedule.today ?? '';
  const closed = calendar && selected ? closedReason(calendar, selected) : null;

  return (
    <ParentSheet
      id="week-planner-title"
      title={`Apartar comida de ${first}`}
      lead={calendar ? scheduledOrderPolicyText(calendar.schedule.cancelCutoff) : undefined}
      onClosed={onClosed}
    >
      {(close) => (
        <div className="parent-sheet__body">
          {loadError ? (
            <p className="alumno-error" role="alert">
              {loadError}
            </p>
          ) : null}
          {!calendar && !loadError ? (
            <p className="alumno-muted" role="status">
              Cargando el menú de la escuela…
            </p>
          ) : null}
          {calendar && dates.length === 0 ? <p className="alumno-muted">No hay días para apartar por ahora.</p> : null}
          {calendar && dates.length > 0 ? (
            <>
              <div className="alumno-chips parent-sheet__days" role="tablist" aria-label="Día">
                {dates.map((date) => {
                  const count = Object.values(plan[date] ?? {}).reduce((sum, quantity) => sum + quantity, 0);
                  return (
                    <button
                      key={date}
                      type="button"
                      role="tab"
                      aria-selected={selected === date}
                      className={`alumno-chip${selected === date ? ' is-on' : ''}`}
                      onClick={() => setSelected(date)}
                    >
                      {dayShortLabel(date, today)}
                      {count > 0 ? ` · ${count}` : ''}
                    </button>
                  );
                })}
              </div>
              {calendar.schedule.slots.length > 1 ? (
                <div className="alumno-chips parent-sheet__wrap" role="radiogroup" aria-label="Hora de entrega">
                  {calendar.schedule.slots.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={slot === value}
                      className={`alumno-chip${slot === value ? ' is-on' : ''}`}
                      onClick={() => {
                        setSlot(value);
                        setKey(createIdempotencyKey());
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ) : null}
              {closed !== null ? (
                <p className="alumno-muted">Sin servicio{closed ? ` · ${closed}` : ''}.</p>
              ) : products.length === 0 ? (
                <p className="alumno-muted">No hay menú publicado para este día.</p>
              ) : (
                <ul className="parent-sheet__products">
                  {products.map((product) => {
                    const blocked = blockedForChild(product, child);
                    const quantity = (selected && plan[selected]?.[product.id]) || 0;
                    return (
                      <li key={product.id} className={blocked ? 'is-blocked' : undefined}>
                        <span>
                          <strong>{product.nombre}</strong>
                          <span className="alumno-muted">{blocked ? 'No disponible para él' : formatAmount(product.precio_digital)}</span>
                        </span>
                        {blocked ? null : quantity > 0 && selected ? (
                          <span className="alumno-qty">
                            <button type="button" aria-label={`Quitar uno de ${product.nombre}`} onClick={() => change(selected, product, -1)}>
                              −
                            </button>
                            <span aria-live="polite">{quantity}</span>
                            <button type="button" aria-label={`Agregar otro ${product.nombre}`} onClick={() => change(selected, product, 1)}>
                              +
                            </button>
                          </span>
                        ) : (
                          <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => add(product)}>
                            Agregar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {choosing && selected ? (
                <div className="parent-sheet__options" role="group" aria-label={`Opciones de ${choosing.product.nombre}`}>
                  <strong>{choosing.product.nombre}</strong>
                  {choosing.product.grupos_opcion.map((group) => (
                    <fieldset key={group.id}>
                      <legend>{group.nombre}</legend>
                      <div className="alumno-chips parent-sheet__wrap">
                        {group.opciones.map((option) => {
                          const on = choosing.picked.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={on}
                              className={`alumno-chip${on ? ' is-on' : ''}`}
                              onClick={() => {
                                const groupIds = new Set(group.opciones.map((item) => item.id));
                                setChoosing((current) => {
                                  if (!current) return current;
                                  if (on) return { ...current, picked: current.picked.filter((id) => id !== option.id) };
                                  const inGroup = current.picked.filter((id) => groupIds.has(id));
                                  // Con una sola opción permitida, elegir otra reemplaza la anterior.
                                  const rest =
                                    group.max_selecciones === 1 ? current.picked.filter((id) => !groupIds.has(id)) : current.picked;
                                  if (group.max_selecciones > 1 && inGroup.length >= group.max_selecciones) return current;
                                  return { ...current, picked: [...rest, option.id] };
                                });
                              }}
                            >
                              {option.nombre}
                              {cents(option.precio_extra) > 0 ? ` +${formatAmount(option.precio_extra)}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  {optionsProblem(choosing.product, choosing.picked) ? (
                    <p className="alumno-muted">{optionsProblem(choosing.product, choosing.picked)}</p>
                  ) : null}
                  <button
                    className="alumno-btn alumno-btn--lime"
                    type="button"
                    disabled={optionsProblem(choosing.product, choosing.picked) !== null}
                    onClick={() => {
                      change(selected, choosing.product, 1, choosing.picked);
                      setChoosing(null);
                    }}
                  >
                    {`Confirmar ${choosing.product.nombre}`}
                  </button>
                  <button className="alumno-link" type="button" onClick={() => setChoosing(null)}>
                    Cancelar
                  </button>
                </div>
              ) : null}

              {error ? (
                <p className="alumno-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={busy || orders.length === 0}
                onClick={() => void submit(close)}
              >
                {busy
                  ? 'Apartando…'
                  : orders.length === 0
                    ? 'Elige qué apartar'
                    : `Apartar ${orders.length === 1 ? '1 día' : `${orders.length} días`} · ${formatAmount((totalCents / 100).toFixed(2))}`}
              </button>
            </>
          ) : null}
        </div>
      )}
    </ParentSheet>
  );
}