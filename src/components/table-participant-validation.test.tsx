import { render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TableParticipantValidation } from './table-participant-validation';
import { readTableParticipant, rememberTableParticipant } from '../lib/table-participant';
import { readGuest } from '../lib/guest-session';

const { currentTable, clientSessionForPlace } = vi.hoisted(() => ({
  currentTable: vi.fn(), clientSessionForPlace: vi.fn(),
}));
vi.mock('../lib/api', () => ({ api: { currentTable } }));
vi.mock('../lib/client-session-for-place', () => ({ clientSessionForPlace }));
vi.mock('../context/auth-context', () => ({ useAuth: () => ({ user: null, ready: true }) }));
vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({ context: null, openClientSession: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  clientSessionForPlace.mockResolvedValue({ access_token: 'jwt' });
  rememberTableParticipant({ slug: 'demo', espacioId: 1, sesionId: 'old', participanteId: 'p', alias: 'Ana' });
  localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Ana', llave: 'L'.repeat(43) }));
});

it.each([null, { sesion_id: 'new' }])('startup clears stale identity for %j and preserves the guest key', async (table) => {
  currentTable.mockResolvedValue(table);
  render(<TableParticipantValidation />);
  await waitFor(() => expect(readTableParticipant()).toBeNull());
  expect(currentTable).toHaveBeenCalledWith('jwt');
  expect(readGuest()?.llave).toBe('L'.repeat(43));
});

it.each([false, true])('startup keeps identity for matching session or request failure (%s)', async (fails) => {
  if (fails) currentTable.mockRejectedValue(new Error('offline'));
  else currentTable.mockResolvedValue({ sesion_id: 'old' });
  render(<TableParticipantValidation />);
  await waitFor(() => expect(currentTable).toHaveBeenCalledWith('jwt'));
  expect(readTableParticipant()?.alias).toBe('Ana');
});
