import { describe, it, expect } from 'vitest';
import esIndex from '../data/generated/search-index.es.json';
import pokemonEs from '../data/generated/pokemon.es.json';
import { computeGridVisibility, cardMatchesText, type GridCard } from './homeSearch';
import { prepareIndex, search } from './search';
import type { SearchIndexFile } from './searchTypes';

// The home search box = global search dropdown + (conditionally) the Pokédex
// grid. Real index, real generation-4 grid (species catalog), no mocks.
const index = prepareIndex(esIndex as unknown as SearchIndexFile);
const gen4: GridCard[] = pokemonEs.rows
  .filter((r) => r[3] === 4 && !r[4])
  .map((r) => ({ name: r[0] as string, id: String(r[1]), types: ['normal'] }));
gen4.find((c) => c.name === 'garchomp')!.types = ['dragon', 'ground'];

const home = (q: string, type = 'all') => ({ results: search(index, q, 'es'), grid: computeGridVisibility(gen4, q, type) });
const shown = (g: ReturnType<typeof computeGridVisibility>) => g.visible.filter(Boolean).length;

describe('home search: dropdown and grid stay coherent', () => {
  it('garchomp -> Pokémon result and the grid narrows to it', () => {
    const { results, grid } = home('garchomp');
    expect(results[0]).toMatchObject({ type: 'pokemon', slug: 'garchomp' });
    expect(grid.textApplied).toBe(true);
    expect(shown(grid)).toBe(1);
    expect(grid.showEmpty).toBe(false);
  });

  it('garchomp while the grid is another generation -> result stays, grid is untouched, no empty state', () => {
    const kanto = gen4.slice(0, 5).map((c) => ({ ...c, name: `x${c.id}` }));
    const grid = computeGridVisibility(kanto, 'garchomp', 'all');
    expect(grid.textApplied).toBe(false);
    expect(grid.visible.every(Boolean)).toBe(true);
    expect(grid.showEmpty).toBe(false);
  });

  it.each([
    ['terremoto', 'move', 'earthquake'],
    ['piel tosca', 'ability', 'rough-skin'],
    ['dragón', 'type', 'dragon'],
  ])('%s -> %s result, grid keeps all Pokémon and never shows "no Pokémon found"', (q, type, slug) => {
    const { results, grid } = home(q);
    expect(results[0]).toMatchObject({ type, slug });
    expect(grid.textApplied).toBe(false);
    expect(shown(grid)).toBe(gen4.length);
    expect(grid.showEmpty).toBe(false);
  });

  it('the type filter still owns the empty state', () => {
    expect(computeGridVisibility(gen4, 'terremoto', 'fire').showEmpty).toBe(true); // no fire type in this fixture
    expect(computeGridVisibility(gen4, '', 'dragon').visible.filter(Boolean)).toHaveLength(1);
    expect(computeGridVisibility(gen4, 'garchomp', 'fire').showEmpty).toBe(true);
  });

  it('numbers and accents work like in the dropdown', () => {
    expect(computeGridVisibility(gen4, '#445', 'all').visible.filter(Boolean)).toHaveLength(1);
    expect(cardMatchesText({ name: 'flabebe', id: '669', types: [] }, 'flabébé')).toBe(true);
  });

  it('an empty query shows the whole grid', () => {
    const g = computeGridVisibility(gen4, '  ', 'all');
    expect(g.textApplied).toBe(false);
    expect(shown(g)).toBe(gen4.length);
  });
});
