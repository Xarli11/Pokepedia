import { describe, it, expect } from 'vitest';
import { LEARN_METHOD_ORDER, learnMethodLabel, learnMethodIndex, learnMethodByIndex } from './moveLearnMethods';

describe('learn method table', () => {
  it('has a unique, stable index for every method (the generator and the decoder share this exact order)', () => {
    expect(new Set(LEARN_METHOD_ORDER).size).toBe(LEARN_METHOD_ORDER.length);
  });

  it('labels every known method in both languages', () => {
    for (const m of LEARN_METHOD_ORDER) {
      expect(learnMethodLabel(m, 'es')).not.toBe(m.replace(/-/g, ' '));
      expect(learnMethodLabel(m, 'en')).not.toBe(m.replace(/-/g, ' '));
    }
    expect(learnMethodLabel('level-up', 'es')).toBe('Nivel');
    expect(learnMethodLabel('machine', 'en')).toBe('TM/HM/TR');
    expect(learnMethodLabel('egg', 'es')).toBe('Huevo');
    expect(learnMethodLabel('tutor', 'en')).toBe('Tutor');
  });

  it('falls back to a formatted slug for a genuinely unknown method', () => {
    expect(learnMethodLabel('made-up-method', 'es')).toBe('made up method');
  });

  it('index round-trips through the shared order table', () => {
    for (let i = 0; i < LEARN_METHOD_ORDER.length; i++) {
      expect(learnMethodIndex(LEARN_METHOD_ORDER[i])).toBe(i);
      expect(learnMethodByIndex(i)).toBe(LEARN_METHOD_ORDER[i]);
    }
    expect(learnMethodIndex('not-a-real-method')).toBe(-1);
  });
});
