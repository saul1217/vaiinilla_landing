export interface SkateEvent { type: string; x?: number; y?: number; text?: string }
export interface SkateRun {
  score: number;
  lives: number;
  over: boolean;
  combo: number;
  bestCombo: number;
  distance: number;
  player: { y: number; vy: number; grounded: boolean; grinding: unknown };
  obstacles: { x: number; kind: string }[];
  stats: Record<string, number>;
  events: SkateEvent[];
}
export const GROUND: number;
export const PLAYER_X: number;
export function createRun(seed?: number): SkateRun;
export function step(run: SkateRun, dt: number): void;
export function pressJump(run: SkateRun): void;
export function releaseJump(run: SkateRun): void;
export function setFastFall(run: SkateRun, on: boolean): void;
export function meters(run: SkateRun): number;
