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

/**
 * Espacios compartibles: varias personas piden a la misma cuenta y eligen quién
 * son al entrar. La mesa (y la barra) lo son; cancha, cajón y asiento no: ahí el
 * QR lleva directo al menú. El tipo ausente es mesa (ver `spaceNoun`).
 */
export function isSharableSpace(kind: Kind | null | undefined): boolean {
  return kind == null || kind === 'mesa' || kind === 'barra';
}
