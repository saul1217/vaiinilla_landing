import { api } from './api';
import { dropTableParticipantOnSessionChange, forgetTableParticipant } from './table-participant';

/** A failed request leaves the saved identity intact; only the server invalidates it. */
export async function validateTableParticipant(accessToken: string): Promise<void> {
  const table = await api.currentTable(accessToken);
  if (table) dropTableParticipantOnSessionChange(table.sesion_id);
  else forgetTableParticipant();
}
