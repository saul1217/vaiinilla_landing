import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionSheet } from './motion-sheet';

function Sheet({ onClosed }: { onClosed: () => void }) {
  return (
    <MotionSheet className="alumno-sheet" labelledBy="t" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div {...dragHandle} data-testid="hero">
          <h2 id="t">Producto</h2>
          <button type="button" aria-label="Cerrar" onClick={close}>
            X
          </button>
        </div>
      )}
    </MotionSheet>
  );
}

describe('MotionSheet: la X dentro de la zona de arrastre', () => {
  it('presionar la X no captura el puntero, así el clic del ratón llega al botón', () => {
    const capture = vi.fn();
    HTMLElement.prototype.setPointerCapture = capture;
    const onClosed = vi.fn();
    render(<Sheet onClosed={onClosed} />);

    const x = screen.getByRole('button', { name: 'Cerrar' });
    fireEvent.pointerDown(x, { pointerId: 1, pointerType: 'mouse', button: 0 });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(x);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('fuera de un control, el encabezado sí se puede arrastrar', () => {
    const capture = vi.fn();
    HTMLElement.prototype.setPointerCapture = capture;
    render(<Sheet onClosed={vi.fn()} />);

    fireEvent.pointerDown(screen.getByTestId('hero'), { pointerId: 1, pointerType: 'touch', button: 0 });
    expect(capture).toHaveBeenCalled();
  });
});

describe('MotionSheet: foco', () => {
  it('Escape cierra la hoja y el foco vuelve al control que la abrió', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          {open ? <Sheet onClosed={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(opener).not.toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
