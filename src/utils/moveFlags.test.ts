import { describe, it, expect } from 'vitest';
import { MOVE_FLAG_ORDER, moveFlagLabel, moveFlagIndex, moveFlagByIndex } from './moveFlags';

describe('move flag table', () => {
  it('has a unique, stable index for every flag (the generator and the decoder share this exact order)', () => {
    expect(new Set(MOVE_FLAG_ORDER).size).toBe(MOVE_FLAG_ORDER.length);
  });

  it('labels every known flag in both languages', () => {
    for (const f of MOVE_FLAG_ORDER) {
      expect(moveFlagLabel(f, 'es')).not.toBe(f);
      expect(moveFlagLabel(f, 'en')).not.toBe(f);
    }
    expect(moveFlagLabel('contact', 'es')).toBe('Contacto');
    expect(moveFlagLabel('contact', 'en')).toBe('Contact');
    expect(moveFlagLabel('protect', 'en')).toBe('Blocked by Protect');
    expect(moveFlagLabel('sound', 'es')).toBe('Sonido');
  });

  it('falls back to the slug itself for a genuinely unknown flag (never invented)', () => {
    expect(moveFlagLabel('made-up-flag', 'es')).toBe('made-up-flag');
  });

  it('index round-trips through the shared order table', () => {
    for (let i = 0; i < MOVE_FLAG_ORDER.length; i++) {
      expect(moveFlagIndex(MOVE_FLAG_ORDER[i])).toBe(i);
      expect(moveFlagByIndex(i)).toBe(MOVE_FLAG_ORDER[i]);
    }
    expect(moveFlagIndex('not-a-real-flag')).toBe(-1);
    expect(moveFlagByIndex(999)).toBe('');
  });

  it('excludes competitive/battle-mechanic flags (never turns the move page into strategy analysis)', () => {
    const excluded = ['mirror', 'metronome', 'snatch', 'futuremove', 'charge', 'recharge', 'heal', 'gravity', 'minimize', 'reflectable'];
    for (const flag of excluded) {
      expect(MOVE_FLAG_ORDER as readonly string[]).not.toContain(flag);
    }
  });
});
