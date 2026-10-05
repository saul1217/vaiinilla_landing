// Identidad local del participante de la mesa: solo para mostrar rápido
// "¿Continuar como X?" y detectar cambio de sesión. La verdad es el servidor
// (`yo` de TableSession / `mi_participante` de SharedTable): si `sesionId` no
// coincide con el `sesion_id` del servidor (mesa cerrada / nueva sesión), la
// identidad se borra y no se usa. Nunca mandes un participanteId de otra sesión.
const KEY = 'vaiinilla.buyer.table-participant.v1';

export interface TableParticipantIdentity {
  slug: string;
  espacioId: number;
  sesionId: string;
  participanteId: string;
  alias: string;
}

function isIdentity(value: unknown): value is TableParticipantIdentity {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' &&
    typeof v.espacioId === 'number' &&
    typeof v.sesionId === 'string' &&
    typeof v.participanteId === 'string' &&
    typeof v.alias === 'string'
  );
}

export function readTableParticipant(): TableParticipantIdentity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * La identidad vigente para esta mesa y sesión, o null: slug/espacio distinto,
 * sesión distinta (se borra) o alias vacío no valen.
 */
export function tableParticipantFor(slug: string, espacioId: number, sesionId: string): TableParticipantIdentity | null {
  const stored = readTableParticipant();
  if (!stored) return null;
  if (stored.slug !== slug || stored.espacioId !== espacioId) return null;
  if (!stored.sesionId || stored.sesionId !== sesionId) {
    forgetTableParticipant();
    return null;
  }
  return stored;
}

export function rememberTableParticipant(identity: TableParticipantIdentity): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Sin almacenamiento: la identidad dura lo que la memoria del flujo.
  }
}

export function forgetTableParticipant(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}

/**
 * Al detectar que la sesión cambió (`sesion_id` distinto en `currentTable` o
 * `tableSession`), borra la identidad local.
 */
export function dropTableParticipantOnSessionChange(sesionId: string | null | undefined): void {
  if (!sesionId) return;
  const stored = readTableParticipant();
  if (stored && stored.sesionId !== sesionId) forgetTableParticipant();
}
