import type { PublicEstablishment } from '../types/api';

type Place = Pick<PublicEstablishment, 'identificador_cliente_obligatorio' | 'cuenta_obligatoria'>;

/**
 * Sin cuenta no se pide aquí: el negocio pide matrícula o quitó «pedir sin cuenta»
 * (`cuenta_obligatoria`, migración 228 del back; un back anterior no lo manda).
 */
export function accountRequired(place: Place | null | undefined): boolean {
  return place?.identificador_cliente_obligatorio === true || place?.cuenta_obligatoria === true;
}
