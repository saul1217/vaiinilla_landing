import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const VISIBLE_MS = 3200;
const LEAVE_MS = 260;

/** Al llegar al menú desde un QR o código: confirma en qué mesa quedó el pedido. */
export function SeatedToast() {
  const location = useLocation();
  const navigate = useNavigate();
  const seatedAt = (location.state as { seatedAt?: unknown } | null)?.seatedAt;
  const [name, setName] = useState<string | null>(typeof seatedAt === 'string' ? seatedAt : null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof seatedAt !== 'string') return;
    setName(seatedAt);
    setLeaving(false);
    // Se consume una vez: recargar o volver atrás no repite el aviso.
    void navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.pathname, location.search, navigate, seatedAt]);

  useEffect(() => {
    if (!name) return;
    const leave = window.setTimeout(() => setLeaving(true), VISIBLE_MS);
    const done = window.setTimeout(() => setName(null), VISIBLE_MS + LEAVE_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [name]);

  if (!name) return null;
  return (
    <div className={leaving ? 'alumno-seated is-leaving' : 'alumno-seated'} role="status">
      <span className="alumno-seated__dot" aria-hidden="true" />
      Estás en {name}
    </div>
  );
}
