import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PokemonPage from './[lang]/pokemon/[name].astro';
import MovePage from './[lang]/movimientos/[name].astro';
import AbilityPage from './[lang]/habilidades/[name].astro';
import ItemPage from './[lang]/objetos/[name].astro';
import TipoPage from './[lang]/tipo/[type].astro';
import GeneracionPage from './[lang]/generacion/[gen].astro';
import { renderRoute } from '../testing/renderRoute';

// Entity routing + HTTP semantics, rendered through src/middleware.ts like
// production:
//   canonical slug -> 200 · numeric id / case variant / default form -> 301
//   missing entity -> 404 · PokeAPI 5xx/timeout/network -> 503 + Retry-After
//   unexpected bug -> propagates (Astro serves 500), never 404/302/200.

const API = 'https://pokeapi.co/api/v2';

function pokemon(id: number, name: string, speciesName: string, isDefault: boolean) {
  return {
    id,
    name,
    is_default: isDefault,
    height: 10,
    weight: 100,
    species: { name: speciesName, url: `${API}/pokemon-species/${speciesName}/` },
    types: [{ slot: 1, type: { name: 'water', url: `${API}/type/11/` } }],
    stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } })),
    abilities: [],
    moves: [],
    sprites: { front_default: '', other: { 'official-artwork': { front_default: '' } } },
  };
}

function species(name: string, varieties: [string, number, boolean][]) {
  return {
    name,
    names: [],
    flavor_text_entries: [{ flavor_text: 'x', language: { name: 'es' } }, { flavor_text: 'x', language: { name: 'en' } }],
    evolution_chain: null,
    generation: { name: 'generation-ii', url: `${API}/generation/2/` },
    varieties: varieties.map(([n, id, isDefault]) => ({ is_default: isDefault, pokemon: { name: n, url: `${API}/pokemon/${id}/` } })),
  };
}

const FERALIGATR = pokemon(160, 'feraligatr', 'feraligatr', true);
const MOVE_SURF = {
  id: 57, name: 'surf', names: [], type: { name: 'water' }, damage_class: { name: 'special' },
  power: 90, accuracy: 100, pp: 15, priority: 0, flavor_text_entries: [], learned_by_pokemon: [],
};
const ABILITY_LEVITATE = { id: 26, name: 'levitate', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] };
const ITEM_LEFTOVERS = {
  name: 'leftovers', names: [], category: { name: 'held-items' }, cost: 0, effect_entries: [],
  flavor_text_entries: [], sprites: { default: '' }, machines: [], held_by_pokemon: [],
};

// path (after /api/v2, no trailing slash) -> JSON body (200) | HTTP status | thrown error
const ROUTES: Record<string, unknown> = {
  '/pokemon/feraligatr': FERALIGATR,
  '/pokemon/160': FERALIGATR,
  '/pokemon-species/feraligatr': species('feraligatr', [['feraligatr', 160, true], ['feraligatr-mega', 10300, false]]),
  '/pokemon/feraligatr-mega': pokemon(10300, 'feraligatr-mega', 'feraligatr', false),
  '/pokemon/basculin': 404,
  '/pokemon-species/basculin': species('basculin', [['basculin-red-striped', 550, true], ['basculin-blue-striped', 10016, false]]),
  '/pokemon/550': pokemon(550, 'basculin-red-striped', 'basculin', true),
  '/pokemon/basculin-red-striped': pokemon(550, 'basculin-red-striped', 'basculin', true),
  '/move/surf': MOVE_SURF,
  '/move/57': MOVE_SURF,
  '/ability/levitate': ABILITY_LEVITATE,
  '/ability/26': ABILITY_LEVITATE,
  '/item/leftovers': ITEM_LEFTOVERS,
  '/item/211': ITEM_LEFTOVERS,
  '/type/water': { pokemon: [] },
  // The type landing also builds its generation breakdown from generations 1-9.
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`/generation/${i + 1}`, { pokemon_species: [] }])),
  // Upstream failures
  '/pokemon/down-mon': 503,
  '/pokemon/gateway-mon': 502,
  '/move/down-move': 500,
  '/ability/slow-ability': new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
  '/item/offline-item': new TypeError('fetch failed'),
  '/type/fire': 504,
  // Unexpected internal error: a 200 payload the page can't handle (bug path)
  '/move/broken-move': { id: 1, name: 'broken-move', names: [], type: { name: 'water' }, damage_class: { name: 'special' } },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const path = String(input).replace(API, '').replace(/\/$/, '');
      const hit = path in ROUTES ? ROUTES[path] : 404;
      if (hit instanceof Error || hit instanceof DOMException) throw hit;
      if (typeof hit === 'number') {
        return { ok: false, status: hit, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => hit, text: async () => JSON.stringify(hit) } as unknown as Response;
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

const pokemonRoute = (lang: string, name: string) =>
  renderRoute(PokemonPage, { routePattern: '/[lang]/pokemon/[name]', params: { lang, name }, path: `/${lang}/pokemon/${name}/` });
const entityRoute = (component: any, family: string, name: string) =>
  renderRoute(component, { routePattern: `/[lang]/${family}/[name]`, params: { lang: 'es', name }, path: `/es/${family}/${name}/` });
const tipoRoute = (type: string) =>
  renderRoute(TipoPage, { routePattern: '/[lang]/tipo/[type]', params: { lang: 'es', type }, path: `/es/tipo/${type}/` });
const genRoute = (gen: string) =>
  renderRoute(GeneracionPage, { routePattern: '/[lang]/generacion/[gen]', params: { lang: 'es', gen }, path: `/es/generacion/${gen}/` });

function expectRedirect(response: Response, location: string) {
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe(location);
}

function expectUnavailable(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('60');
  expect(response.headers.get('location')).toBeNull();
}

describe('canonical entity URLs render 200', () => {
  it('Pokémon, non-default form, move, ability, item, type, generation', async () => {
    expect((await pokemonRoute('es', 'feraligatr')).status).toBe(200);
    expect((await pokemonRoute('en', 'feraligatr')).status).toBe(200);
    expect((await pokemonRoute('es', 'feraligatr-mega')).status).toBe(200);
    expect((await pokemonRoute('es', 'basculin')).status).toBe(200);
    expect((await entityRoute(MovePage, 'movimientos', 'surf')).status).toBe(200);
    expect((await entityRoute(AbilityPage, 'habilidades', 'levitate')).status).toBe(200);
    expect((await entityRoute(ItemPage, 'objetos', 'leftovers')).status).toBe(200);
    expect((await tipoRoute('water')).status).toBe(200);
    expect((await genRoute('2')).status).toBe(200);
  });
});

describe('301 to the canonical slug', () => {
  it('a species default form -> the species URL', async () => {
    expectRedirect(await pokemonRoute('es', 'basculin-red-striped'), '/es/pokemon/basculin/');
    expectRedirect(await pokemonRoute('en', 'basculin-red-striped'), '/en/pokemon/basculin/');
  });

  it('a numeric Pokémon id -> its slug (both locales)', async () => {
    expectRedirect(await pokemonRoute('es', '160'), '/es/pokemon/feraligatr/');
    expectRedirect(await pokemonRoute('en', '160'), '/en/pokemon/feraligatr/');
    expectRedirect(await pokemonRoute('es', '550'), '/es/pokemon/basculin/');
  });

  it('a case variant -> lowercase canonical, in every family', async () => {
    expectRedirect(await pokemonRoute('es', 'Feraligatr'), '/es/pokemon/feraligatr/');
    expectRedirect(await pokemonRoute('es', 'BASCULIN'), '/es/pokemon/basculin/');
    expectRedirect(await entityRoute(MovePage, 'movimientos', 'Surf'), '/es/movimientos/surf/');
    expectRedirect(await entityRoute(AbilityPage, 'habilidades', 'Levitate'), '/es/habilidades/levitate/');
    expectRedirect(await entityRoute(ItemPage, 'objetos', 'Leftovers'), '/es/objetos/leftovers/');
    expectRedirect(await tipoRoute('Water'), '/es/tipo/water/');
  });

  it('numeric ids of moves/abilities/items -> their slug', async () => {
    expectRedirect(await entityRoute(MovePage, 'movimientos', '57'), '/es/movimientos/surf/');
    expectRedirect(await entityRoute(AbilityPage, 'habilidades', '26'), '/es/habilidades/levitate/');
    expectRedirect(await entityRoute(ItemPage, 'objetos', '211'), '/es/objetos/leftovers/');
  });

  it('a zero-padded generation -> its canonical number', async () => {
    expectRedirect(await genRoute('02'), '/es/generacion/2/');
  });
});

describe('missing entities are a real 404 (no redirect to a listing)', () => {
  it.each([
    ['pokemon', () => pokemonRoute('es', 'does-not-exist')],
    ['numeric pokemon id', () => pokemonRoute('es', '99999')],
    ['move', () => entityRoute(MovePage, 'movimientos', 'does-not-exist')],
    ['ability', () => entityRoute(AbilityPage, 'habilidades', 'does-not-exist')],
    ['item', () => entityRoute(ItemPage, 'objetos', 'does-not-exist')],
    ['type', () => tipoRoute('does-not-exist')],
    ['generation 999999', () => genRoute('999999')],
    ['generation 0', () => genRoute('0')],
    ['non-numeric generation', () => genRoute('2abc')],
  ])('%s -> 404', async (_, route) => {
    const response = await route();
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('PokeAPI unavailable -> 503 + Retry-After (never 404, never a redirect)', () => {
  it('upstream 5xx', async () => {
    expectUnavailable(await pokemonRoute('es', 'down-mon'));
    expectUnavailable(await pokemonRoute('es', 'gateway-mon'));
    expectUnavailable(await entityRoute(MovePage, 'movimientos', 'down-move'));
    expectUnavailable(await tipoRoute('fire'));
  });

  it('timeout', async () => {
    expectUnavailable(await entityRoute(AbilityPage, 'habilidades', 'slow-ability'));
  });

  it('network failure', async () => {
    expectUnavailable(await entityRoute(ItemPage, 'objetos', 'offline-item'));
  });
});

describe('unexpected internal errors are not masked', () => {
  it('a page bug propagates (Astro answers 500) instead of becoming 404/503/302/200', async () => {
    const outcome = await entityRoute(MovePage, 'movimientos', 'broken-move').then(
      (response) => ({ status: response.status }),
      (error) => ({ error })
    );
    expect('error' in outcome).toBe(true);
    expect((outcome as { error: unknown }).error).toBeInstanceOf(TypeError);
  });
});
