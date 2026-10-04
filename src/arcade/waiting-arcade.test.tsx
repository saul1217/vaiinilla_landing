import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WaitingArcade } from './waiting-arcade';

describe('WaitingArcade', () => {
  it('arranca cerrado: no monta los juegos hasta que tocan Arcade, y al cerrar los quita', async () => {
    const user = userEvent.setup();
    render(<WaitingArcade />);

    expect(screen.queryByRole('region', { name: 'Mini juegos' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /arcade/i }));
    expect(screen.getByRole('region', { name: 'Mini juegos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar arcade' }));
    expect(screen.queryByRole('region', { name: 'Mini juegos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arcade/i })).toBeInTheDocument();
  });
});
