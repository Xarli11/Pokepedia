import { describe, it, expect } from 'vitest';
import {
  VERSION_GROUP_ORDER,
  versionGroupRank,
  sortVersionGroups,
  latestVersionGroup,
  defaultVersionGroup,
  isDefaultEligible,
  VERSION_GROUPS,
  versionGroupLabel,
} from './versionGroups';

describe('version group chronology', () => {
  it('has no duplicates', () => {
    expect(new Set(VERSION_GROUP_ORDER).size).toBe(VERSION_GROUP_ORDER.length);
  });

  it('orders by release, not alphabetically', () => {
    // alphabetical would put x-y before yellow and sword-shield before y
    expect(sortVersionGroups(['x-y', 'yellow', 'sword-shield', 'red-blue'])).toEqual([
      'red-blue', 'yellow', 'x-y', 'sword-shield',
    ]);
  });

  it('is independent of input order', () => {
    const a = ['scarlet-violet', 'x-y', 'platinum', 'champions', 'gold-silver'];
    expect(sortVersionGroups(a)).toEqual(sortVersionGroups([...a].reverse()));
  });

  const GARCHOMP = ['black-2-white-2', 'black-white', 'brilliant-diamond-shining-pearl', 'champions',
    'diamond-pearl', 'heartgold-soulsilver', 'legends-arceus', 'omega-ruby-alpha-sapphire', 'platinum',
    'scarlet-violet', 'sun-moon', 'sword-shield', 'ultra-sun-ultra-moon', 'x-y'];

  it('latest available is pure chronology (Champions is the newest group Garchomp has)', () => {
    expect(latestVersionGroup(GARCHOMP)).toBe('champions');
    expect(latestVersionGroup(GARCHOMP.filter((v) => v !== 'champions'))).toBe('scarlet-violet');
  });

  it('default context: Garchomp opens on Scarlet/Violet, not Champions, and Champions stays available', () => {
    expect(defaultVersionGroup(GARCHOMP)).toBe('scarlet-violet');
    expect(defaultVersionGroup([...GARCHOMP].reverse())).toBe('scarlet-violet');
    expect(sortVersionGroups(GARCHOMP)).toContain('champions');
    expect(sortVersionGroups(GARCHOMP).at(-1)).toBe('champions');
  });

  it('spin-offs and DLC never displace the latest main game', () => {
    expect(defaultVersionGroup(['sword-shield', 'the-crown-tundra', 'champions'])).toBe('sword-shield');
    expect(defaultVersionGroup(['firered-leafgreen', 'colosseum', 'xd'])).toBe('firered-leafgreen');
    expect(defaultVersionGroup(['legends-za', 'mega-dimension', 'champions'])).toBe('legends-za');
    for (const g of ['champions', 'colosseum', 'xd', 'the-isle-of-armor', 'the-crown-tundra', 'the-teal-mask', 'the-indigo-disk', 'mega-dimension']) {
      expect(isDefaultEligible(g), g).toBe(false);
    }
    for (const g of ['red-blue', 'sword-shield', 'scarlet-violet', 'legends-arceus', 'legends-za']) expect(isDefaultEligible(g), g).toBe(true);
  });

  it('falls back to the most recent available when nothing is eligible', () => {
    expect(defaultVersionGroup(['champions'])).toBe('champions');
    expect(defaultVersionGroup(['colosseum', 'xd', 'champions'])).toBe('champions');
    expect(defaultVersionGroup(['the-teal-mask', 'the-indigo-disk'])).toBe('the-indigo-disk');
    expect(defaultVersionGroup(['mystery'])).toBe('mystery');
    expect(defaultVersionGroup([])).toBe('');
  });

  it('metadata is complete: chronology, both labels and a boolean flag for every group', () => {
    expect(VERSION_GROUPS.map((g) => g.name)).toEqual([...VERSION_GROUP_ORDER]);
    for (const g of VERSION_GROUPS) {
      expect(g.es && g.en).toBeTruthy();
      expect(typeof g.defaultEligible).toBe('boolean');
    }
    expect(versionGroupLabel('champions', 'es')).toBe('Pokémon Champions');
    expect(versionGroupLabel('scarlet-violet', 'es')).toBe('Escarlata / Púrpura');
    expect(versionGroupLabel('scarlet-violet', 'en')).toBe('Scarlet / Violet');
  });

  it('places DLC / spin-off groups deliberately', () => {
    const r = versionGroupRank;
    expect(r('the-crown-tundra')).toBeGreaterThan(r('sword-shield'));
    expect(r('the-crown-tundra')).toBeLessThan(r('brilliant-diamond-shining-pearl'));
    expect(r('the-indigo-disk')).toBeGreaterThan(r('scarlet-violet'));
    expect(r('mega-dimension')).toBeGreaterThan(r('legends-za'));
    expect(r('red-green-japan')).toBeLessThan(r('red-blue'));
  });

  it('unknown groups sort before known ones and are chosen only when alone', () => {
    expect(sortVersionGroups(['x-y', 'mystery'])).toEqual(['mystery', 'x-y']);
    expect(latestVersionGroup(['mystery', 'red-blue'])).toBe('red-blue');
    expect(latestVersionGroup(['mystery'])).toBe('mystery');
    expect(latestVersionGroup([])).toBe('');
  });

  it('has an ES and EN label for every known group', () => {
    for (const v of VERSION_GROUP_ORDER) {
      expect(versionGroupLabel(v, 'es')).not.toBe(v.replace(/-/g, ' '));
      expect(versionGroupLabel(v, 'en')).not.toBe(v.replace(/-/g, ' '));
    }
    expect(versionGroupLabel('x-y', 'es')).toBe('X / Y');
    expect(versionGroupLabel('sword-shield', 'en')).toBe('Sword / Shield');
    expect(versionGroupLabel('new-game', 'en')).toBe('new game');
  });
});
