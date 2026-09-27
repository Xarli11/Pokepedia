import { describe, it, expect } from 'vitest';
import {
  GAME_CONTEXTS,
  contextForVersionGroup,
  gameContextById,
  gameContextLabel,
  gameContextRank,
  availableContextsForPokemon,
  defaultGameContextForPokemon,
} from './gameContext';
import { VERSION_GROUP_ORDER } from './versionGroups';

describe('game context modeling', () => {
  it('every version group belongs to exactly one context', () => {
    const seen = new Map<string, string>();
    for (const context of GAME_CONTEXTS) {
      for (const revision of context.revisions) {
        expect(seen.has(revision), `${revision} already in ${seen.get(revision)}`).toBe(false);
        seen.set(revision, context.id);
      }
    }
    // Every known version group is covered by some context.
    for (const vg of VERSION_GROUP_ORDER) expect(seen.has(vg), vg).toBe(true);
  });

  it('has unique context ids and each id is its own first revision', () => {
    const ids = GAME_CONTEXTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of GAME_CONTEXTS) expect(c.revisions[0]).toBe(c.id);
  });

  it('revisions within a context are chronologically ordered', () => {
    for (const c of GAME_CONTEXTS) {
      const ranks = c.revisions.map((v) => VERSION_GROUP_ORDER.indexOf(v));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('folds Sword/Shield, Scarlet/Violet and Legends: Z-A DLC into their base context', () => {
    expect(contextForVersionGroup('the-isle-of-armor')?.id).toBe('sword-shield');
    expect(contextForVersionGroup('the-crown-tundra')?.id).toBe('sword-shield');
    expect(contextForVersionGroup('the-teal-mask')?.id).toBe('scarlet-violet');
    expect(contextForVersionGroup('the-indigo-disk')?.id).toBe('scarlet-violet');
    expect(contextForVersionGroup('mega-dimension')?.id).toBe('legends-za');
    expect(gameContextById('sword-shield')?.revisions).toEqual(['sword-shield', 'the-isle-of-armor', 'the-crown-tundra']);
    expect(gameContextById('scarlet-violet')?.revisions).toEqual(['scarlet-violet', 'the-teal-mask', 'the-indigo-disk']);
    expect(gameContextById('legends-za')?.revisions).toEqual(['legends-za', 'mega-dimension']);
  });

  it('classifies spin-offs and battle games, never eligible as default', () => {
    expect(gameContextById('colosseum')?.kind).toBe('spin-off');
    expect(gameContextById('xd')?.kind).toBe('spin-off');
    expect(gameContextById('champions')?.kind).toBe('battle');
    expect(gameContextById('colosseum')?.defaultEligible).toBe(false);
    expect(gameContextById('xd')?.defaultEligible).toBe(false);
    expect(gameContextById('champions')?.defaultEligible).toBe(false);
    expect(gameContextById('sword-shield')?.defaultEligible).toBe(true);
    expect(gameContextById('scarlet-violet')?.defaultEligible).toBe(true);
  });

  it('DLC-only contexts do not exist standalone: no context is keyed by a DLC revision', () => {
    for (const dlc of ['the-isle-of-armor', 'the-crown-tundra', 'the-teal-mask', 'the-indigo-disk', 'mega-dimension']) {
      expect(gameContextById(dlc)).toBeUndefined();
    }
  });

  it('labels a context by its base version group label', () => {
    expect(gameContextLabel('scarlet-violet', 'es')).toBe('Escarlata / Púrpura');
    expect(gameContextLabel('scarlet-violet', 'en')).toBe('Scarlet / Violet');
    expect(gameContextLabel('sword-shield', 'es')).toBe('Espada / Escudo');
  });

  it('ranks contexts chronologically by base version group', () => {
    expect(gameContextRank('scarlet-violet')).toBeGreaterThan(gameContextRank('sword-shield'));
    expect(gameContextRank('champions')).toBeGreaterThan(gameContextRank('legends-za'));
  });
});

describe('availableContextsForPokemon', () => {
  const GARCHOMP = ['black-2-white-2', 'black-white', 'brilliant-diamond-shining-pearl', 'champions',
    'diamond-pearl', 'heartgold-soulsilver', 'legends-arceus', 'omega-ruby-alpha-sapphire', 'platinum',
    'scarlet-violet', 'the-teal-mask', 'the-indigo-disk', 'sun-moon', 'sword-shield', 'ultra-sun-ultra-moon', 'x-y'];

  it('lists contexts newest first, folding DLC revisions under Scarlet/Violet', () => {
    const available = availableContextsForPokemon(GARCHOMP);
    expect(available[0].context.id).toBe('champions');
    expect(available[1].context.id).toBe('scarlet-violet');
    expect(available[1].availableRevisions).toEqual(['scarlet-violet', 'the-teal-mask', 'the-indigo-disk']);
    expect(available[1].latestRevision).toBe('the-indigo-disk');
    // No separate "Teal Mask" / "Indigo Disk" context ever appears.
    expect(available.some((a) => a.context.id === 'the-teal-mask' || a.context.id === 'the-indigo-disk')).toBe(false);
  });

  it('is order-independent with respect to the input', () => {
    const a = availableContextsForPokemon(GARCHOMP).map((x) => x.context.id);
    const b = availableContextsForPokemon([...GARCHOMP].reverse()).map((x) => x.context.id);
    expect(a).toEqual(b);
  });
});

describe('defaultGameContextForPokemon: Scarlet/Violet + DLC', () => {
  const cases = [
    ['scarlet-violet'],
    ['scarlet-violet', 'the-teal-mask'],
    ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk'],
  ];
  it('opens on the Scarlet/Violet context, using the newest revision the Pokémon has', () => {
    expect(defaultGameContextForPokemon(cases[0])).toEqual({ contextId: 'scarlet-violet', revision: 'scarlet-violet' });
    expect(defaultGameContextForPokemon(cases[1])).toEqual({ contextId: 'scarlet-violet', revision: 'the-teal-mask' });
    expect(defaultGameContextForPokemon(cases[2])).toEqual({ contextId: 'scarlet-violet', revision: 'the-indigo-disk' });
  });

  it('Champions never displaces Scarlet/Violet as the default context', () => {
    const withChampions = defaultGameContextForPokemon(['scarlet-violet', 'the-indigo-disk', 'champions']);
    expect(withChampions).toEqual({ contextId: 'scarlet-violet', revision: 'the-indigo-disk' });
  });
});

describe('defaultGameContextForPokemon: Sword/Shield + DLC', () => {
  it('opens on the Sword/Shield context, using the newest revision the Pokémon has', () => {
    expect(defaultGameContextForPokemon(['sword-shield'])).toEqual({ contextId: 'sword-shield', revision: 'sword-shield' });
    expect(defaultGameContextForPokemon(['sword-shield', 'the-isle-of-armor'])).toEqual({ contextId: 'sword-shield', revision: 'the-isle-of-armor' });
    expect(defaultGameContextForPokemon(['sword-shield', 'the-isle-of-armor', 'the-crown-tundra'])).toEqual({ contextId: 'sword-shield', revision: 'the-crown-tundra' });
  });

  it('Champions never displaces Sword/Shield as the default context', () => {
    expect(defaultGameContextForPokemon(['sword-shield', 'the-crown-tundra', 'champions'])).toEqual({ contextId: 'sword-shield', revision: 'the-crown-tundra' });
  });
});

describe('defaultGameContextForPokemon: Champions and other spin-offs', () => {
  it('stays accessible but is never the default when a main-series context exists', () => {
    const available = availableContextsForPokemon(['x-y', 'champions']);
    expect(available.map((a) => a.context.id)).toEqual(['champions', 'x-y']);
    expect(defaultGameContextForPokemon(['x-y', 'champions'])).toEqual({ contextId: 'x-y', revision: 'x-y' });
  });

  it('falls back to it when it is the only context available', () => {
    expect(defaultGameContextForPokemon(['champions'])).toEqual({ contextId: 'champions', revision: 'champions' });
    expect(defaultGameContextForPokemon(['colosseum', 'xd'])).toEqual({ contextId: 'xd', revision: 'xd' });
  });
});

describe('defaultGameContextForPokemon: fallback and edge cases', () => {
  it('a Pokémon with no eligible main-series context falls back to the most recent context of any kind', () => {
    expect(defaultGameContextForPokemon(['the-teal-mask', 'the-indigo-disk'])).toEqual({ contextId: 'scarlet-violet', revision: 'the-indigo-disk' });
  });

  it('an unrecognized version group yields no context, never throws', () => {
    expect(defaultGameContextForPokemon(['mystery-game'])).toEqual({ contextId: '', revision: '' });
    expect(availableContextsForPokemon(['mystery-game'])).toEqual([]);
  });

  it('no version groups at all yields no context', () => {
    expect(defaultGameContextForPokemon([])).toEqual({ contextId: '', revision: '' });
  });
});
