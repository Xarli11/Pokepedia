import { describe, it, expect } from 'vitest';
import { resolveAbilityEffect, abilityHistory } from './abilityFacts';

describe('resolveAbilityEffect', () => {
  const effectEntries = [
    { effect: 'Boosts Speed by one stage.\fAlso boosts confidence.', short_effect: 'Boosts Speed.', language: { name: 'en' } },
  ];
  const flavorEntries = [
    { flavor_text: 'Raises Speed when in trouble.', language: { name: 'en' } },
    { flavor_text: 'Aumenta la Velocidad si el rival hace algo.', language: { name: 'es' } },
  ];

  it('prefers the mechanical effect in the requested language', () => {
    const withEs = resolveAbilityEffect('en', effectEntries, flavorEntries);
    expect(withEs).toEqual({ text: 'Boosts Speed by one stage. Also boosts confidence.', source: 'effect' });
  });

  it('falls back to the English mechanical effect when the requested language has none (labelled honestly)', () => {
    const r = resolveAbilityEffect('es', effectEntries, flavorEntries);
    expect(r?.source).toBe('effect');
    expect(r?.text).toContain('Boosts Speed');
  });

  it('falls back to flavor text (marked as flavor, not effect) when no mechanical effect exists in any language', () => {
    const r = resolveAbilityEffect('es', [], flavorEntries);
    expect(r).toEqual({ text: 'Aumenta la Velocidad si el rival hace algo.', source: 'flavor' });
  });

  it('falls back to English flavor text as a last resort', () => {
    const r = resolveAbilityEffect('fr', [], flavorEntries);
    expect(r).toEqual({ text: 'Raises Speed when in trouble.', source: 'flavor' });
  });

  it('null when nothing is available in any language', () => {
    expect(resolveAbilityEffect('es', [], [])).toBeNull();
  });

  it('strips the \\f page-break marker and collapses whitespace', () => {
    const r = resolveAbilityEffect('en', [{ effect: 'Line one.\fLine  two.', language: { name: 'en' } }], []);
    expect(r?.text).toBe('Line one. Line two.');
  });
});

describe('abilityHistory', () => {
  it('normalizes effect_changes in the requested language', () => {
    const raw = [{
      version_group: { name: 'sun-moon' },
      effect_entries: [
        { effect: 'Old English text.', language: { name: 'en' } },
        { effect: 'Texto español antiguo.', language: { name: 'es' } },
      ],
    }];
    expect(abilityHistory('es', raw)).toEqual([{ versionGroup: 'sun-moon', effect: 'Texto español antiguo.' }]);
  });

  it('falls back to English when the requested language has no text for that change', () => {
    const raw = [{ version_group: { name: 'sun-moon' }, effect_entries: [{ effect: 'Old English text.', language: { name: 'en' } }] }];
    expect(abilityHistory('es', raw)).toEqual([{ versionGroup: 'sun-moon', effect: 'Old English text.' }]);
  });

  it('drops a change with no text in any language rather than showing an empty entry', () => {
    const raw = [{ version_group: { name: 'sun-moon' }, effect_entries: [{ effect: 'x', language: { name: 'fr' } }] }];
    expect(abilityHistory('es', raw)).toEqual([]);
  });

  it('empty when there are no changes', () => {
    expect(abilityHistory('es', [])).toEqual([]);
    expect(abilityHistory('es', undefined)).toEqual([]);
  });
});
