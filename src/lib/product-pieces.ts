// Algunos productos traen sus piezas en el nombre ("Tacos dorados de res (5)"): el nombre
// se muestra limpio y las piezas aparte, en gris.
const PIECES = /\s*\((\d+)\)\s*$/;

export interface ProductLabel {
  name: string;
  pieces: number | null;
}

export function splitPieces(raw: string): ProductLabel {
  const match = PIECES.exec(raw);
  if (!match?.[1]) return { name: raw.trim(), pieces: null };
  return { name: raw.slice(0, match.index).trim(), pieces: Number(match[1]) };
}

export function piecesLabel(pieces: number): string {
  return pieces === 1 ? '1 pz' : `${pieces} pzs`;
}
