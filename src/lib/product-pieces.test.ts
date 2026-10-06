import { describe, expect, it } from 'vitest';
import { piecesLabel, splitPieces } from './product-pieces';

describe('piezas en el nombre del producto', () => {
  it('separa el (N) final del nombre', () => {
    expect(splitPieces('Tacos dorados de res (5)')).toEqual({ name: 'Tacos dorados de res', pieces: 5 });
    expect(splitPieces('Mochis surtidos (6) ')).toEqual({ name: 'Mochis surtidos', pieces: 6 });
  });

  it('sin piezas, o con paréntesis que no son número, deja el nombre igual', () => {
    expect(splitPieces('Hamburguesa')).toEqual({ name: 'Hamburguesa', pieces: null });
    expect(splitPieces('Agua (natural)')).toEqual({ name: 'Agua (natural)', pieces: null });
    expect(splitPieces('Combo (2) grande')).toEqual({ name: 'Combo (2) grande', pieces: null });
  });

  it('dice pz o pzs', () => {
    expect(piecesLabel(1)).toBe('1 pz');
    expect(piecesLabel(5)).toBe('5 pzs');
  });
});
