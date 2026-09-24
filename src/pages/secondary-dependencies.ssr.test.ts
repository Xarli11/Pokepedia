import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PokemonPage from './[lang]/pokemon/[name].astro';
import MovePage from './[lang]/movimientos/[name].astro';
import ItemPage from './[lang]/objetos/[name].astro';
import TipoPage from './[lang]/tipo/[type].astro';
import { renderRoute } from '../testing/renderRoute';

// 404 means "the entity this URL names doesn't exist" — nothing else. Here
// the primary entity always exists and a related resource is missing (PokeAPI
// 404). Decided behavior:
//   - optional enrichment missing  -> page still renders 200 (degraded);
//   - required dependency missing  -> 503 (entity exists, PokeAPI can't
//     represent it right now), never 404.

const API = 'https://pokeapi.co/api/v2';

const pokemon = (id: number, name: string) => ({
  id,
  name,
  is_default: true,
  height: 10,
  weight: 100,
  species: { name, url: `${API}/pokemon-species/${name}/` },
  types: [{ slot: 1, type: { name: 'water', url: `${API}/type/11/` } }],
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } })),
  abilities: [{ ability: { name: 'torrent', url: `${API}/ability/67/` }, is_hidden: false, slot: 1 }],
  moves: [],
  sprites: { front_default: '', other: { 'official-artwork': { front_default: '' } } },
});

const ROUTES: Record<string, unknown> = {
  // Pokémon whose related resources are all missing (evolution chain,
  // ability, prev/next, extra variety) -> enrichment only.
  '/pokemon/feraligatr': pokemon(160, 'feraligatr'),
  '/pokemon-species/feraligatr': {
    name: 'feraligatr',
    names: [],
    flavor_text_entries: [{ flavor_text: 'x', language: { name: 'es' } }],
    evolution_chain: { url: `${API}/evolution-chain/74/` },
    generation: { name: 'generation-ii', url: `${API}/generation/2/` },
    varieties: [
      { is_default: true, pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } },
      { is_default: false, pokemon: { name: 'feraligatr-mega', url: `${API}/pokemon/10300/` } },
    ],
  },
  // Pokémon that exists but whose species is missing -> required dependency.
  '/pokemon/orphan-mon': { ...pokemon(9001, 'orphan-mon'), species: { name: 'orphan-mon', url: `${API}/pokemon-species/orphan-mon/` } },
  // Move that exists; the Pokémon that learn it are missing -> enrichment.
  '/move/surf': {
    id: 57, name: 'surf', names: [], type: { name: 'water' }, damage_class: { name: 'special' },
    power: 90, accuracy: 100, pp: 15, priority: 0, flavor_text_entries: [],
    learned_by_pokemon: [{ name: 'feraligatr', url: `${API}/pokemon/404404/` }],
  },
  // TM whose machine resource is missing -> enrichment (no "teaches" link).
  '/item/tm03': {
    name: 'tm03', names: [], category: { name: 'all-machines' }, cost: 0, effect_entries: [],
    flavor_text_entries: [], sprites: { default: '' },
    machines: [{ machine: { url: `${API}/machine/404404/` }, version_group: { name: 'x-y' } }],
    held_by_pokemon: [],
  },
  // Type landing: type list + species names present, generations 3-9 missing.
  '/type/water': { pokemon: [{ pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } }] },
  '/pokemon-species?limit=2000': { results: [{ name: 'feraligatr', url: `${API}/pokemon-species/160/` }] },
  '/generation/1': { pokemon_species: [] },
  '/generation/2': { pokemon_species: [{ name: 'feraligatr', url: `${API}/pokemon-species/160/` }] },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const path = String(input).replace(API, '').replace(/\/$/, '');
      const status = path in ROUTES ? 200 : 404;
      return {
        ok: status === 200,
        status,
        headers: new Headers(),
        json: async () => (status === 200 ? ROUTES[path] : {}),
        text: async () => (status === 200 ? JSON.stringify(ROUTES[path]) : ''),
      } as unknown as Response;
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('a missing secondary resource never turns a valid entity into a 404', () => {
  it('Pokémon: missing evolution chain, ability, prev/next and variety -> 200 (enrichment)', async () => {
    const response = await renderRoute(PokemonPage, {
      routePattern: '/[lang]/pokemon/[name]', params: { lang: 'es', name: 'feraligatr' }, path: '/es/pokemon/feraligatr/',
    });
    expect(response.status).toBe(200);
  });

  it('Pokémon: exists but its species is missing (required dependency) -> 503, not 404', async () => {
    const response = await renderRoute(PokemonPage, {
      routePattern: '/[lang]/pokemon/[name]', params: { lang: 'es', name: 'orphan-mon' }, path: '/es/pokemon/orphan-mon/',
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
  });

  it('move: the Pokémon that learn it are missing -> 200 (enrichment)', async () => {
    const response = await renderRoute(MovePage, {
      routePattern: '/[lang]/movimientos/[name]', params: { lang: 'es', name: 'surf' }, path: '/es/movimientos/surf/',
    });
    expect(response.status).toBe(200);
  });

  it('item: its TM machine resource is missing -> 200 (enrichment)', async () => {
    const response = await renderRoute(ItemPage, {
      routePattern: '/[lang]/objetos/[name]', params: { lang: 'es', name: 'tm03' }, path: '/es/objetos/tm03/',
    });
    expect(response.status).toBe(200);
  });

  it('type landing: missing generation resources (by-generation breakdown) -> 200 (enrichment)', async () => {
    const response = await renderRoute(TipoPage, {
      routePattern: '/[lang]/tipo/[type]', params: { lang: 'es', type: 'water' }, path: '/es/tipo/water/',
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('href="/es/pokemon/feraligatr/"');
  });

  it('type landing: its Pokémon list missing (required dependency) -> 503, not 404', async () => {
    // "fire" is a valid type (static list) but /type/fire is absent from the
    // fixture. A type never loaded in this file, since fetchWithCache caches
    // successful responses for the module's lifetime.
    const response = await renderRoute(TipoPage, {
      routePattern: '/[lang]/tipo/[type]', params: { lang: 'es', type: 'fire' }, path: '/es/tipo/fire/',
    });
    expect(response.status).toBe(503);
  });
});
