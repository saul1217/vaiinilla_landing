import { describe, expect, it } from 'vitest';
import { splashContextFor } from './splash-context';

describe('por qué se pide la cuenta', () => {
  it('Cartera, carrito con total, pedido y canchas tienen su propia línea', () => {
    expect(splashContextFor('/cuenta/saldo', null)?.line).toBe(
      'Tu saldo vive en tu cuenta. Puedes seguir pidiendo sin cuenta.',
    );
    expect(splashContextFor('/e/padel/carrito', '$145')?.line).toBe('Entra para pagar tu pedido de $145.');
    expect(splashContextFor('/cuenta/pedidos/42', null)?.line).toBe('Entra para ver este pedido.');
    expect(splashContextFor('/e/padel/canchas', null)?.kicker).toBe('Canchas');
  });

  it('sin contexto conocido queda el splash general', () => {
    expect(splashContextFor('/pedir', null)).toBeNull();
  });
});
