// QA-057 / QA-043: los enlaces de los correos de acceso abren páginas de esta web, que
// aplican el código con Firebase y nunca muestran el texto técnico del SDK.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailVerificationPage, PasswordResetPage } from './email-action-page';

const mocks = vi.hoisted(() => ({
  applyEmailVerificationCode: vi.fn(),
  inspectPasswordResetCode: vi.fn(),
  applyPasswordReset: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  firebaseConfigured: true,
  applyEmailVerificationCode: mocks.applyEmailVerificationCode,
  inspectPasswordResetCode: mocks.inspectPasswordResetCode,
  applyPasswordReset: mocks.applyPasswordReset,
}));

vi.mock('../components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function open(path: string, search: string) {
  window.history.replaceState(null, '', `${path}${search}`);
  render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <Routes>
        <Route path="/acceso/verificar" element={<EmailVerificationPage />} />
        <Route path="/acceso/recuperar" element={<PasswordResetPage />} />
        <Route path="/cuenta" element={<p>cuenta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('verificar correo', () => {
  beforeEach(() => {
    mocks.applyEmailVerificationCode.mockReset().mockResolvedValue(undefined);
  });

  it('aplica el código del enlace y quita el código de la barra', async () => {
    open('/acceso/verificar', '?mode=verifyEmail&oobCode=abc');
    expect(await screen.findByRole('heading', { name: 'Correo verificado' })).toBeInTheDocument();
    expect(mocks.applyEmailVerificationCode).toHaveBeenCalledExactlyOnceWith('abc');
    expect(window.location.search).toBe('');
    expect(screen.getByRole('link', { name: 'Ir a mi cuenta' })).toHaveAttribute('href', '/cuenta');
  });

  it('un enlace usado se explica en español, como alerta', async () => {
    mocks.applyEmailVerificationCode.mockRejectedValue(
      new FirebaseError('auth/invalid-action-code', 'Firebase: Error (auth/invalid-action-code).'),
    );
    open('/acceso/verificar', '?mode=verifyEmail&oobCode=usado');
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o ya se usó');
    expect(screen.queryByText(/Firebase:/)).not.toBeInTheDocument();
  });

  it('un enlace sin código no llama a Firebase', async () => {
    open('/acceso/verificar', '?mode=resetPassword');
    expect(await screen.findByRole('alert')).toHaveTextContent(/enlace está incompleto/);
    expect(mocks.applyEmailVerificationCode).not.toHaveBeenCalled();
  });
});

describe('crear contraseña nueva', () => {
  beforeEach(() => {
    mocks.inspectPasswordResetCode.mockReset().mockResolvedValue('persona@example.test');
    mocks.applyPasswordReset.mockReset().mockResolvedValue(undefined);
  });

  it('valida, guarda la contraseña con el código y confirma', async () => {
    const user = userEvent.setup();
    open('/acceso/recuperar', '?mode=resetPassword&oobCode=r1');
    expect(await screen.findByText('persona@example.test')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');

    await user.clear(screen.getByLabelText('Contraseña nueva'));
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-segura');
    await user.type(screen.getByLabelText('Confírmala'), 'otra-cosa');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no coinciden');
    expect(mocks.applyPasswordReset).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confírmala'));
    await user.type(screen.getByLabelText('Confírmala'), 'nueva-segura');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeInTheDocument();
    expect(mocks.applyPasswordReset).toHaveBeenCalledExactlyOnceWith('r1', 'nueva-segura');
  });

  it('un enlace vencido se explica y no muestra el formulario', async () => {
    mocks.inspectPasswordResetCode.mockRejectedValue(
      new FirebaseError('auth/expired-action-code', 'Firebase: Error (auth/expired-action-code).'),
    );
    open('/acceso/recuperar', '?mode=resetPassword&oobCode=viejo');
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ya venció');
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });
});
