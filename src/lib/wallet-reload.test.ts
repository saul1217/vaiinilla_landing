import { describe, expect, it, vi } from 'vitest';
import {
  cardReloadFingerprint,
  cardReloadStatus,
  cashReloadArrived,
  isCardReloadTestMode,
  movementLabel,
  parseReloadAmount,
  reloadAmountProblem,
  reloadExtraCharge,
  reloadRangeOf,
  resolveTestStripeKey,
  waitForCardReload,
  walletRechargeNote,
} from './wallet-reload';
import type { CardReload } from '../types/api';

const reload = (estado: string, monto = '200.00', cents = 21_000): CardReload => ({
  id: 'r1',
  usuario_id: 'u1',
  monto,
  total_cobrado_cents: cents,
  estado,
  creado_en: '2026-11-10T00:00:00Z',
});

describe('wallet-reload', () => {
  it('lee el monto como el backend lo pide (decimal con 2 cifras)', () => {
    expect(parseReloadAmount('200')).toBe('200.00');
    expect(parseReloadAmount('150,5')).toBe('150.50');
    expect(parseReloadAmount('99.')).toBe('99.00');
    expect(parseReloadAmount('0')).toBeNull();
    expect(parseReloadAmount('1234567')).toBeNull();
    expect(parseReloadAmount('12.345')).toBeNull();
    expect(parseReloadAmount('abc')).toBeNull();
  });

  it('avisa si el monto sale del rango del negocio', () => {
    const range = reloadRangeOf({
      cliente: { usuario_id: 'u1', nombre: 'Ana', identificador_cliente: null },
      wallet: { id: 'w', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '0.00', actualizado_en: null },
      movimientos: [],
      recarga_tarjeta: { minima: '50.00', maxima: '2000.00' },
    });
    expect(reloadAmountProblem('', range)).toBeNull();
    expect(reloadAmountProblem('100', range)).toBeNull();
    expect(reloadAmountProblem('20', range)).toBe('La recarga debe ser de $50.00 a $2000.00.');
    expect(reloadAmountProblem('2500', range)).toBe('La recarga debe ser de $50.00 a $2000.00.');
    expect(reloadAmountProblem('x', range)).toMatch(/monto válido/);
    expect(reloadAmountProblem('20', null)).toBeNull();
  });

  it('calcula la comisión que se cobra encima del monto', () => {
    expect(reloadExtraCharge(reload('pendiente_pago', '200.00', 21_050))).toBe('10.50');
    expect(reloadExtraCharge(reload('pendiente_pago', '200.00', 20_000))).toBeNull();
  });

  it('traduce los estados del backend como Android', () => {
    expect(cardReloadStatus('pendiente_pago')).toBe('awaiting');
    expect(cardReloadStatus('acreditada')).toBe('credited');
    expect(cardReloadStatus('fallida')).toBe('failed');
    expect(cardReloadStatus('cancelada')).toBe('canceled');
    expect(cardReloadStatus('rara')).toBe('other');
  });

  it('solo ofrece tarjeta en modo de prueba', () => {
    const dev = 'https://vaiinillaback-development.up.railway.app/api/v1';
    const prod = 'https://vaiinillaback.up.railway.app/api/v1';
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: dev, envKey: null })).toBe(true);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: '/api/v1', envKey: 'pk_test_x' })).toBe(true);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: 'http://127.0.0.1:4010/api/v1', envKey: null })).toBe(true);
    expect(isCardReloadTestMode({ environment: 'production', apiUrl: dev, envKey: null })).toBe(false);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: prod, envKey: null })).toBe(false);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: 'https://otro.example/api', envKey: null })).toBe(false);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: dev, envKey: 'pk_live_x' })).toBe(false);
    expect(isCardReloadTestMode({ environment: 'development', apiUrl: dev, envKey: 'sk_test_x' })).toBe(false);
  });

  it('abre Stripe solo con una clave pk_test_', () => {
    expect(resolveTestStripeKey('pk_test_123', null)).toBe('pk_test_123');
    expect(resolveTestStripeKey(null, 'pk_test_env')).toBe('pk_test_env');
    expect(() => resolveTestStripeKey('pk_live_123', 'pk_test_env')).toThrow(/modo de prueba/);
    expect(() => resolveTestStripeKey('sk_test_123', null)).toThrow(/modo de prueba/);
    expect(() => resolveTestStripeKey(null, null)).toThrow(/modo de prueba/);
  });

  it('espera a que el backend acredite y no se fía del pago de Stripe', async () => {
    const fetchReload = vi
      .fn<() => Promise<CardReload>>()
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce(reload('pendiente_pago'))
      .mockResolvedValueOnce(reload('acreditada'));
    const sleep = vi.fn(() => Promise.resolve());
    await expect(waitForCardReload(fetchReload, { sleep, maxPolls: 5 })).resolves.toMatchObject({
      kind: 'credited',
    });
    expect(fetchReload).toHaveBeenCalledTimes(3);
  });

  it('una recarga fallida o cancelada termina en fallo', async () => {
    const sleep = () => Promise.resolve();
    await expect(waitForCardReload(() => Promise.resolve(reload('fallida')), { sleep })).resolves.toMatchObject({ kind: 'failed' });
    await expect(waitForCardReload(() => Promise.resolve(reload('cancelada')), { sleep })).resolves.toMatchObject({ kind: 'failed' });
  });

  it('si el banco tarda, queda en revisión sin pedir otro pago', async () => {
    const fetchReload = vi.fn(() => Promise.resolve(reload('pendiente_pago')));
    await expect(waitForCardReload(fetchReload, { sleep: () => Promise.resolve(), maxPolls: 3 })).resolves.toEqual({
      kind: 'in_review',
    });
    expect(fetchReload).toHaveBeenCalledTimes(3);
  });

  it('detecta cuándo Caja recargó', () => {
    expect(cashReloadArrived('10.00', '110.00')).toBe('100.00');
    expect(cashReloadArrived('10.00', '10.00')).toBeNull();
    expect(cashReloadArrived('10.00', '5.00')).toBeNull();
    expect(cashReloadArrived(null, '5.00')).toBeNull();
  });

  it('nombra los movimientos y explica por qué no se recarga', () => {
    expect(movementLabel('recarga_efectivo', 'x')).toBe('Recarga en Caja');
    expect(movementLabel('recarga_stripe', 'x')).toBe('Recarga con tarjeta');
    expect(movementLabel('ajuste', '')).toBe('Ajuste autorizado');
    expect(movementLabel('otro', 'Pedido #4')).toBe('Pedido #4');
    expect(walletRechargeNote({ frozen: true, allowsBalance: true })).toMatch(/congelado/);
    expect(walletRechargeNote({ frozen: false, allowsBalance: false })).toMatch(/ya no recibe/);
    expect(walletRechargeNote({ frozen: false, allowsBalance: true })).toBeNull();
  });
});

describe('cardReloadFingerprint', () => {
  const base = {
    cliente: { usuario_id: 'u1', nombre: 'Ana', identificador_cliente: null },
    wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '0.00', actualizado_en: null },
    movimientos: [],
  };

  it('ata la llave al lugar, a la persona y al monto', () => {
    expect(cardReloadFingerprint(base, '200.00')).toBe('wallet-reload|e1|u1|200.00');
    expect(cardReloadFingerprint(base, '300.00')).not.toBe(cardReloadFingerprint(base, '200.00'));
    expect(
      cardReloadFingerprint({ ...base, wallet: { ...base.wallet, establecimiento_id: 'e2' } }, '200.00'),
    ).not.toBe(cardReloadFingerprint(base, '200.00'));
  });
});
