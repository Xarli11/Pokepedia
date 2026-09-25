import { describe, it, expect } from 'vitest';
import {
  buildMoveTitle,
  buildMoveFactualDescription,
  getLocalizedMoveDescription,
  resolveMoveDescription,
  type MoveFacts,
} from './moveMeta';

const surf: MoveFacts = { name: 'Surf', typeLabel: 'Agua', category: 'special', power: 90, accuracy: 100, pp: 15, priority: 0 };
const surfEn: MoveFacts = { ...surf, typeLabel: 'Water' };
const protect: MoveFacts = { name: 'Protección', typeLabel: 'Normal', category: 'status', power: null, accuracy: null, pp: 10, priority: 4 };
const protectEn: MoveFacts = { ...protect, name: 'Protect' };

describe('buildMoveTitle', () => {
  it('ES / EN, damaging and status', () => {
    expect(buildMoveTitle('es', surf)).toBe('Surf — Movimiento especial de tipo Agua');
    expect(buildMoveTitle('en', surfEn)).toBe('Surf — Water-type Special Move');
    expect(buildMoveTitle('es', protect)).toBe('Protección — Movimiento de estado de tipo Normal');
    expect(buildMoveTitle('en', protectEn)).toBe('Protect — Normal-type Status Move');
  });

  it('does not carry the brand (Layout appends it)', () => {
    expect(buildMoveTitle('es', surf)).not.toMatch(/pokepedia/i);
  });

  it('distinguishes same-named physical/special variants', () => {
    const a = buildMoveTitle('es', { ...surf, category: 'physical' });
    const b = buildMoveTitle('es', { ...surf, category: 'special' });
    expect(a).not.toBe(b);
  });
});

describe('buildMoveFactualDescription', () => {
  it('special move with everything (ES / EN)', () => {
    expect(buildMoveFactualDescription('es', surf)).toBe(
      'Surf es un movimiento de tipo Agua y categoría Especial. Tiene 90 de potencia, 100% de precisión y 15 PP.'
    );
    expect(buildMoveFactualDescription('en', surfEn)).toBe(
      'Surf is a Water-type Special move with 90 power, 100% accuracy and 15 PP.'
    );
  });

  it('status move: power/accuracy null are omitted; priority is stated', () => {
    expect(buildMoveFactualDescription('es', protect)).toBe(
      'Protección es un movimiento de tipo Normal y categoría Estado. Tiene 10 PP y prioridad +4.'
    );
    expect(buildMoveFactualDescription('en', protectEn)).toBe(
      'Protect is a Normal-type Status move with 10 PP and +4 priority.'
    );
  });

  it('accuracy null on a damaging move (Struggle-like)', () => {
    const d = buildMoveFactualDescription('en', { ...surfEn, name: 'Struggle', category: 'physical', power: 50, accuracy: null, pp: 1 });
    expect(d).toBe('Struggle is a Water-type Physical move with 50 power and 1 PP.');
  });

  it('negative priority and physical category', () => {
    const d = buildMoveFactualDescription('es', { ...surf, category: 'physical', priority: -6 });
    expect(d).toContain('categoría Físico');
    expect(d).toContain('90 de potencia, 100% de precisión, 15 PP y prioridad -6.');
  });

  it('absent fields never produce undefined/null text', () => {
    const d = buildMoveFactualDescription('es', { name: 'X', typeLabel: 'Agua', category: 'status', power: null, accuracy: null, pp: null, priority: 0 });
    expect(d).toBe('X es un movimiento de tipo Agua y categoría Estado.');
    expect(d).not.toMatch(/null|undefined|NaN/);
  });
});

describe('getLocalizedMoveDescription / resolveMoveDescription', () => {
  const entries = [
    { flavor_text: 'Una gran\fola.\n', language: { name: 'es' } },
    { flavor_text: 'A big wave.', language: { name: 'en' } },
  ];

  it('returns real text for the exact language, cleaned', () => {
    expect(getLocalizedMoveDescription(entries, 'es')).toBe('Una gran ola.');
    expect(getLocalizedMoveDescription(entries, 'en')).toBe('A big wave.');
  });

  it('never returns English text for a Spanish request', () => {
    expect(getLocalizedMoveDescription([entries[1]], 'es')).toBeNull();
  });

  it('falls back to the factual sentence in the page language', () => {
    const r = resolveMoveDescription('es', surf, [entries[1]]);
    expect(r.source).toBe('facts');
    expect(r.text).toMatch(/^Surf es un movimiento/);
    expect(resolveMoveDescription('en', surfEn, []).text).toMatch(/^Surf is a Water-type/);
    expect(resolveMoveDescription('es', surf, entries).source).toBe('flavor');
  });

  it('prefers the most recent version group, joins soft-hyphen wraps', () => {
    const list = [
      { flavor_text: 'Has a high criti\u00AD cal hit ratio.', language: { name: 'en' }, version_group: { name: 'red-blue' } },
      { flavor_text: 'Has a high critical-hit ratio.', language: { name: 'en' }, version_group: { name: 'scarlet-violet' } },
    ];
    expect(getLocalizedMoveDescription(list, 'en')).toBe('Has a high critical-hit ratio.');
    expect(getLocalizedMoveDescription([list[0]], 'en')).toBe('Has a high critical hit ratio.');
  });

  it('a "Dummy data" placeholder is not a description', () => {
    const dummy = [{ flavor_text: 'Dummy Data', language: { name: 'en' }, version_group: { name: 'sun-moon' } }];
    expect(getLocalizedMoveDescription(dummy, 'en')).toBeNull();
    expect(resolveMoveDescription('en', surfEn, dummy).source).toBe('facts');
  });

  it('skips the "move can\'t be used" boilerplate in favor of the previous real text', () => {
    const list = [
      { flavor_text: 'A real description.', language: { name: 'en' }, version_group: { name: 'sword-shield' } },
      { flavor_text: "This move can\u2019t be used. It\u2019s recommended that this move is forgotten.", language: { name: 'en' }, version_group: { name: 'scarlet-violet' } },
      { flavor_text: 'Este movimiento no se puede usar, por lo que sería mejor olvidarlo.', language: { name: 'es' }, version_group: { name: 'scarlet-violet' } },
    ];
    expect(getLocalizedMoveDescription(list, 'en')).toBe('A real description.');
    expect(getLocalizedMoveDescription(list, 'es')).toBeNull();
  });

  it('ignores blank entries', () => {
    expect(getLocalizedMoveDescription([{ flavor_text: ' \f ', language: { name: 'es' } }], 'es')).toBeNull();
  });
});
