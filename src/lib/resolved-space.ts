export interface ResolvedTableSpace {
  espacio_id: number;
  espacio_nombre: string;
  establecimiento_slug: string;
  establecimiento_nombre: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function normalizeResolvedSpace(
  payload: unknown,
  fallbackSlug?: string,
): ResolvedTableSpace {
  const root = asRecord(payload) ?? {};
  const espacio = asRecord(root.espacio) ?? root;
  const establecimiento = asRecord(root.establecimiento) ?? asRecord(root.cafeteria) ?? {};
  const espacioId = asId(espacio.espacio_id) ?? asId(espacio.id) ?? asId(root.espacio_id);
  const slug =
    asString(establecimiento.slug) ??
    asString(root.establecimiento_slug) ??
    asString(root.slug) ??
    fallbackSlug ??
    null;
  const nombre =
    asString(espacio.nombre) ?? asString(root.espacio_nombre) ?? asString(root.nombre) ?? 'Mesa';
  if (espacioId == null || !slug) {
    throw new Error('No encontramos esa mesa. Revisa el código e inténtalo de nuevo.');
  }
  return {
    espacio_id: espacioId,
    espacio_nombre: nombre,
    establecimiento_slug: slug,
    establecimiento_nombre: asString(establecimiento.nombre) ?? asString(root.establecimiento_nombre),
  };
}
