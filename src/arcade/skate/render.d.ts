import type { PixelCanvas } from './raster';
import type { SkateRun } from './world';
import type { SkateMission } from './missions';
import type { SkateSave } from './storage';
export interface SkateFx { parts: unknown[]; popups: unknown[] }
export function createFx(): SkateFx;
export function absorbEvents(fx: SkateFx, run: SkateRun): void;
export function drawWorld(cv: PixelCanvas, run: SkateRun, fx: SkateFx, dt: number, toast: { text: string; life: number } | null): void;
export function drawHud(cv: PixelCanvas, run: SkateRun, missions: SkateMission[], done: string[], muted: boolean, touch?: boolean): void;
export function drawTitle(cv: PixelCanvas, t: number, save: SkateSave, missions: SkateMission[], touch?: boolean): void;
export function drawGameOver(cv: PixelCanvas, run: SkateRun, t: number, save: SkateSave, newBest: boolean, levelUp: boolean, missions: SkateMission[], touch?: boolean): void;
