import { api } from './api';
import type { SharedTable } from '../types/api';
import { forgetSpace, type SpaceSession } from './space-session';
import { dropTableParticipantOnSessionChange, forgetTableParticipant, readTableParticipant } from './table-participant';
import { clearClosedTableSession } from './table-session-cleanup';

/** Este dispositivo ya se unió a la mesa escaneada: guardó su identidad de participante. */
export function joinedScannedTable(space: SpaceSession): boolean {
  const identity = readTableParticipant();
  return identity !== null && identity.slug === space.slug && identity.espacioId === space.espacioId;
}

/**
 * La mesa escaneada según el servidor. Solo lee (`GET /mesas/actual`): nunca abre
 * una sesión. Si el cliente ya no está unido a una sesión abierta de esa mesa
 * (el mesero la liberó), el teléfono olvida la mesa y su identidad, y devuelve null.
 */
export async function currentScannedTable(accessToken: string, space: SpaceSession): Promise<SharedTable | null> {
  const table = await api.currentTable(accessToken);
  if (table && Number(table.espacio.id) === space.espacioId) {
    dropTableParticipantOnSessionChange(table.sesion_id);
    return table;
  }
  clearClosedTableSession(space.slug, space.espacioId);
  forgetSpace();
  forgetTableParticipant();
  return null;
}
