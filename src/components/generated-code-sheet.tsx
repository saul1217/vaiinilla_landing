import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../lib/api-error';
import type { LinkCode } from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { ParentSheet } from './parent-sheet';

/** Un código recién sacado del servidor (invitar a otro tutor, su propia cuenta o «Código para mi tutor»). */
export function GeneratedCodeSheet({
  id,
  title,
  lead,
  load,
  onClosed,
}: {
  id: string;
  title: string;
  lead: string;
  load: (idempotencyKey: string) => Promise<LinkCode>;
  onClosed: () => void;
}) {
  const [code, setCode] = useState<LinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(createIdempotencyKey);

  const fetchCode = useCallback(async () => {
    setError(null);
    try {
      setCode(await load(key));
    } catch (cause) {
      setError(errorMessage(cause));
    }
    // `load` cambia en cada render del padre; el código depende solo de la llave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void fetchCode();
  }, [fetchCode]);

  return (
    <ParentSheet id={id} title={title} lead={lead} onClosed={onClosed}>
      {() => (
        <>
          {code ? (
            <div className="parent-sheet__code" role="status">
              <strong aria-label={`Código ${code.code.split('').join(' ')}`}>{code.code}</strong>
              <span className="alumno-muted">Dura 15 minutos y sirve una sola vez.</span>
            </div>
          ) : error ? null : (
            <p className="alumno-muted" role="status">
              Sacando el código…
            </p>
          )}
          {error ? (
            <>
              <p className="alumno-error" role="alert">
                {error}
              </p>
              <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setKey(createIdempotencyKey())}>
                Reintentar
              </button>
            </>
          ) : null}
        </>
      )}
    </ParentSheet>
  );
}