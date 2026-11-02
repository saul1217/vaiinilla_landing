import { beforeEach, describe, expect, it } from 'vitest';
import { saveTableDeviceToken, tableDeviceToken } from './table-device-token';

describe('table-device-token', () => {
  beforeEach(() => localStorage.clear());

  it('guarda y lee el token por participante', () => {
    saveTableDeviceToken('p1', 'tok-1');
    saveTableDeviceToken('p2', 'tok-2');
    expect(tableDeviceToken('p1')).toBe('tok-1');
    expect(tableDeviceToken('p2')).toBe('tok-2');
    expect(tableDeviceToken('p3')).toBeNull();
  });

  it('rota: el último token gana', () => {
    saveTableDeviceToken('p1', 'viejo');
    saveTableDeviceToken('p1', 'nuevo');
    expect(tableDeviceToken('p1')).toBe('nuevo');
  });

  it('tolera almacenamiento corrupto', () => {
    localStorage.setItem('vaiinilla.mesa.dispositivo', '{no json');
    expect(tableDeviceToken('p1')).toBeNull();
  });
});
