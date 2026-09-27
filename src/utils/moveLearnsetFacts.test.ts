import { describe, it, expect } from 'vitest';
import type { LearnsetRelation } from '../services/moveLearnsets';
import {
  availableGameContextsForMove,
  defaultGameContextForMove,
  relationsForContext,
  filterByMethod,
  methodsPresent,
} from './moveLearnsetFacts';

const rel = (pokemonId: number, method: string, versionGroup: string, level = 0): LearnsetRelation => ({ pokemonId, method, versionGroup, level });

describe('availableGameContextsForMove / defaultGameContextForMove', () => {
  it('Scarlet/Violet is the default; Champions is listed but never displaces it (reuses gameContext.ts policy)', () => {
    const relations = [
      rel(445, 'level-up', 'scarlet-violet', 34),
      rel(445, 'machine', 'champions'),
      rel(6, 'level-up', 'sword-shield', 40),
    ];
    const available = availableGameContextsForMove(relations);
    expect(available.map((a) => a.context.id)).toEqual(['champions', 'scarlet-violet', 'sword-shield']);
    expect(defaultGameContextForMove(relations)).toEqual({ contextId: 'scarlet-violet', revision: 'scarlet-violet' });
  });

  it('falls back to the most recent context of any kind when nothing main-series exists', () => {
    const relations = [rel(150, 'machine', 'champions')];
    expect(defaultGameContextForMove(relations)).toEqual({ contextId: 'champions', revision: 'champions' });
  });
});

describe('relationsForContext', () => {
  it('one entry per Pokémon even with several raw relations, combining distinct (method, level) pairs', () => {
    const relations = [
      rel(445, 'level-up', 'scarlet-violet', 34),
      rel(445, 'machine', 'scarlet-violet'),
      rel(445, 'level-up', 'the-teal-mask', 34), // same (method, level) as above -> not a second entry
    ];
    const entries = relationsForContext(relations, ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk']);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ pokemonId: 445, methods: [{ method: 'level-up', level: 34 }, { method: 'machine', level: 0 }] });
  });

  it('combines data across every revision of the context, never dropping an older revision for a newer one', () => {
    const relations = [
      rel(1, 'level-up', 'sword-shield', 16),
      rel(1, 'egg', 'the-crown-tundra'), // only in a DLC revision — must still show up
    ];
    const entries = relationsForContext(relations, ['sword-shield', 'the-isle-of-armor', 'the-crown-tundra']);
    expect(entries[0].methods).toEqual([{ method: 'level-up', level: 16 }, { method: 'egg', level: 0 }]);
  });

  it('ignores relations outside the given revisions (a different context)', () => {
    const relations = [rel(1, 'level-up', 'sword-shield', 10), rel(1, 'level-up', 'scarlet-violet', 20)];
    const entries = relationsForContext(relations, ['sword-shield']);
    expect(entries).toEqual([{ pokemonId: 1, methods: [{ method: 'level-up', level: 10 }] }]);
  });

  it('sorts level-up first, then by level; pokemon sorted by id', () => {
    const relations = [
      rel(3, 'machine', 'sword-shield'),
      rel(3, 'level-up', 'sword-shield', 50),
      rel(1, 'level-up', 'sword-shield', 1),
    ];
    const entries = relationsForContext(relations, ['sword-shield']);
    expect(entries.map((e) => e.pokemonId)).toEqual([1, 3]);
    expect(entries[1].methods).toEqual([{ method: 'level-up', level: 50 }, { method: 'machine', level: 0 }]);
  });

  it('empty when nothing matches', () => {
    expect(relationsForContext([], ['sword-shield'])).toEqual([]);
    expect(relationsForContext([rel(1, 'level-up', 'x-y', 5)], ['sword-shield'])).toEqual([]);
  });
});

describe('filterByMethod / methodsPresent', () => {
  const entries = [
    { pokemonId: 1, methods: [{ method: 'level-up', level: 10 }] },
    { pokemonId: 2, methods: [{ method: 'egg', level: 0 }] },
    { pokemonId: 3, methods: [{ method: 'level-up', level: 5 }, { method: 'machine', level: 0 }] },
  ];

  it('"all" returns everything unfiltered', () => {
    expect(filterByMethod(entries, 'all')).toEqual(entries);
  });

  it('filters to Pokémon that have that method among (possibly several) methods', () => {
    expect(filterByMethod(entries, 'level-up').map((e) => e.pokemonId)).toEqual([1, 3]);
    expect(filterByMethod(entries, 'egg').map((e) => e.pokemonId)).toEqual([2]);
    expect(filterByMethod(entries, 'tutor')).toEqual([]);
  });

  it('methodsPresent lists only methods actually used, never an empty-yielding option', () => {
    expect(methodsPresent(entries).sort()).toEqual(['egg', 'level-up', 'machine']);
    expect(methodsPresent([])).toEqual([]);
  });
});
