import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountPanel } from './delete-account-panel';

const reauthenticateForDeletion = vi.fn();
const deleteIdentity = vi.fn();

vi.mock('../lib/firebase', () => ({
  reauthenticateForDeletion: (...args: unknown[]) => reauthenticateForDeletion(...args) as Promise<string>,
  signsInWithGoogle: (user: User) => user.providerData.some((p) => p.providerId === 'google.com'),
}));

vi.mock('../lib/api', () => ({
  api: { deleteIdentity: (...args: unknown[]) => deleteIdentity(...args) as Promise<void> },
}));

function fakeUser(providerId: string): User {
  return { email: 'ana@example.test', providerData: [{ providerId }] } as unknown as User;
}

describe('DeleteAccountPanel', () => {
  beforeEach(() => {
    reauthenticateForDeletion.mockReset().mockResolvedValue('fresh-token');
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
});
