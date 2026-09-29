export type ArcadeKey = 'flappy' | 'skate' | 'apila' | 'gravedad' | 'galaxia';

export declare const ARCADE_GAMES: { key: ArcadeKey; label: string; tag: string }[];

export interface ArcadeHandle {
  load(key: ArcadeKey): void;
  /** Returns true when sound is now muted. */
  toggleMute(): boolean;
  destroy(): void;
}

export declare function mountArcade(canvas: HTMLCanvasElement, options?: { game?: ArcadeKey }): ArcadeHandle | null;
