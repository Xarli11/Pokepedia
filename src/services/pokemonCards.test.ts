import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Cards for learned-by / held-by / has-ability lists: identity + types from
// data the site already loads (Showdown pokedex + species list), PokeAPI
// pokemon/{id} only as a per-entry fallback.

const API = 'https://pokeapi.co/api/v2';
const DEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';

const DEX = {
  pikachu: { types: ['Electric'], baseStats: { hp: 35 } },
  basculin: { types: ['Water'], baseStats: { hp: 70 } }, // key for basculin-red-striped is basculinredstriped -> absent
  basculinredstriped: { types: ['Water'], baseStats: { hp: 70 } },
  raichualola: { types: ['Electric', 'Psychic'], baseStats: { hp: 60 } },
};
const SPECIES = {
  count: 3,
  next: null,
  results: [
    { name: 'pikachu', url: `${API}/pokemon-species/25/` },
    { name: 'basculin', url: `${API}/pokemon-species/550/` },
    { name: 'raichu', url: `${API}/pokemon-species/26/` },
  ],
};

function detail(id: number, name: string, type = 'normal') {
  return {
    id, name, is_default: id < 10000, species: { name: 'x', url: `${API}/pokemon-species/${id}/` },
    types: [{ slot: 1, type: { name: type, url: '' } }],
    sprites: { front_default: 'f', other: { 'official-artwork': { front_default: 'a' } } },
    moves: new Array(500).fill({ move: { name: 'm', url: '' }, version_group_details: [] }),
  };
}

function stub(opts: { dex?: object | 'down'; species?: object | 'down'; details?: Record<string, object | number> }) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;
      const fail = (status: number) => ({ ok: false, status, headers: new Headers(), json: async () => ({}), text: async () => '' }) as unknown as Response;
      if (url === DEX_URL) return opts.dex === 'down' || !opts.dex ? fail(503) : ok(opts.dex);
      if (url.includes('/pokemon-species?')) return opts.species === 'down' || !opts.species ? fail(503) : ok(opts.species);
      const key = url.replace(API, '').replace(/\/$/, '');
      const hit = opts.details?.[key];
      if (typeof hit === 'number') return fail(hit);
      return hit ? ok(hit) : fail(404);
    })
  );
  return calls;
}

async function fresh() {
  vi.resetModules();
  return import('./pokeapi');
}

const refs = (...pairs: [string, number][]) => pairs.map(([name, id]) => ({ name, url: `${API}/pokemon/${id}/` }));

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getPokemonCards', () => {
  it('resolves cards with ZERO pokemon/{id} requests when Showdown and the species list are available', async () => {
    const calls = stub({ dex: DEX, species: SPECIES });
    const { getPokemonCards } = await fresh();
    const cards = await getPokemonCards(refs(['pikachu', 25], ['raichu-alola', 10100]), 40);
    expect(cards.map((c) => c.name)).toEqual(['pikachu', 'raichu-alola']);
    expect(cards[0].types.map((t) => t.type.name)).toEqual(['electric']);
    expect(cards[1].types.map((t) => t.type.name)).toEqual(['electric', 'psychic']);
    expect(calls.filter((u) => /\/pokemon\/\d+/.test(u))).toEqual([]);
  });

  it('a default form links its SPECIES slug (basculin-red-striped -> basculin), other forms keep their own', async () => {
    stub({ dex: DEX, species: SPECIES });
    const { getPokemonCards } = await fresh();
    const { canonicalPokemonSlug } = await import('../utils/seo');
    const cards = await getPokemonCards(refs(['basculin-red-striped', 550], ['raichu-alola', 10100]), 40);
    expect(cards.map(canonicalPokemonSlug)).toEqual(['basculin', 'raichu-alola']);
  });

  it('sprites are the same official-artwork URLs as before (by id)', async () => {
    stub({ dex: DEX, species: SPECIES });
    const { getPokemonCards } = await fresh();
    const [card] = await getPokemonCards(refs(['pikachu', 25]), 40);
    expect(card.sprites.other['official-artwork'].front_default).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
    );
  });

  it('honours the limit and keeps order', async () => {
    stub({ dex: DEX, species: SPECIES });
    const { getPokemonCards } = await fresh();
    const cards = await getPokemonCards(refs(['raichu-alola', 10100], ['pikachu', 25], ['basculin-red-striped', 550]), 2);
    expect(cards.map((c) => c.name)).toEqual(['raichu-alola', 'pikachu']);
  });

  it('an entry Showdown does not know falls back to that Pokémon only', async () => {
    const calls = stub({ dex: DEX, species: SPECIES, details: { '/pokemon/10999': detail(10999, 'mystery-form', 'ghost') } });
    const { getPokemonCards } = await fresh();
    const cards = await getPokemonCards(refs(['pikachu', 25], ['mystery-form', 10999]), 40);
    expect(cards.map((c) => c.name)).toEqual(['pikachu', 'mystery-form']);
    expect(cards[1].types[0].type.name).toBe('ghost');
    expect(calls.filter((u) => /\/pokemon\/\d+/.test(u))).toEqual([`${API}/pokemon/10999/`]);
  });

  it('Showdown down: every card falls back to its PokeAPI summary (previous behaviour)', async () => {
    const calls = stub({ dex: 'down', species: SPECIES, details: { '/pokemon/25': detail(25, 'pikachu', 'electric') } });
    const { getPokemonCards } = await fresh();
    const cards = await getPokemonCards(refs(['pikachu', 25]), 40);
    expect(cards).toHaveLength(1);
    expect(cards[0].types[0].type.name).toBe('electric');
    expect(calls.some((u) => u.endsWith('/pokemon/25/'))).toBe(true);
  });

  it('species list down: default-form cards fall back rather than link a redirecting URL', async () => {
    stub({ dex: DEX, species: 'down', details: { '/pokemon/550': { ...detail(550, 'basculin-red-striped', 'water'), species: { name: 'basculin', url: `${API}/pokemon-species/550/` } } } });
    const { getPokemonCards } = await fresh();
    const { canonicalPokemonSlug } = await import('../utils/seo');
    const cards = await getPokemonCards(refs(['basculin-red-striped', 550]), 40);
    expect(cards.map(canonicalPokemonSlug)).toEqual(['basculin']);
  });

  it('an unresolvable entry is omitted, not fatal (optional enrichment)', async () => {
    stub({ dex: 'down', species: 'down', details: { '/pokemon/25': detail(25, 'pikachu') } });
    const { getPokemonCards } = await fresh();
    const cards = await getPokemonCards(refs(['pikachu', 25], ['ghost-mon', 9999]), 40);
    expect(cards.map((c) => c.name)).toEqual(['pikachu']);
  });

  it('a fallback summary keeps only what a card needs (no moves in the cache)', async () => {
    stub({ dex: 'down', species: 'down', details: { '/pokemon/25': detail(25, 'pikachu') } });
    const { getPokemonCards } = await fresh();
    const [card] = await getPokemonCards(refs(['pikachu', 25]), 40);
    expect(Object.keys(card).sort()).toEqual(['id', 'is_default', 'name', 'species', 'sprites', 'types']);
  });

  it('empty list -> no requests at all', async () => {
    const calls = stub({ dex: DEX, species: SPECIES });
    const { getPokemonCards } = await fresh();
    expect(await getPokemonCards([], 40)).toEqual([]);
    expect(calls).toEqual([]);
  });
});
