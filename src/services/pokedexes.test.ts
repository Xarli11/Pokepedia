import { describe, it, expect } from 'vitest';
import { POKEDEXES, pokedexLabel, pokedexRank, isMainSeriesPokedex, pokedexVersionGroups, isGlobalPokedex } from './pokedexes';

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

  // Fase 2E: Game Context filtering metadata (verified live against every
  // /pokedex/{name}, 2026-09-27).
  it('every entry has a versionGroups array and a boolean global flag', () => {
    for (const p of POKEDEXES) {
      expect(Array.isArray(p.versionGroups)).toBe(true);
      expect(typeof p.global).toBe('boolean');
    }
  });

  it('national is the only global dex (PokeAPI: version_groups: [] because it is the cross-game index by definition)', () => {
    const global = POKEDEXES.filter((p) => p.global).map((p) => p.name);
    expect(global).toEqual(['national']);
  });

  it('exactly two dexes have an empty versionGroups: national (global) and conquest-gallery (excluded upstream, not global)', () => {
    const empty = POKEDEXES.filter((p) => p.versionGroups.length === 0).map((p) => p.name).sort();
    expect(empty).toEqual(['conquest-gallery', 'national']);
    expect(isGlobalPokedex('conquest-gallery')).toBe(false);
  });

  it('every other dex (33 of 35) has at least one real version group — no undecided empty case left', () => {
    const nonEmpty = POKEDEXES.filter((p) => p.versionGroups.length > 0);
    expect(nonEmpty).toHaveLength(33);
  });

  it('pokedexVersionGroups returns the table entry, undefined for an unrecognized name', () => {
    expect(pokedexVersionGroups('paldea')).toEqual(['scarlet-violet']);
    expect(pokedexVersionGroups('isle-of-armor')).toEqual(['sword-shield', 'the-isle-of-armor']);
    expect(pokedexVersionGroups('national')).toEqual([]);
    expect(pokedexVersionGroups('made-up-dex')).toBeUndefined();
  });

  it('isGlobalPokedex is false for unknown/unrecognized names, never a guess', () => {
    expect(isGlobalPokedex('made-up-dex')).toBe(false);
    expect(isGlobalPokedex('paldea')).toBe(false);
  });
});
