// Android SpaceCodeSheet: digit slots and a 3×4 keypad in a bottom sheet that can be dragged away.
import { MotionSheet } from './motion-sheet';

const MAX_DIGITS = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function TableCodeSheet({
  code,
  resolving,
  error,
  onChange,
  onConfirm,
  onClosed,
}: {
  code: string;
  resolving: boolean;
  error: string | null;
  onChange: (code: string) => void;
  onConfirm: () => void;
  onClosed: () => void;
}) {
  const slots = Math.min(MAX_DIGITS, Math.max(3, code.length + 1));
  const press = (digit: string) => {
    if (code.length < MAX_DIGITS) onChange(code + digit);
  };

  return (
    <MotionSheet className="alumno-sheet alumno-codesheet" labelledBy="table-code-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div
          className="alumno-codesheet__panel"
          onKeyDown={(event) => {
            if (/^\d$/.test(event.key)) press(event.key);
            else if (event.key === 'Backspace') onChange(code.slice(0, -1));
            else if (event.key === 'Enter' && code) onConfirm();
          }}
        >
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <h2 id="table-code-title">Ingresa el código de mesa</h2>
          <p className="alumno-codesheet__lead">Escribe los dígitos que aparecen en el tent card de tu mesa.</p>

          <div className="alumno-codesheet__slots" role="status" aria-label={code ? `Código ${code.split('').join(' ')}` : 'Código vacío'}>
            {Array.from({ length: slots }, (_, index) => {
              const filled = index < code.length;
              const current = index === code.length;
              return (
                <span key={index} className={filled ? 'is-filled' : current ? 'is-current' : undefined} aria-hidden="true">
                  {filled ? <span key={code[index]} className="alumno-ticker">{code[index]}</span> : current ? '•' : ''}
                </span>
              );
            })}
          </div>
          {error ? <p className="alumno-codesheet__error">{error}</p> : null}

          <div className="alumno-codesheet__keys">
            {KEYS.map((digit) => (
              <button key={digit} type="button" onClick={() => press(digit)}>
                {digit}
              </button>
            ))}
            <button type="button" className="is-muted" onClick={() => onChange(code.slice(0, -1))} aria-label="Borrar">
              BORRAR
            </button>
            <button type="button" onClick={() => press('0')}>
              0
            </button>
            <button type="button" className="is-lime" disabled={!code || resolving} onClick={onConfirm}>
              LISTO
            </button>
          </div>

          <button className="alumno-btn alumno-btn--lime alumno-codesheet__confirm" type="button" disabled={!code || resolving} onClick={onConfirm}>
            {resolving ? 'Buscando mesa…' : 'Confirmar y sentarme'}
          </button>
          <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
            Cancelar
          </button>
        </div>
      )}
    </MotionSheet>
  );
}
