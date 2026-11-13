import { describe, expect, it } from 'vitest';
import type { CartLine, CatalogProduct, OperationalStatus } from '../types/api';
import {
  asksForDeliveryDate,
  businessNow,
  cartPreparationDays,
  deliveryDates,
  deliveryDayLabel,
  isIsoDate,
  preorderOffer,
  prepTimeFrom,
} from './preorder';

const base: OperationalStatus = {
  recibiendo_pedidos: true,
  sesion_caja_abierta: true,
  caja_en_linea: true,
  cocina_en_linea: true,
  tiempo_estimado_min: null,
  consultado_en: '2026-11-13T12:00:00Z',
};

// 13 nov 2026 a las 10:00 en Chihuahua (UTC-6) y a las 19:00.
const morning = new Date('2026-11-13T16:00:00Z');
const evening = new Date('2026-11-14T01:00:00Z');

describe('isIsoDate (como esFechaIso del back)', () => {
  it('acepta fechas de calendario reales AAAA-MM-DD', () => {
    expect(isIsoDate('2026-11-13')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });
  it('rechaza fechas que no existen y otros formatos', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-11-13T00:00:00Z')).toBe(false);
    expect(isIsoDate('13/11/2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('preorderOffer', () => {
  it('sin el bloque de encargos no hay oferta', () => {
    expect(preorderOffer(null)).toBeNull();
    expect(preorderOffer(base)).toBeNull();
  });
  it('lee los días de adelanto y la hora de corte', () => {
    expect(preorderOffer({ ...base, encargos_requieren_aceptar: false, dias_adelanto_pedido: 3, hora_corte_pedido: '18:00:00' })).toEqual({
      daysAhead: 3,
      cutoff: '18:00',
    });
    expect(preorderOffer({ ...base, encargos_requieren_aceptar: true })).toEqual({ daysAhead: 0, cutoff: null });
  });
});

describe('cuándo se pregunta el día', () => {
  const lines = [{ productId: 1 }, { productId: 2 }] as CartLine[];
  const products = [
    { id: 1, dias_preparacion: 0 },
    { id: 2, dias_preparacion: 2 },
  ] as CatalogProduct[];

  it('el producto que más tarda manda; sin dato cuenta 0', () => {
    expect(cartPreparationDays(lines, products)).toBe(2);
    expect(cartPreparationDays(lines, [])).toBe(0);
  });

  it('solo si el negocio toma encargos y el carrito tarda o deja pedir para otro día', () => {
    expect(asksForDeliveryDate(null, 2)).toBe(false);
    expect(asksForDeliveryDate({ daysAhead: 0, cutoff: null }, 0)).toBe(false);
    expect(asksForDeliveryDate({ daysAhead: 0, cutoff: null }, 1)).toBe(true);
    expect(asksForDeliveryDate({ daysAhead: 2, cutoff: null }, 0)).toBe(true);
  });
});

describe('deliveryDates (como HomeCheckoutRules.dates y el back)', () => {
  it('usa la fecha del negocio, no la UTC', () => {
    expect(businessNow(evening)).toEqual({ date: '2026-11-13', time: '19:00' });
  });

  it('desde hoy más los días de preparación hasta los días de adelanto', () => {
    expect(deliveryDates({ daysAhead: 3, cutoff: null }, 1, morning)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(deliveryDates({ daysAhead: 2, cutoff: null }, 0, morning)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('pasada la hora de corte hoy ya no cuenta como día de margen', () => {
    expect(deliveryDates({ daysAhead: 2, cutoff: '18:00' }, 0, morning)[0]).toBe('2026-11-13');
    expect(deliveryDates({ daysAhead: 2, cutoff: '18:00' }, 0, evening)).toEqual(['2026-11-14', '2026-11-15']);
    expect(deliveryDates({ daysAhead: 0, cutoff: '18:00' }, 2, evening)).toEqual(['2026-11-16']);
  });

  it('nunca pasa de 15 días', () => {
    const dates = deliveryDates({ daysAhead: 30, cutoff: null }, 0, morning);
    expect(dates).toHaveLength(16);
    expect(dates.at(-1)).toBe('2026-11-28');
    expect(dates.every(isIsoDate)).toBe(true);
  });
});

describe('etiquetas y NEEDS_PREP_TIME', () => {
  it('Hoy, Mañana o el día corto', () => {
    expect(deliveryDayLabel('2026-11-13', '2026-11-13')).toBe('Hoy');
    expect(deliveryDayLabel('2026-11-14', '2026-11-13')).toBe('Mañana');
    expect(deliveryDayLabel('2026-11-16', '2026-11-13')).toBe('lun 16 nov');
  });
  it('lee `desde` de los detalles del error', () => {
    expect(prepTimeFrom([{ desde: '2026-11-15' }])).toBe('2026-11-15');
    expect(prepTimeFrom([{ desde: '2026-02-30' }])).toBeNull();
    expect(prepTimeFrom(undefined)).toBeNull();
  });
});
