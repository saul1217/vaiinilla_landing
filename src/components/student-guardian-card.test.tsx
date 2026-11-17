import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentGuardianCard } from './student-guardian-card';

const { getOperationalStatus, getMyGuardianControls, createStudentLinkCode, claimStudentAccount } = vi.hoisted(() => ({
  getOperationalStatus: vi.fn(),
  getMyGuardianControls: vi.fn(),
  createStudentLinkCode: vi.fn(),
  claimStudentAccount: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getOperationalStatus: (...args: unknown[]) => getOperationalStatus(...args) as Promise<unknown>,
    getMyGuardianControls: (...args: unknown[]) => getMyGuardianControls(...args) as Promise<unknown>,
    createStudentLinkCode: (...args: unknown[]) => createStudentLinkCode(...args) as Promise<unknown>,
    claimStudentAccount: (...args: unknown[]) => claimStudentAccount(...args) as Promise<unknown>,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getOperationalStatus.mockResolvedValue({ modo_escuela: true });
  getMyGuardianControls.mockResolvedValue(null);
});

describe('StudentGuardianCard', () => {
  it('fuera de una escuela no sale', async () => {
    getOperationalStatus.mockResolvedValue({ modo_escuela: false });
    const { container } = render(<StudentGuardianCard token="jwt" />);
    await waitFor(() => expect(getOperationalStatus).toHaveBeenCalledWith('jwt'));
    expect(container).toBeEmptyDOMElement();
    expect(getMyGuardianControls).not.toHaveBeenCalled();
  });

  it('sin tutor saca el código para su tutor', async () => {
    createStudentLinkCode.mockResolvedValue({ code: 'QWE789', expiresAt: null });
    const user = userEvent.setup();
    render(<StudentGuardianCard token="jwt" />);
    expect(await screen.findByRole('heading', { name: 'Conecta tu cuenta con tu tutor' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Que mi tutor me agregue' }));
    expect(await screen.findByText('QWE789')).toBeInTheDocument();
    expect(createStudentLinkCode).toHaveBeenCalledWith('jwt', expect.any(String));
  });

  it('activa la cuenta con el código de 8 de su tutor', async () => {
    claimStudentAccount.mockResolvedValue('Tilin');
    const user = userEvent.setup();
    render(<StudentGuardianCard token="jwt" />);
    await user.click(await screen.findByRole('button', { name: 'Mi tutor ya me dio de alta' }));
    const activate = screen.getByRole('button', { name: 'Activar mi cuenta' });
    await user.type(screen.getByLabelText('Código de tu cuenta'), 'abcd-1234');
    expect(activate).toBeEnabled();
    await user.click(activate);
    await waitFor(() => expect(claimStudentAccount).toHaveBeenCalledWith('jwt', 'ABCD1234', expect.any(String)));
    expect(await screen.findByText('Listo, ya es tu cuenta, Tilin.')).toBeInTheDocument();
  });

  it('con tutores muestra sus controles de hoy', async () => {
    getMyGuardianControls.mockResolvedValue({
      tutorNames: ['Laura'],
      dailyLimit: '60.00',
      availableToday: '40.00',
      blockedProductIds: [],
      blockedCategoryIds: [],
      allergens: ['cacahuate'],
    });
    render(<StudentGuardianCard token="jwt" />);
    expect(await screen.findByRole('heading', { name: 'Quien te cuida en la escuela' })).toBeInTheDocument();
    expect(screen.getByText('Tutores: Laura')).toBeInTheDocument();
    expect(screen.getByText('Límite diario: $60 · te quedan $40 hoy')).toBeInTheDocument();
    expect(screen.getByText('Alergias: Cacahuate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mi tutor ya me dio de alta' })).toBeNull();
  });
});