import { describe, expect, it } from 'vitest';
import { deliveredAtLabel, openingTitle, spaceNoun } from './space-words';

describe('vocabulario del lugar', () => {
  it('llama a cada espacio por su nombre', () => {
    expect(spaceNoun('mesa')).toBe('mesa');
    expect(spaceNoun('cancha')).toBe('cancha');
    expect(spaceNoun('asiento')).toBe('asiento');
    expect(spaceNoun('barra')).toBe('barra');
  });

  it('sin tipo o con uno nuevo cae en mesa, como hasta ahora', () => {
    expect(spaceNoun(undefined)).toBe('mesa');
    expect(spaceNoun(null)).toBe('mesa');
    expect(spaceNoun('palco')).toBe('mesa');
  });

  it('arma los textos de la pantalla', () => {
    expect(openingTitle('asiento')).toBe('Abriendo tu asiento');
    expect(deliveredAtLabel('cancha')).toBe('El pedido se entrega en tu cancha');
    expect(deliveredAtLabel(undefined)).toBe('El pedido se entrega en tu mesa');
  });
});
