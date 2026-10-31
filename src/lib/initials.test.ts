import { describe, expect, it } from 'vitest';
import { initialsFrom } from './initials';

describe('initialsFrom', () => {
  it('uses the fallback when the name contains only whitespace', () => {
    expect(initialsFrom('   ')).toBe('A');
    expect(initialsFrom('   ', 'ana@example.test')).toBe('AN');
  });
});
