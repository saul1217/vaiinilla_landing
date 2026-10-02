import { STAFF_APP_URL, type OperationalRole, type SessionAccess } from '../types/api';

const STAFF_ROLE_NOUN: Record<Exclude<OperationalRole, 'cliente'>, string> = {
  mesero: 'mesero',
  cajero: 'cajero',
  cocina: 'cocinero',
  admin: 'administrador',
};

/** Puestos de equipo en negocios activos: lo que no es "cliente". */
export function staffAccesses(accesses: SessionAccess[]): SessionAccess[] {
  return accesses.filter((access) => access.rol !== 'cliente' && access.estado_establecimiento === 'activo');
}

export function staffRoleNoun(role: OperationalRole): string {
  return role === 'cliente' ? 'cliente' : STAFF_ROLE_NOUN[role];
}

/** "mesero de Padel prueba", o "mesero de A y cajero de B". */
export function staffSummary(accesses: SessionAccess[]): string {
  const parts = accesses.map((access) => `${staffRoleNoun(access.rol)} de ${access.establecimiento.nombre}`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/** El panel del equipo vive en otro sitio y tiene su propio inicio de sesión. */
export const STAFF_PANEL_LOGIN_URL = `${STAFF_APP_URL}/acceso`;
