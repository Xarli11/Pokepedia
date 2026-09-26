import { describe, it, expect } from 'vitest';
import {
  VERSION_GROUP_ORDER,
  versionGroupRank,
  sortVersionGroups,
  latestVersionGroup,
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

  it('picks the latest group (Garchomp-like set → champions, without it scarlet-violet)', () => {
    const garchomp = ['black-2-white-2', 'black-white', 'brilliant-diamond-shining-pearl', 'champions',
      'diamond-pearl', 'heartgold-soulsilver', 'legends-arceus', 'omega-ruby-alpha-sapphire', 'platinum',
      'scarlet-violet', 'sun-moon', 'sword-shield', 'ultra-sun-ultra-moon', 'x-y'];
    expect(latestVersionGroup(garchomp)).toBe('champions');
    expect(latestVersionGroup(garchomp.filter((v) => v !== 'champions'))).toBe('scarlet-violet');
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
