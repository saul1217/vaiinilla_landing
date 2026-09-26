import type { SkateRun } from './world';
export interface SkateMission { id: string; target: number; label: string }
export function missionsFor(level: number): SkateMission[];
export function progress(mission: SkateMission, run: SkateRun): { v: number; done: boolean };
