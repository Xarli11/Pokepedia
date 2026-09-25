import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PokemonPage from './[lang]/pokemon/[name].astro';
import { renderRoute } from '../testing/renderRoute';

// Own file on purpose: pokeapi.ts caches responses per module instance, and
// the sibling movement-crawlability test caches a *successful* ability catalog.
//
// getAllAbilities() is an optional dependency of the Pokémon page. When it
// fails, Showdown ability names must be shown but never linked: guessing a slug
// ("Mind's Eye" -> "mind's-eye") would emit an internal link that 404s.

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

const detail = {
  id: 94,
  name: 'gengar',
  height: 15,
  weight: 405,
  species: { name: 'gengar', url: `${API}/pokemon-species/94/` },
  types: [{ slot: 1, type: { name: 'ghost', url: `${API}/type/8/` } }],
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } })),
  abilities: [],
  moves: [],
  sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
};

const FIXTURES: Record<string, unknown> = {
  '/pokemon/gengar': detail,
  '/pokemon/94': detail,
  '/pokemon-species/94': { name: 'gengar', names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: 'gengar', url: `${API}/pokemon/94/` } }] },
};
const POKEDEX = { gengar: { abilities: { 0: "Mind's Eye", 1: 'Levitate', H: 'Dragon’s Maw' } } };

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith(`${API}/ability`)) {
        // Catalog (and every ability lookup) is down.
        return { ok: false, status: 503, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      const data = url === SHOWDOWN ? POKEDEX : FIXTURES[url.replace(API, '').replace(/\/$/, '')];
      if (data === undefined) {
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
    })
  );
}

describe('Pokémon page when the PokeAPI ability catalog is unavailable', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  for (const lang of ['es', 'en']) {
    it(`(${lang}) still answers 200, shows the Showdown names and links none of them`, async () => {
      const response = await renderRoute(PokemonPage, {
        routePattern: '/[lang]/pokemon/[name]',
        params: { lang, name: 'gengar' },
        path: `/${lang}/pokemon/gengar/`,
      });
      expect(response.status).toBe(200);
      const html = await response.text();

      // Names stay visible (an unlinked card, not a dropped ability).
      expect(html).toContain('Mind&#39;s Eye');
      expect(html).toContain('Levitate');

      // No ability href at all: not the naive slug, not any other invented one.
      expect(html).not.toMatch(/href="\/(es|en)\/habilidades\/[^"]+"/);
      expect(html).not.toContain("mind's-eye");
      expect(html).not.toContain('mind%27s-eye');
    });
  }
});
