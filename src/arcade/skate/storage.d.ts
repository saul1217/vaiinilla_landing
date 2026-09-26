export interface SkateSave { best: number; level: number; done: string[] }
export function loadProgress(): SkateSave;
export function saveProgress(save: SkateSave): void;
