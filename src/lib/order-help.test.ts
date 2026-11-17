import { describe, expect, it } from 'vitest';
import { canAskForHelp, whatsappWith } from './order-help';

describe('¿Qué pasó? de un pedido a domicilio', () => {
  it('solo sale a domicilio y mientras el pedido puede cambiar', () => {
    expect(canAskForHelp({ destino: 'a_domicilio', estado: 'preparando' })).toBe(true);
    expect(canAskForHelp({ destino: 'a_domicilio', estado: 'entregado' })).toBe(false);
    expect(canAskForHelp({ destino: 'para_llevar', estado: 'preparando' })).toBe(false);
  });

  it('agrega el mensaje al enlace de WhatsApp', () => {
    expect(whatsappWith('https://wa.me/5215512345678', 'Pedido #12: hola.')).toBe(
      'https://wa.me/5215512345678?text=Pedido%20%2312%3A%20hola.',
    );
    expect(whatsappWith('https://wa.me/52155?lang=es', 'a')).toBe('https://wa.me/52155?lang=es&text=a');
  });
});