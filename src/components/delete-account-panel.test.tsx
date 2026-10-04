import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountPanel } from './delete-account-panel';

const reauthenticateForDeletion = vi.fn();
const completeTotpSignIn = vi.fn();
const deleteIdentity = vi.fn();

vi.mock('../lib/firebase', () => ({
  reauthenticateForDeletion: (...args: unknown[]) => reauthenticateForDeletion(...args) as Promise<unknown>,
  completeTotpSignIn: (...args: unknown[]) => completeTotpSignIn(...args) as Promise<unknown>,
  signsInWithGoogle: (user: User) => user.providerData.some((p) => p.providerId === 'google.com'),
}));

vi.mock('../lib/api', () => ({
  ACCOUNT_DELETION_CONFIRMATION: 'ELIMINAR',
  api: { deleteIdentity: (...args: unknown[]) => deleteIdentity(...args) as Promise<void> },
}));

function fakeUser(providerId: string): User {
  return { email: 'ana@example.test', providerData: [{ providerId }] } as unknown as User;
}

describe('DeleteAccountPanel', () => {
  beforeEach(() => {
    reauthenticateForDeletion.mockReset().mockResolvedValue({ token: 'fresh-token' });
    completeTotpSignIn.mockReset();
    deleteIdentity.mockReset().mockResolvedValue(undefined);
  });

  it('con correo pide ELIMINAR y la contraseña, vuelve a entrar y borra con el token nuevo', async () => {
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAccountPanel user={fakeUser('password')} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    const submit = screen.getByRole('button', { name: 'Eliminar definitivamente' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/escribe eliminar/i), 'eliminar');
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Tu contraseña'), 'secreta1');
    await user.click(submit);

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(reauthenticateForDeletion).toHaveBeenCalledWith(expect.anything(), 'secreta1');
    expect(deleteIdentity).toHaveBeenCalledWith('fresh-token');
  });

  it('con Google no pide contraseña y, si falla, muestra el error sin cerrar sesión', async () => {
    reauthenticateForDeletion.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }));
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DeleteAccountPanel user={fakeUser('google.com')} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    expect(screen.queryByLabelText('Tu contraseña')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cerraste la ventana de google/i);
    expect(deleteIdentity).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('con segundo factor pide el código TOTP antes de borrar', async () => {
    const resolver = { hints: [{ factorId: 'totp', uid: 'h1' }] };
    reauthenticateForDeletion.mockResolvedValue({ mfaResolver: resolver });
    completeTotpSignIn.mockResolvedValue({ getIdToken: () => Promise.resolve('mfa-token') });
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAccountPanel user={fakeUser('password')} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    await user.type(screen.getByLabelText('Tu contraseña'), 'secreta1');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(deleteIdentity).not.toHaveBeenCalled();

    await user.type(await screen.findByLabelText(/código de 6 dígitos/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(completeTotpSignIn).toHaveBeenCalledWith(resolver, '123456');
    expect(deleteIdentity).toHaveBeenCalledWith('mfa-token');
  });

  it('mientras borra no se puede cancelar, y al cancelar se pierde la confirmación escrita', async () => {
    let finish: (value: { token: string }) => void = () => undefined;
    reauthenticateForDeletion.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<DeleteAccountPanel user={fakeUser('google.com')} onDeleted={vi.fn().mockResolvedValue(undefined)} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toBeDisabled();
    finish({ token: 'fresh-token' });
    await waitFor(() => expect(deleteIdentity).toHaveBeenCalled());
  });

  it('cancelar y volver a abrir exige escribir ELIMINAR otra vez', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountPanel user={fakeUser('google.com')} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));

    expect(screen.getByLabelText(/escribe eliminar/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
  });
});
