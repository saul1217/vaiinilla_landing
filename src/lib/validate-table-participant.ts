import { api } from './api';
import { dropTableParticipantOnSessionChange, forgetTableParticipant, readTableParticipant } from './table-participant';

/** A failed request leaves the saved identity intact; only the server invalidates it. */
export async function validateTableParticipant(accessToken: string): Promise<void> {
  const identity = readTableParticipant();
  const table = await api.currentTable(accessToken);
  const current = readTableParticipant();
  if (!identity || current?.participanteId !== identity.participanteId || current?.sesionId !== identity.sesionId) return;
  if (table) dropTableParticipantOnSessionChange(table.sesion_id);
  else forgetTableParticipant();
}
