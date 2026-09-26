import { describe, it, expect, vi, afterEach } from 'vitest';
import { EntityNotFoundError, NotFoundError, UpstreamError } from './errors';
import {
  getMoveDetail,
  getMoveDetailByName,
  getAbilityDetailByName,
  getAbilityDetail,
  getPokemonByName,
  getPokemonByType,
  getSpeciesNamesById,
  PokemonNotFoundError,
} from './pokeapi';
import { errorResponse } from '../utils/httpResponses';

// How the PokeAPI fetch layer classifies failures. Every case uses its own
// slug: fetchWithCache() caches successful responses by URL for the life of
// the module (failures are never cached).

type FakeAnswer =
  | { status: number; body?: unknown }
  | { reject: unknown }
  | { invalidJson: true };

function stubFetch(routes: Record<string, FakeAnswer>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const key = Object.keys(routes).find((path) => url.replace(/\/$/, '').endsWith(path));
      const answer: FakeAnswer = key ? routes[key] : { status: 404 };
      if ('reject' in answer) throw answer.reject;
      if ('invalidJson' in answer) {
        return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response;
      }
      const ok = answer.status >= 200 && answer.status < 300;
      return { ok, status: answer.status, json: async () => answer.body ?? {} } as unknown as Response;
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('PokeAPI failure classification', () => {
  it.each([404, 410])('HTTP %i on the primary entity lookup -> EntityNotFoundError', async (status) => {
    stubFetch({ [`/move/nf-${status}`]: { status } });
    await expect(getMoveDetailByName(`nf-${status}`)).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it.each([404, 410])('HTTP %i on a related (non-entity) fetch -> NotFoundError, never EntityNotFoundError', async (status) => {
    stubFetch({ [`/move/related-${status}`]: { status } });
    const error = await getMoveDetail(`https://pokeapi.co/api/v2/move/related-${status}/`).catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).not.toBeInstanceOf(EntityNotFoundError);
  });

  it.each([500, 502, 503, 504, 429])('HTTP %i -> UpstreamError carrying the status', async (status) => {
    stubFetch({ [`/move/up-${status}`]: { status } });
    const error = await getMoveDetailByName(`up-${status}`).catch((e) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.status).toBe(status);
  });

  it('timeout (AbortSignal.timeout rejection) -> UpstreamError', async () => {
    stubFetch({ '/move/timeout-test': { reject: new DOMException('The operation was aborted due to timeout', 'TimeoutError') } });
    await expect(getMoveDetailByName('timeout-test')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('network failure (fetch TypeError) -> UpstreamError', async () => {
    stubFetch({ '/move/network-test': { reject: new TypeError('fetch failed') } });
    await expect(getMoveDetailByName('network-test')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('2xx with a body that is not JSON -> UpstreamError', async () => {
    stubFetch({ '/move/bad-json-test': { invalidJson: true } });
    await expect(getMoveDetailByName('bad-json-test')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('an upstream failure is never classified as not-found', async () => {
    stubFetch({ '/move/never-nf-test': { status: 503 } });
    await expect(getMoveDetailByName('never-nf-test')).rejects.not.toBeInstanceOf(NotFoundError);
  });
});

describe('HTTP 400: "no such entity" only where explicitly allowed', () => {
  it("allowed: an entity lookup by slug that PokeAPI rejects with 400 (ability/mind's-eye) -> EntityNotFoundError -> 404", async () => {
    stubFetch({ "/ability/mind's-eye": { status: 400 } });
    const error = await getAbilityDetailByName("mind's-eye").catch((e) => e);
    expect(error).toBeInstanceOf(EntityNotFoundError);
    expect(errorResponse(error).status).toBe(404);
  });

  it('not allowed: a 400 on a request Pokepedia built (related fetch) is a bug -> plain Error -> 500', async () => {
    stubFetch({ '/ability/secondary-400': { status: 400 } });
    const error = await getAbilityDetail('https://pokeapi.co/api/v2/ability/secondary-400/').catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error).not.toBeInstanceOf(UpstreamError);
    expect(error.message).toMatch(/HTTP 400/);
    // errorResponse re-throws it untouched: Astro answers 500, never 404/503.
    expect(() => errorResponse(error)).toThrow(error);
  });

  it('not allowed: a 400 on a list/landing fetch is not "not found" either', async () => {
    stubFetch({ '/type/bad-request-400': { status: 400 } });
    const error = await getPokemonByType('bad-request-400').catch((e) => e);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error).not.toBeInstanceOf(UpstreamError);
  });
});

describe('getPokemonByName: transient failures are not "not found"', () => {
  it('a PokeAPI 503 on the pokemon lookup propagates, without falling back to the species', async () => {
    const calls = stubFetch({ '/pokemon/flaky-mon': { status: 503 } });
    await expect(getPokemonByName('flaky-mon')).rejects.toBeInstanceOf(UpstreamError);
    expect(calls.some((url) => url.includes('/pokemon-species/flaky-mon'))).toBe(false);
  });

  it('a 404 pokemon + timeout on the species lookup is an UpstreamError, not PokemonNotFoundError', async () => {
    stubFetch({
      '/pokemon/species-down-mon': { status: 404 },
      '/pokemon-species/species-down-mon': { reject: new DOMException('timeout', 'TimeoutError') },
    });
    const error = await getPokemonByName('species-down-mon').catch((e) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).not.toBeInstanceOf(PokemonNotFoundError);
  });

  it('404 on both lookups is PokemonNotFoundError (an EntityNotFoundError -> 404)', async () => {
    stubFetch({});
    const error = await getPokemonByName('ghost-mon').catch((e) => e);
    expect(error).toBeInstanceOf(PokemonNotFoundError);
    expect(error).toBeInstanceOf(EntityNotFoundError);
  });

  it('the pokemon exists but its species is missing: a required dependency, not a 404', async () => {
    stubFetch({
      '/pokemon/orphan-mon': { status: 200, body: { id: 1, name: 'orphan-mon', is_default: true, species: { name: 'orphan-mon', url: 'https://pokeapi.co/api/v2/pokemon-species/orphan-mon/' } } },
      '/pokemon-species/orphan-mon': { status: 404 },
    });
    const error = await getPokemonByName('orphan-mon').catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).not.toBeInstanceOf(EntityNotFoundError);
    expect(errorResponse(error).status).toBe(503);
  });

  it("the species exists but its default variety is missing: a required dependency, not a 404", async () => {
    stubFetch({
      '/pokemon/hollow-species': { status: 404 },
      '/pokemon-species/hollow-species': { status: 200, body: { name: 'hollow-species', varieties: [{ is_default: true, pokemon: { name: 'hollow-species-form', url: 'https://pokeapi.co/api/v2/pokemon/99001/' } }] } },
      '/pokemon/99001': { status: 404 },
    });
    const error = await getPokemonByName('hollow-species').catch((e) => e);
    expect(error).not.toBeInstanceOf(EntityNotFoundError);
    expect(errorResponse(error).status).toBe(503);
  });
});

describe('canonical species names in entity lists', () => {
  it('getSpeciesNamesById maps National Dex ids to species names (canonical slugs)', async () => {
    stubFetch({
      '/pokemon-species?limit=100000': {
        status: 200,
        body: {
          count: 2,
          next: null,
          results: [
            { name: 'feraligatr', url: 'https://pokeapi.co/api/v2/pokemon-species/160/' },
            { name: 'basculin', url: 'https://pokeapi.co/api/v2/pokemon-species/550/' },
          ],
        },
      },
    });
    const names = await getSpeciesNamesById();
    expect(names.get(550)).toBe('basculin');
    expect(names.get(160)).toBe('feraligatr');
  });

  it('the sitemap Pokémon source reads pokemon-species (canonical names), not pokemon', async () => {
    // Fresh module: the species list is cached by URL for the life of the module.
    vi.resetModules();
    const { getAllPokemonBasic } = await import('./pokeapi');
    const calls = stubFetch({
      '/pokemon-species?limit=100000': { status: 200, body: { count: 1, next: null, results: [{ name: 'basculin', url: 'https://pokeapi.co/api/v2/pokemon-species/550/' }] } },
    });
    const list = await getAllPokemonBasic();
    expect(list.map((p) => p.name)).toEqual(['basculin']);
    expect(calls.every((url) => !url.includes('/pokemon?'))).toBe(true);
  });
});
