export type ArcadeKey = 'flappy' | 'skate' | 'apila' | 'gravedad' | 'galaxia';

export declare const ARCADE_GAMES: { key: ArcadeKey; label: string; tag: string }[];

export interface ArcadeHandle {
  load(key: ArcadeKey): void;
  /** Returns true when sound is now muted. */
  toggleMute(): boolean;
  /** While another page animation runs, an arcade nobody is playing stops drawing. */
  setQuiet(on: boolean): void;
  destroy(): void;
}

export declare function mountArcade(canvas: HTMLCanvasElement, options?: { game?: ArcadeKey }): ArcadeHandle | null;
