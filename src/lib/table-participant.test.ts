import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  dropTableParticipantOnSessionChange,
  forgetTableParticipant,
  readTableParticipant,
  rememberTableParticipant,
  tableParticipantFor,
} from './table-participant';

const KEY = 'vaiinilla.buyer.table-participant.v1';

describe('table-participant', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('guarda y lee la identidad', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-1', alias: 'Kikin' });
    expect(readTableParticipant()).toMatchObject({ alias: 'Kikin', participanteId: 'p-1' });
  });

  it('vale solo si la sesión coincide; si cambió se borra', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-vieja', participanteId: 'p-1', alias: 'Kikin' });
    expect(tableParticipantFor('demo-a', 5, 'ses-nueva')).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('la identidad vigente se conserva', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-1', alias: 'Kikin' });
    expect(tableParticipantFor('demo-a', 5, 'ses-5')?.alias).toBe('Kikin');
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('slug o espacio distinto no vale (y no se borra lo de otra mesa)', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-1', alias: 'Kikin' });
    expect(tableParticipantFor('otro', 5, 'ses-5')).toBeNull();
    expect(tableParticipantFor('demo-a', 9, 'ses-5')).toBeNull();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('dropTableParticipantOnSessionChange borra cuando la sesión cambió', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-vieja', participanteId: 'p-1', alias: 'Kikin' });
    dropTableParticipantOnSessionChange('ses-nueva');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('dropTableParticipantOnSessionChange conserva cuando coincide', () => {
    rememberTableParticipant({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-1', alias: 'Kikin' });
    dropTableParticipantOnSessionChange('ses-5');
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('nunca manda un participanteId de otra sesión: sin sesionId no hay identidad', () => {
    localStorage.setItem(KEY, JSON.stringify({ slug: 'demo-a', espacioId: 5, participanteId: 'p-1', alias: 'Kikin' }));
    expect(tableParticipantFor('demo-a', 5, 'ses-5')).toBeNull();
  });

  it('contenido corrupto no rompe', () => {
    localStorage.setItem(KEY, '{no-json');
    expect(readTableParticipant()).toBeNull();
    forgetTableParticipant();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('localStorage que lanza no rompe', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denegado');
      },
      setItem: () => {
        throw new Error('denegado');
      },
      removeItem: () => {
        throw new Error('denegado');
      },
    };
    vi.stubGlobal('localStorage', throwing);
    expect(readTableParticipant()).toBeNull();
    expect(() =>
      rememberTableParticipant({ slug: 's', espacioId: 1, sesionId: 'x', participanteId: 'p', alias: 'A' }),
    ).not.toThrow();
    expect(() => forgetTableParticipant()).not.toThrow();
    expect(tableParticipantFor('s', 1, 'x')).toBeNull();
  });
});
