import { describe, it, expect } from 'vitest';
import pokemonEs from '../data/generated/pokemon.es.json';
import { computeGridVisibility, cardMatchesText, formatTemplate, type GridCard } from './homeSearch';

// The Pokédex home search box is a strictly local filter over the
// currently rendered grid — real generation-4 grid (species catalog), no
// mocks, no global search index involved.
const gen4: GridCard[] = pokemonEs.rows
  .filter((r) => r[3] === 4 && !r[4])
  .map((r) => ({ name: r[0] as string, id: String(r[1]), types: ['normal'] }));
gen4.find((c) => c.name === 'garchomp')!.types = ['dragon', 'ground'];

const shown = (g: ReturnType<typeof computeGridVisibility>) => g.visible.filter(Boolean).length;

describe('home search: local filter over the current grid', () => {
  it('garchomp in its own generation: the grid narrows to just it', () => {
    const grid = computeGridVisibility(gen4, 'garchomp', 'all');
    expect(grid.textApplied).toBe(true);
    expect(shown(grid)).toBe(1);
    expect(grid.showEmpty).toBe(false);
  });

  it('garchomp while the grid is a different generation: empty, honestly (no fallback to a global result)', () => {
    const kanto = gen4.slice(0, 5).map((c) => ({ ...c, name: `x${c.id}` }));
    const grid = computeGridVisibility(kanto, 'garchomp', 'all');
    expect(grid.textApplied).toBe(true);
    expect(grid.visible.every((v) => v === false)).toBe(true);
    expect(grid.showEmpty).toBe(true);
  });

  it.each(['terremoto', 'piel tosca', 'dragón'])('a move/ability/type name (%s) is not a Pokémon match: empty grid, not a global fallback', (q) => {
    const grid = computeGridVisibility(gen4, q, 'all');
    expect(grid.showEmpty).toBe(true);
  });

  it('the type filter still owns the empty state on its own', () => {
    expect(computeGridVisibility(gen4, '', 'fire').showEmpty).toBe(true); // no fire type in this fixture
    expect(computeGridVisibility(gen4, '', 'dragon').visible.filter(Boolean)).toHaveLength(1);
  });

  it('text and type filters compose', () => {
    expect(computeGridVisibility(gen4, 'garchomp', 'dragon').showEmpty).toBe(false);
    expect(computeGridVisibility(gen4, 'garchomp', 'fire').showEmpty).toBe(true);
  });

  it('numbers work: "25", "#25", "025"', () => {
    expect(computeGridVisibility(gen4, '#445', 'all').visible.filter(Boolean)).toHaveLength(1);
    const byNumber = (q: string) => computeGridVisibility(gen4, q, 'all').visible.filter(Boolean).length;
    expect(byNumber('445')).toBe(1);
    expect(byNumber('0445')).toBe(1);
  });

  it('accents and case are ignored', () => {
    expect(cardMatchesText({ name: 'flabebe', id: '669', types: [] }, 'flabébé')).toBe(true);
    expect(cardMatchesText({ name: 'flabebe', id: '669', types: [] }, 'FLABEBE')).toBe(true);
  });

  it('an empty query shows the whole grid (subject to the type filter)', () => {
    const g = computeGridVisibility(gen4, '  ', 'all');
    expect(g.textApplied).toBe(false);
    expect(shown(g)).toBe(gen4.length);
  });
});

describe('formatTemplate', () => {
  it('substitutes every placeholder present in vars', () => {
    expect(formatTemplate('No results for "{query}" in {region}.', { query: 'Garchomp', region: 'Kanto' }))
      .toBe('No results for "Garchomp" in Kanto.');
  });
  it('leaves a placeholder empty when no var is given for it, never throwing', () => {
    expect(formatTemplate('Search Pokémon in {region}...', {})).toBe('Search Pokémon in ...');
  });
});
