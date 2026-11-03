import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartNoteInput } from './cart-page';

function Nota() {
  const [value, setValue] = useState('');
  return <CartNoteInput value={value} onChange={setValue} />;
}

describe('CartNoteInput', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ajusta su altura al contenido en cada cambio', async () => {
    const alto = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(30);
    render(<Nota />);
    const campo = screen.getByRole('textbox');
    expect(campo).toHaveStyle({ height: '30px' });
    alto.mockReturnValue(86);
    await userEvent.setup().type(campo, 'sin cebolla');
    expect(campo).toHaveStyle({ height: '86px' });
  });
});
