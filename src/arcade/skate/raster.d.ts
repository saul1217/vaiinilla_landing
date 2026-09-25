export const W: number;
export const H: number;
export interface PixelCanvas { w: number; h: number; data: Uint8ClampedArray }
export function createCanvas(w?: number, h?: number): PixelCanvas;
