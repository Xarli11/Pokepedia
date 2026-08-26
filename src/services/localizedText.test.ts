import { describe, it, expect } from 'vitest';
import {
  selectLocalizedEffect,
  selectLocalizedFlavor,
  isBlockedCombination,
  BLOCKED_COMBINATIONS,
  type FlavorEntry,
} from './localizedText';

import lifeOrb from '../utils/__fixtures__/items/life-orb.json';
import choiceSpecs from '../utils/__fixtures__/items/choice-specs.json';
import choiceScarf from '../utils/__fixtures__/items/choice-scarf.json';
import lightClay from '../utils/__fixtures__/items/light-clay.json';
import powerHerb from '../utils/__fixtures__/items/power-herb.json';
import razorFang from '../utils/__fixtures__/items/razor-fang.json';
import airBalloon from '../utils/__fixtures__/items/air-balloon.json';
import heavyDutyBoots from '../utils/__fixtures__/items/heavy-duty-boots.json';
import eviolite from '../utils/__fixtures__/items/eviolite.json';
import assaultVest from '../utils/__fixtures__/items/assault-vest.json';
import venusaurite from '../utils/__fixtures__/items/venusaurite.json';
import charizarditeX from '../utils/__fixtures__/items/charizardite-x.json';
import alakazite from '../utils/__fixtures__/items/alakazite.json';
import protectivePads from '../utils/__fixtures__/items/protective-pads.json';

const ITEM_OPTS = { entityType: 'item', requestedLang: 'es' } as const;

// ---------------------------------------------------------------------
// Policy table itself: pin down exactly what is (and isn't) blocked, so an
// accidental widening/narrowing of the denylist is caught immediately.
// ---------------------------------------------------------------------
describe('BLOCKED_COMBINATIONS — the policy is exactly what the evidence supports', () => {
  it('blocks the one proven combination: item + flavor + es + x-y', () => {
    expect(isBlockedCombination('item', 'flavor', 'es', 'x-y')).toBe(true);
  });

  it('does NOT block es/x-y for other entity types (no swap evidence found there)', () => {
    expect(isBlockedCombination('ability', 'flavor', 'es', 'x-y')).toBe(false);
    expect(isBlockedCombination('move', 'flavor', 'es', 'x-y')).toBe(false);
  });

  it('does NOT block other version groups for items (only x-y is proven bad)', () => {
    expect(isBlockedCombination('item', 'flavor', 'es', 'sun-moon')).toBe(false);
    expect(isBlockedCombination('item', 'flavor', 'es', 'sword-shield')).toBe(false);
    expect(isBlockedCombination('item', 'flavor', 'es', 'black-white')).toBe(false);
  });

  it('does NOT block other languages at x-y (FR/DE/IT x-y divergences are wording revisions, not swaps)', () => {
    expect(isBlockedCombination('item', 'flavor', 'fr', 'x-y')).toBe(false);
    expect(isBlockedCombination('item', 'flavor', 'de', 'x-y')).toBe(false);
    expect(isBlockedCombination('item', 'flavor', 'it', 'x-y')).toBe(false);
  });

  it('does not block the effect field at all (effect_entries has no version_group / no observed corruption)', () => {
    expect(isBlockedCombination('item', 'effect', 'es', 'x-y')).toBe(false);
  });

  it('contains exactly one entry — any addition must come with the same standard of evidence', () => {
    expect(BLOCKED_COMBINATIONS).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------
// Golden fixtures: real PokeAPI data for items spanning different
// generations/categories. Each fixture is the exact JSON returned by
// PokeAPI (trimmed to the relevant fields), not hand-written.
// ---------------------------------------------------------------------
const GOLDEN_ITEMS = [
  { fixture: lifeOrb, slug: 'life-orb', effectKeyword: /HP/i, expectFlavorVg: 'sword-shield' },
  { fixture: choiceSpecs, slug: 'choice-specs', effectKeyword: /Special Attack/i, expectFlavorVg: 'sword-shield' },
  { fixture: choiceScarf, slug: 'choice-scarf', effectKeyword: /Speed/i, expectFlavorVg: 'sword-shield' },
  { fixture: lightClay, slug: 'light-clay', effectKeyword: /Light Screen/i, expectFlavorVg: 'sword-shield' },
  { fixture: powerHerb, slug: 'power-herb', effectKeyword: /charge move/i, expectFlavorVg: 'sword-shield' },
  { fixture: razorFang, slug: 'razor-fang', effectKeyword: /flinch/i, expectFlavorVg: 'sword-shield' },
  { fixture: airBalloon, slug: 'air-balloon', effectKeyword: /Ground/i, expectFlavorVg: 'sword-shield' },
  { fixture: heavyDutyBoots, slug: 'heavy-duty-boots', effectKeyword: null, expectFlavorVg: 'sword-shield' },
  { fixture: eviolite, slug: 'eviolite', effectKeyword: /Defense/i, expectFlavorVg: 'sword-shield' },
  { fixture: assaultVest, slug: 'assault-vest', effectKeyword: /Special Defense/i, expectFlavorVg: 'sword-shield' },
] as const;

describe('selectLocalizedEffect — item correcto -> efecto correcto, nunca confundido con flavor', () => {
  it.each(GOLDEN_ITEMS)('$slug: mechanical effect comes from effect_entries only', ({ fixture, effectKeyword }) => {
    const effect = selectLocalizedEffect(fixture.effect_entries as any, ITEM_OPTS);
    if (effectKeyword === null) {
      expect(effect).toBeNull(); // heavy-duty-boots genuinely has no effect_entries in PokeAPI
      return;
    }
    expect(effect).not.toBeNull();
    expect(effect!.fieldType).toBe('effect');
    expect(effect!.source).toBe('effect_entries');
    expect(effect!.text).toMatch(effectKeyword);
  });

  it('falls back to EN when ES is unavailable, and reports it via provenance', () => {
    // None of PokeAPI's held-item effect_entries ship Spanish text.
    const effect = selectLocalizedEffect(lifeOrb.effect_entries as any, ITEM_OPTS);
    expect(effect!.language).toBe('en');
    expect(effect!.fallbackUsed).toBe(true);
  });

  it('returns null instead of fabricating text when no entries exist', () => {
    expect(selectLocalizedEffect([], ITEM_OPTS)).toBeNull();
    expect(selectLocalizedEffect(undefined, ITEM_OPTS)).toBeNull();
  });
});

describe('selectLocalizedFlavor — never surfaces the blocked es/x-y entry, picks the right version_group', () => {
  it.each(GOLDEN_ITEMS)('$slug: flavor resolves to $expectFlavorVg, never the x-y entry', ({ fixture, expectFlavorVg }) => {
    const flavor = selectLocalizedFlavor(fixture.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor).not.toBeNull();
    expect(flavor!.fieldType).toBe('flavor');
    expect(flavor!.versionGroup).toBe(expectFlavorVg);
    expect(flavor!.versionGroup).not.toBe('x-y');
  });

  it('regression: the x-y entry is provably a different item\'s text and must never win', () => {
    const flavor = selectLocalizedFlavor(assaultVest.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor!.text).not.toContain('Megapiedra');
    expect(flavor!.text).toContain('Defensa Especial');
  });
});

describe('no cruzar efectos entre objetos — mega stone triangle (venusaurite / charizardite-x / alakazite)', () => {
  // Each stone's x-y ES entry is a different, real stone's description.
  // The naive "first match" behavior would have each stone announce the
  // WRONG Pokémon; the fix must resolve each to its own correct target.
  it('venusaurite resolves to Venusaur, not the x-y entry\'s Charizard', () => {
    const flavor = selectLocalizedFlavor(venusaurite.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor!.text).toContain('Venusaur');
    expect(flavor!.text).not.toContain('Charizard');
  });

  it('charizardite-x resolves to Charizard, not the x-y entry\'s Alakazam', () => {
    const flavor = selectLocalizedFlavor(charizarditeX.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor!.text).toContain('Charizard');
    expect(flavor!.text).not.toContain('Alakazam');
  });

  it('alakazite resolves to Alakazam, not the x-y entry\'s generic "ordinary-looking stone" text', () => {
    const flavor = selectLocalizedFlavor(alakazite.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor!.text).toContain('Alakazam');
    expect(flavor!.versionGroup).not.toBe('x-y');
  });
});

describe('items introduced after x-y are never wrongly blocked', () => {
  it('protective-pads (introduced in sun-moon, no x-y entry exists) selects its own correct sun-moon-era text', () => {
    const flavor = selectLocalizedFlavor(protectivePads.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor).not.toBeNull();
    expect(flavor!.text).toContain('contacto directo');
    expect(flavor!.fallbackUsed).toBe(false);

    const effect = selectLocalizedEffect(protectivePads.effect_entries as any, ITEM_OPTS);
    expect(effect!.text).toMatch(/contact moves/i);
  });
});

describe('selección localizada estable — determinism and purity', () => {
  it('calling twice with the same input yields byte-identical results', () => {
    const a = selectLocalizedFlavor(lifeOrb.flavor_text_entries as any, ITEM_OPTS);
    const b = selectLocalizedFlavor(lifeOrb.flavor_text_entries as any, ITEM_OPTS);
    expect(a).toEqual(b);
  });
});

describe('un cambio en el orden del array de PokeAPI no cambia el resultado', () => {
  it('reversing the entries array yields the same selection', () => {
    const forward = selectLocalizedFlavor(assaultVest.flavor_text_entries as any, ITEM_OPTS);
    const reversed = selectLocalizedFlavor([...(assaultVest.flavor_text_entries as any)].reverse(), ITEM_OPTS);
    expect(reversed).toEqual(forward);
  });

  it('shuffling the entries array yields the same selection', () => {
    const entries = assaultVest.flavor_text_entries as any[];
    // deterministic "shuffle": rotate by 2
    const rotated = [...entries.slice(2), ...entries.slice(0, 2)];
    const a = selectLocalizedFlavor(entries, ITEM_OPTS);
    const b = selectLocalizedFlavor(rotated, ITEM_OPTS);
    expect(b).toEqual(a);
  });
});

describe('una entrada de una versión bloqueada no gana la selección, aunque esté primera o última en el array', () => {
  const goodEntry: FlavorEntry = {
    text: 'Correct, reliable description.',
    language: { name: 'es' },
    version_group: { name: 'sun-moon' },
  };
  const blockedEntry: FlavorEntry = {
    text: 'Wrong, denylisted description.',
    language: { name: 'es' },
    version_group: { name: 'x-y' },
  };

  it('blocked entry first in the array still loses to the good entry', () => {
    const result = selectLocalizedFlavor([blockedEntry, goodEntry], ITEM_OPTS);
    expect(result!.text).toBe(goodEntry.text);
  });

  it('blocked entry last in the array still loses to the good entry', () => {
    const result = selectLocalizedFlavor([goodEntry, blockedEntry], ITEM_OPTS);
    expect(result!.text).toBe(goodEntry.text);
  });

  it('when the blocked entry is the ONLY candidate for that language, it is rejected and language fallback kicks in', () => {
    const enEntry: FlavorEntry = {
      text: 'English fallback description.',
      language: { name: 'en' },
      version_group: { name: 'x-y' },
    };
    const result = selectLocalizedFlavor([blockedEntry, enEntry], ITEM_OPTS);
    expect(result!.language).toBe('en');
    expect(result!.fallbackUsed).toBe(true);
    expect(result!.text).toBe(enEntry.text);
  });

  it('when NO language has a reliable entry, returns null rather than a probably-wrong text', () => {
    const result = selectLocalizedFlavor([blockedEntry], ITEM_OPTS);
    expect(result).toBeNull();
  });
});

describe('provenance fields are always populated correctly', () => {
  it('flavor provenance carries source/language/versionGroup/fallbackUsed/fieldType', () => {
    const flavor = selectLocalizedFlavor(lifeOrb.flavor_text_entries as any, ITEM_OPTS);
    expect(flavor).toMatchObject({
      source: 'flavor_text_entries',
      language: 'es',
      versionGroup: 'sword-shield',
      fallbackUsed: false,
      fieldType: 'flavor',
    });
  });

  it('effect provenance reports the fallback language and no versionGroup', () => {
    const effect = selectLocalizedEffect(lifeOrb.effect_entries as any, ITEM_OPTS);
    expect(effect).toMatchObject({
      source: 'effect_entries',
      language: 'en',
      versionGroup: undefined,
      fallbackUsed: true,
      fieldType: 'effect',
    });
  });
});
