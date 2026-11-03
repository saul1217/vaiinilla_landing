import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTableDeviceToken, tableDeviceToken } from '../lib/table-device-token';
import { AuthProvider, useAuth } from './auth-context';

const firebaseMock = vi.hoisted(() => ({ signOut: vi.fn(), observe: vi.fn() }));
vi.mock('../lib/firebase', () => ({
  firebaseConfigured: false,
  firebaseSignOut: firebaseMock.signOut,
  observeAuth: firebaseMock.observe,
}));

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>Cerrar sesión</button>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    firebaseMock.signOut.mockReset().mockResolvedValue(undefined);
    firebaseMock.observe.mockReset().mockReturnValue(() => undefined);
  });

  it('borra todos los tokens de dispositivo al cerrar sesión', async () => {
    saveTableDeviceToken('p-ana', 'token-ana', 'ses-1');
    saveTableDeviceToken('p-luis', 'token-luis', 'ses-1');
    render(<AuthProvider><SignOutButton /></AuthProvider>);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(firebaseMock.signOut).toHaveBeenCalledOnce();
    expect(tableDeviceToken('p-ana')).toBeNull();
    expect(tableDeviceToken('p-luis')).toBeNull();
  });
});
