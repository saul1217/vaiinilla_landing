import { describe, expect, it } from 'vitest';
import type { SessionAccess } from '../types/api';
import { STAFF_PANEL_LOGIN_URL, staffAccesses, staffSummary } from './staff-access';

function access(rol: SessionAccess['rol'], nombre: string, estado: SessionAccess['estado_establecimiento'] = 'activo'): SessionAccess {
  return {
    membresia_id: `${rol}-${nombre}`,
    establecimiento: { id: nombre, nombre, slug: nombre.toLowerCase() },
    rol,
    identificador_cliente: null,
    estado_establecimiento: estado,
    cierre_operativo_disponible: false,
  };
}

describe('acceso del equipo en la web de compra', () => {
  it('un cliente a secas no es equipo', () => {
    expect(staffAccesses([access('cliente', 'Padel')])).toEqual([]);
    expect(staffAccesses([])).toEqual([]);
  });

  it('mesero, cajero, cocina y admin son equipo; un negocio suspendido no cuenta', () => {
    const list = [
      access('cliente', 'A'),
      access('mesero', 'B'),
      access('cajero', 'C'),
      access('cocina', 'D'),
      access('admin', 'E'),
      access('mesero', 'F', 'suspendido'),
    ];
    expect(staffAccesses(list).map((a) => a.rol)).toEqual(['mesero', 'cajero', 'cocina', 'admin']);
  });

  it('lo dice en palabras', () => {
    expect(staffSummary([access('mesero', 'Padel prueba')])).toBe('mesero de Padel prueba');
    expect(staffSummary([access('mesero', 'A'), access('cajero', 'B'), access('cocina', 'C')])).toBe(
      'mesero de A, cajero de B y cocinero de C',
    );
    expect(staffSummary([access('admin', 'A'), access('mesero', 'B')])).toBe('administrador de A y mesero de B');
  });

  it('el panel se abre en su pantalla de acceso', () => {
    expect(STAFF_PANEL_LOGIN_URL).toBe('https://app.vaiinilla.app/acceso');
  });
});
