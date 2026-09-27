import { describe, it, expect } from 'vitest';
import {
  genderInfo,
  evYield,
  growthRateLabel,
  eggGroupLabel,
  regionalDexEntries,
  regionalDexEntriesForContext,
  buildPokemonFacts,
  localizedGenus,
} from './pokemonFacts';

describe('genderInfo: PokeAPI gender_rate semantics', () => {
  it('genderless (-1)', () => {
    expect(genderInfo(-1)).toEqual({ genderless: true, malePercent: null, femalePercent: null });
  });
  it('100% male (0)', () => {
    expect(genderInfo(0)).toEqual({ genderless: false, malePercent: 100, femalePercent: 0 });
  });
  it('100% female (8)', () => {
    expect(genderInfo(8)).toEqual({ genderless: false, malePercent: 0, femalePercent: 100 });
  });
  it('50/50 (4)', () => {
    expect(genderInfo(4)).toEqual({ genderless: false, malePercent: 50, femalePercent: 50 });
  });
  it('an uneven ratio (1 -> 12.5% female, e.g. Chansey-like species use 1)', () => {
    expect(genderInfo(1)).toEqual({ genderless: false, malePercent: 87.5, femalePercent: 12.5 });
  });
  it('degrades to genderless instead of NaN when the value is missing/malformed', () => {
    expect(genderInfo(undefined as unknown as number)).toEqual({ genderless: true, malePercent: null, femalePercent: null });
    expect(genderInfo(null as unknown as number)).toEqual({ genderless: true, malePercent: null, femalePercent: null });
  });
});

describe('evYield', () => {
  it('keeps only non-zero effort entries, in stat order', () => {
    const stats = [
      { effort: 0, stat: { name: 'hp' } },
      { effort: 2, stat: { name: 'attack' } },
      { effort: 0, stat: { name: 'defense' } },
      { effort: 1, stat: { name: 'speed' } },
    ];
    expect(evYield(stats)).toEqual([{ stat: 'attack', amount: 2 }, { stat: 'speed', amount: 1 }]);
  });
  it('empty when every effort is zero', () => {
    expect(evYield([{ effort: 0, stat: { name: 'hp' } }])).toEqual([]);
  });
});

describe('growthRateLabel / eggGroupLabel', () => {
  it('labels every known growth rate in both languages', () => {
    for (const name of ['slow', 'medium', 'fast', 'medium-slow', 'slow-then-very-fast', 'fast-then-very-slow']) {
      expect(growthRateLabel(name, 'es')).not.toBe(name.replace(/-/g, ' '));
      expect(growthRateLabel(name, 'en')).not.toBe(name.replace(/-/g, ' '));
    }
    expect(growthRateLabel('slow-then-very-fast', 'es')).toBe('Errático');
    expect(growthRateLabel('fast-then-very-slow', 'en')).toBe('Fluctuating');
  });

  it('falls back to a formatted slug for an unknown growth rate', () => {
    expect(growthRateLabel('made-up', 'es')).toBe('made up');
  });

  it('labels every known egg group in both languages', () => {
    for (const name of ['monster', 'ditto', 'no-eggs', 'dragon']) {
      expect(eggGroupLabel(name, 'es')).not.toBe(name.replace(/-/g, ' '));
      expect(eggGroupLabel(name, 'en')).not.toBe(name.replace(/-/g, ' '));
    }
    expect(eggGroupLabel('no-eggs', 'es')).toBe('Desconocido');
    expect(eggGroupLabel('no-eggs', 'en')).toBe('Undiscovered');
  });
});

describe('regionalDexEntries', () => {
  it('keeps main-series entries only, in stable rank order', () => {
    const raw = [
      { entry_number: 445, pokedex: { name: 'national' } },
      { entry_number: 231, pokedex: { name: 'champions' } },
      { entry_number: 109, pokedex: { name: 'extended-sinnoh' } },
      { entry_number: 5, pokedex: { name: 'original-sinnoh' } },
    ];
    expect(regionalDexEntries(raw)).toEqual([
      { pokedex: 'national', entryNumber: 445 },
      { pokedex: 'original-sinnoh', entryNumber: 5 },
      { pokedex: 'extended-sinnoh', entryNumber: 109 },
    ]);
  });

  it('is order-independent with respect to the input', () => {
    const raw = [
      { entry_number: 1, pokedex: { name: 'paldea' } },
      { entry_number: 2, pokedex: { name: 'national' } },
      { entry_number: 3, pokedex: { name: 'kanto' } },
    ];
    const a = regionalDexEntries(raw).map((e) => e.pokedex);
    const b = regionalDexEntries([...raw].reverse()).map((e) => e.pokedex);
    expect(a).toEqual(b);
  });

  it('empty when there are no pokedex numbers', () => {
    expect(regionalDexEntries([])).toEqual([]);
  });
});

// Fase 2E: regional Pokédex numbers filtered by Game Context. Real dexes
// used below (verified live against PokeAPI 2026-09-27, see pokedexes.ts):
// paldea -> ['scarlet-violet'], kitakami -> ['scarlet-violet', 'the-teal-mask'],
// galar -> ['sword-shield'], national -> [] (global).
describe('regionalDexEntriesForContext', () => {
  it('a dex whose version group is in the context revisions is kept', () => {
    const entries = [{ pokedex: 'paldea', entryNumber: 1 }];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet'])).toEqual(entries);
  });

  it('a dex with no overlap with the context revisions is dropped', () => {
    const entries = [{ pokedex: 'galar', entryNumber: 1 }];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet'])).toEqual([]);
  });

  it('a context with multiple revisions (base game + DLC) matches a dex tied to either', () => {
    // kitakami's numbers are Teal Mask DLC-only; the context's revisions
    // still include it (Scarlet/Violet's whole revision span, Fase 2 policy).
    const entries = [
      { pokedex: 'paldea', entryNumber: 1 },
      { pokedex: 'kitakami', entryNumber: 2 },
      { pokedex: 'galar', entryNumber: 3 },
    ];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet', 'the-teal-mask']).map((e) => e.pokedex)).toEqual(['paldea', 'kitakami']);
  });

  it('an explicitly global dex (national) is always kept, any context', () => {
    const entries = [{ pokedex: 'national', entryNumber: 25 }, { pokedex: 'galar', entryNumber: 55 }];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet'])).toEqual([{ pokedex: 'national', entryNumber: 25 }]);
    expect(regionalDexEntriesForContext(entries, ['sword-shield'])).toEqual([{ pokedex: 'national', entryNumber: 25 }, { pokedex: 'galar', entryNumber: 55 }]);
  });

  it('an unrecognized dex name is kept (fail open: never hide real data for a gap in the metadata table)', () => {
    const entries = [{ pokedex: 'some-future-dex-not-yet-in-our-table', entryNumber: 9 }];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet'])).toEqual(entries);
  });

  it('order is preserved from the input, never re-sorted', () => {
    const entries = [
      { pokedex: 'kitakami', entryNumber: 2 },
      { pokedex: 'national', entryNumber: 1 },
      { pokedex: 'paldea', entryNumber: 3 },
    ];
    expect(regionalDexEntriesForContext(entries, ['scarlet-violet', 'the-teal-mask']).map((e) => e.pokedex)).toEqual(['kitakami', 'national', 'paldea']);
  });

  it('empty revisions: only the global dex survives', () => {
    const entries = [{ pokedex: 'national', entryNumber: 1 }, { pokedex: 'paldea', entryNumber: 2 }];
    expect(regionalDexEntriesForContext(entries, [])).toEqual([{ pokedex: 'national', entryNumber: 1 }]);
  });

  it('empty entries: empty result regardless of revisions', () => {
    expect(regionalDexEntriesForContext([], ['scarlet-violet'])).toEqual([]);
  });
});

describe('localizedGenus', () => {
  const genera = [
    { genus: 'Pokémon Mach', language: { name: 'es' } },
    { genus: 'Mach Pokémon', language: { name: 'en' } },
  ];
  it('picks the requested language', () => {
    expect(localizedGenus(genera, 'es')).toBe('Pokémon Mach');
    expect(localizedGenus(genera, 'en')).toBe('Mach Pokémon');
  });
  it('falls back to English, then empty string', () => {
    expect(localizedGenus(genera, 'fr')).toBe('Mach Pokémon');
    expect(localizedGenus([], 'es')).toBe('');
  });
});

describe('buildPokemonFacts: real-shaped cases', () => {
  const garchomp = {
    detail: { base_experience: 270, stats: [
      { effort: 0, stat: { name: 'hp' } },
      { effort: 0, stat: { name: 'attack' } },
      { effort: 0, stat: { name: 'defense' } },
      { effort: 0, stat: { name: 'special-attack' } },
      { effort: 0, stat: { name: 'special-defense' } },
      { effort: 3, stat: { name: 'speed' } },
    ] },
    species: {
      capture_rate: 45, base_happiness: 70, hatch_counter: 40, gender_rate: 4,
      growth_rate: { name: 'slow' }, egg_groups: [{ name: 'monster' }, { name: 'dragon' }],
      pokedex_numbers: [
        { entry_number: 445, pokedex: { name: 'national' } },
        { entry_number: 109, pokedex: { name: 'extended-sinnoh' } },
      ],
      is_baby: false, is_legendary: false, is_mythical: false,
    },
  };

  it('Garchomp: 50/50 gender, dual egg group, one EV, real regional dex entries', () => {
    const facts = buildPokemonFacts(garchomp.detail as any, garchomp.species as any);
    expect(facts.training).toEqual({ baseExperience: 270, captureRate: 45, baseHappiness: 70, growthRate: 'slow', evYield: [{ stat: 'speed', amount: 3 }] });
    expect(facts.breeding).toEqual({ eggGroups: ['monster', 'dragon'], gender: { genderless: false, malePercent: 50, femalePercent: 50 }, hatchCounter: 40 });
    expect(facts.classification).toEqual({ isBaby: false, isLegendary: false, isMythical: false });
    expect(facts.regionalDex).toEqual([{ pokedex: 'national', entryNumber: 445 }, { pokedex: 'extended-sinnoh', entryNumber: 109 }]);
  });

  it('Ditto: genderless, single "ditto" egg group', () => {
    const facts = buildPokemonFacts(
      { base_experience: 101, stats: [{ effort: 1, stat: { name: 'hp' } }] } as any,
      { capture_rate: 35, base_happiness: 70, hatch_counter: 10, gender_rate: -1, growth_rate: { name: 'medium' }, egg_groups: [{ name: 'ditto' }], pokedex_numbers: [], is_baby: false, is_legendary: false, is_mythical: false } as any
    );
    expect(facts.breeding.gender).toEqual({ genderless: true, malePercent: null, femalePercent: null });
    expect(facts.breeding.eggGroups).toEqual(['ditto']);
  });

  it('a legendary with no base_happiness/hatch_counter (null in PokeAPI for many Legendaries)', () => {
    const facts = buildPokemonFacts(
      { base_experience: 306, stats: [] } as any,
      { capture_rate: 3, base_happiness: null, hatch_counter: null, gender_rate: -1, growth_rate: { name: 'slow' }, egg_groups: [{ name: 'no-eggs' }], pokedex_numbers: [], is_baby: false, is_legendary: true, is_mythical: false } as any
    );
    expect(facts.training.baseHappiness).toBeNull();
    expect(facts.breeding.hatchCounter).toBeNull();
    expect(facts.classification).toEqual({ isBaby: false, isLegendary: true, isMythical: false });
  });

  it('a baby Pokémon', () => {
    const facts = buildPokemonFacts(
      { base_experience: 41, stats: [] } as any,
      { capture_rate: 190, base_happiness: 70, hatch_counter: 10, gender_rate: 4, growth_rate: { name: 'medium' }, egg_groups: [{ name: 'undiscovered' }], pokedex_numbers: [], is_baby: true, is_legendary: false, is_mythical: false } as any
    );
    expect(facts.classification.isBaby).toBe(true);
  });

  it('handles a missing base_experience / empty pokedex_numbers without throwing', () => {
    const facts = buildPokemonFacts(
      { base_experience: null, stats: [] } as any,
      { capture_rate: 255, base_happiness: 0, hatch_counter: 20, gender_rate: 4, growth_rate: { name: 'fast' }, egg_groups: [], pokedex_numbers: undefined, is_baby: false, is_legendary: false, is_mythical: false } as any
    );
    expect(facts.training.baseExperience).toBeNull();
    expect(facts.regionalDex).toEqual([]);
  });
});
