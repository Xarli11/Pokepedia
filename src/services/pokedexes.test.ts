import { describe, it, expect } from 'vitest';
import { POKEDEXES, pokedexLabel, pokedexRank, isMainSeriesPokedex } from './pokedexes';

describe('pokedexes metadata', () => {
  it('has unique names and both labels for every entry', () => {
    const names = POKEDEXES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const p of POKEDEXES) {
      expect(p.es).toBeTruthy();
      expect(p.en).toBeTruthy();
      expect(typeof p.mainSeries).toBe('boolean');
    }
  });

  it('excludes only the two known non-main-series dexes', () => {
    const nonMain = POKEDEXES.filter((p) => !p.mainSeries).map((p) => p.name);
    expect(nonMain.sort()).toEqual(['champions', 'conquest-gallery']);
  });

  it('isMainSeriesPokedex matches the table, false for unknown', () => {
    expect(isMainSeriesPokedex('national')).toBe(true);
    expect(isMainSeriesPokedex('kanto')).toBe(true);
    expect(isMainSeriesPokedex('conquest-gallery')).toBe(false);
    expect(isMainSeriesPokedex('champions')).toBe(false);
    expect(isMainSeriesPokedex('made-up-dex')).toBe(false);
  });

  it('labels are real localized names, not formatted slugs', () => {
    expect(pokedexLabel('national', 'es')).toBe('Nacional');
    expect(pokedexLabel('national', 'en')).toBe('National');
    expect(pokedexLabel('original-johto', 'es')).toBe('Johto Original');
    expect(pokedexLabel('galar', 'en')).toBe('Galar');
    expect(pokedexLabel('unknown-dex', 'en')).toBe('unknown dex');
  });

  it('national ranks before every regional dex; unknown dexes rank last', () => {
    expect(pokedexRank('national')).toBeLessThan(pokedexRank('kanto'));
    expect(pokedexRank('kanto')).toBeLessThan(pokedexRank('paldea'));
    expect(pokedexRank('made-up-dex')).toBeGreaterThan(pokedexRank('champions'));
  });
});
