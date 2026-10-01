import type { SpaceKind } from '../types/api';

type Kind = SpaceKind | (string & {});

/** Cómo llamarle al lugar del cliente: mesa, cancha, asiento… (el `tipo` del espacio). */
export function spaceNoun(kind: Kind | null | undefined): string {
  switch (kind) {
    case 'cancha':
      return 'cancha';
    case 'asiento':
      return 'asiento';
    case 'barra':
      return 'barra';
    case 'drive_thru':
      return 'cajón';
    default:
      return 'mesa';
  }
}

/** "Abriendo tu mesa", "Abriendo tu cancha"… */
export function openingTitle(kind: Kind | null | undefined): string {
  return `Abriendo tu ${spaceNoun(kind)}`;
}

/** "El pedido se entrega en tu mesa", "…en tu asiento"… */
export function deliveredAtLabel(kind: Kind | null | undefined): string {
  return `El pedido se entrega en tu ${spaceNoun(kind)}`;
}
