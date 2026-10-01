import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlidingChips } from './sliding-chips';

const items = [
  { key: '60', label: '1 h' },
  { key: '90', label: '1 h 30' },
  { key: '120', label: '2 h', disabled: true },
];

describe('SlidingChips', () => {
  it('marca la elección, avisa al tocar y no deja tocar lo deshabilitado', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SlidingChips label="Duración" items={items} selected="60" onSelect={onSelect} />);
    expect(screen.getByRole('radiogroup', { name: 'Duración' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1 h' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: '1 h 30' }));
    expect(onSelect).toHaveBeenCalledWith('90');
    await user.click(screen.getByRole('radio', { name: '2 h' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('sin elección no pinta el indicador', () => {
    const { container } = render(<SlidingChips label="Duración" items={items} selected={null} onSelect={() => undefined} />);
    expect(container.querySelector<HTMLElement>('.alumno-seg__pill')?.style.opacity).toBe('0');
    expect(screen.getAllByRole('radio').every((node) => node.getAttribute('aria-checked') === 'false')).toBe(true);
  });
});
