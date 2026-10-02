import { describe, expect, it, vi } from 'vitest';
import { beginMotion, onMotionChange } from './motion-activity';

describe('señal de animación en curso', () => {
  it('avisa al empezar la primera y al terminar la última, una sola vez cada una', () => {
    const listener = vi.fn();
    const stop = onMotionChange(listener);
    const endA = beginMotion();
    const endB = beginMotion();
    endA();
    endA();
    expect(listener.mock.calls).toEqual([[true]]);
    endB();
    expect(listener.mock.calls).toEqual([[true], [false]]);
    stop();
  });
});
