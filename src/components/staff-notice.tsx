import type { SessionAccess } from '../types/api';
import { STAFF_PANEL_LOGIN_URL, staffSummary } from '../lib/staff-access';

/**
 * Una cuenta del equipo inició sesión en la web de compra. En vez de tratarla como cliente,
 * se le avisa y se le lleva a su panel; entrar como cliente sigue a un toque.
 */
export function StaffNotice({
  accesses,
  onContinueAsClient,
}: {
  accesses: SessionAccess[];
  onContinueAsClient: () => void;
}) {
  return (
    <div className="alumno-staff-notice alumno-arrive" role="region" aria-label="Cuenta del equipo">
      <p className="alumno-lead">
        Ya eres <strong>{staffSummary(accesses)}</strong>. Para atender mesas, cobrar o preparar pedidos usa el
        panel del equipo.
      </p>
      <a className="alumno-btn alumno-btn--lime alumno-staff-notice__panel" href={STAFF_PANEL_LOGIN_URL}>
        Ir a mi panel
      </a>
      <p className="alumno-muted alumno-staff-notice__hint">
        El panel está en otro sitio y te pedirá iniciar sesión otra vez.
      </p>
      <button className="alumno-btn alumno-btn--ghost alumno-staff-notice__client" type="button" onClick={onContinueAsClient}>
        Si quieres entrar como cliente, pica aquí
      </button>
    </div>
  );
}
