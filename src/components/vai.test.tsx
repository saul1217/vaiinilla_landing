import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { Badge, Card, Chip, ChipRow, LoadingState, ThemeCycleButton, VaiButton, VaiEmptyState } from './vai';

describe('componentes base de Android', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  it('VaiButton lleva la variante y se bloquea mientras carga', () => {
    render(<VaiButton variant="coral" loading>Llamar al mesero</VaiButton>);
    const button = screen.getByRole('button', { name: 'Llamar al mesero' });
    expect(button).toHaveClass('vai-button', 'vai-button--coral');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('Card pinta título y descripción', () => {
    render(<Card tone="hero" title="Tu pedido" description="Listo en 5 minutos" />);
    expect(screen.getByRole('heading', { name: 'Tu pedido' }).closest('section')).toHaveClass('vai-card', 'vai-card--hero');
    expect(screen.getByText('Listo en 5 minutos')).toBeInTheDocument();
  });

  it('Chip anuncia si está elegido y avisa el toque', async () => {
    const onClick = vi.fn();
    render(
      <ChipRow label="Categorías">
        <Chip selected onClick={onClick}>Tacos</Chip>
        <Chip selected={false} onClick={onClick}>Bebidas</Chip>
      </ChipRow>,
    );
    expect(screen.getByRole('group', { name: 'Categorías' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tacos' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Badge no aparece en cero y tope en 99+', () => {
    const { rerender, container } = render(<Badge count={0} label="Sin productos" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Badge count={120} label="120 productos" />);
    expect(screen.getByRole('img', { name: '120 productos' })).toHaveTextContent('99+');
  });

  it('VaiEmptyState muestra el mensaje y la acción', () => {
    render(<VaiEmptyState icon={<svg />} title="Sin pedidos" message="Aquí verás tus pedidos." action={<VaiButton>Pedir</VaiButton>} />);
    expect(screen.getByRole('heading', { name: 'Sin pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir' })).toBeInTheDocument();
  });

  it('LoadingState anuncia solo la etiqueta', () => {
    render(<LoadingState label="Cargando menú" cards={2} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando menú');
    expect(status.querySelectorAll('.vai-skeleton--card')).toHaveLength(2);
  });

  it('ThemeCycleButton rota el tema como Android', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeCycleButton />
      </ThemeProvider>,
    );
    const button = screen.getByRole('button', { name: 'Tema: Sistema. Cambiar a Claro' });
    await user.click(button);
    expect(button).toHaveAccessibleName('Tema: Claro. Cambiar a Oscuro');
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAccessibleName('Tema: AMOLED. Cambiar a Sistema');
    expect(localStorage.getItem('vaiinilla.buyer.theme.v1')).toBe('amoled');
  });
});
