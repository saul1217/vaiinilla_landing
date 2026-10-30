import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TableParticipantValidation } from './table-participant-validation';
import { readTableParticipant, rememberTableParticipant } from '../lib/table-participant';
import { readGuest } from '../lib/guest-session';
import { VaiinillaApiError } from '../lib/api-error';
import { validateTableParticipant } from '../lib/validate-table-participant';

const { currentTable, renewGuest, createGuest, auth } = vi.hoisted(() => ({
  currentTable: vi.fn(), renewGuest: vi.fn(), createGuest: vi.fn(),
  auth: { user: null as null | { email: string }, ready: true },
}));
vi.mock('../lib/api', () => ({ api: { currentTable, renewGuest, createGuest } }));
vi.mock('../context/auth-context', () => ({ useAuth: () => auth }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetAllMocks();
  auth.user = null;
  renewGuest.mockRejectedValue(new Error('renewal failed'));
  sessionStorage.setItem('vaiinilla.buyer.client-context.v1', JSON.stringify({
    context: { access_token: 'jwt' }, slug: 'demo', expiresAt: Date.now() + 60_000,
  }));
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

it.each([false, true])('startup never renews or creates a guest (no token: %s)', async (noToken) => {
  if (noToken) sessionStorage.clear();
  currentTable.mockRejectedValue(new Error('offline'));
  await act(async () => {
    render(<TableParticipantValidation />);
    await Promise.resolve();
  });
  expect(renewGuest).not.toHaveBeenCalled();
  expect(createGuest).not.toHaveBeenCalled();
  expect(currentTable).toHaveBeenCalledTimes(noToken ? 0 : 1);
  expect(readTableParticipant()?.alias).toBe('Ana');
  expect(readGuest()?.llave).toBe('L'.repeat(43));
});

it('a rejected 401 keeps the saved identity', async () => {
  currentTable.mockRejectedValue(new VaiinillaApiError(401, { code: 'UNAUTHENTICATED', message: 'Expired' }));
  await act(async () => {
    render(<TableParticipantValidation />);
    await Promise.resolve();
  });
  expect(currentTable).toHaveBeenCalledWith('jwt');
  expect(readTableParticipant()?.alias).toBe('Ana');
});

it('validates the stored token for a registered user', async () => {
  auth.user = { email: 'ana@example.test' };
  currentTable.mockResolvedValue(null);
  render(<TableParticipantValidation />);
  await waitFor(() => expect(readTableParticipant()).toBeNull());
  expect(currentTable).toHaveBeenCalledWith('jwt');
  expect(createGuest).not.toHaveBeenCalled();
  expect(renewGuest).not.toHaveBeenCalled();
});

it.each([
  ['other', 'old'], ['p', 'new'],
])('keeps a changed identity (%s, %s) after a late response', async (participanteId, sesionId) => {
  for (const result of [null, { sesion_id: 'different' }]) {
    rememberTableParticipant({ slug: 'demo', espacioId: 1, sesionId: 'old', participanteId: 'p', alias: 'Ana' });
    let resolve!: (value: unknown) => void;
    currentTable.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const validation = validateTableParticipant('jwt');
    const changed = { slug: 'demo', espacioId: 1, sesionId, participanteId, alias: 'New' };
    rememberTableParticipant(changed);
    resolve(result);
    await validation;
    expect(readTableParticipant()).toEqual(changed);
  }
});
