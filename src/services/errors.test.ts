import { describe, it, expect, vi, afterEach } from 'vitest';
import { NotFoundError, UpstreamError } from './errors';
import {
  getMoveDetailByName,
  getPokemonByName,
  getPokemonByType,
  getAllPokemonBasic,
  PokemonNotFoundError,
} from './pokeapi';

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
  it.each([404, 400, 410])('HTTP %i -> NotFoundError', async (status) => {
    stubFetch({ [`/move/nf-${status}`]: { status } });
    await expect(getMoveDetailByName(`nf-${status}`)).rejects.toBeInstanceOf(NotFoundError);
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

  it('404 on both lookups is PokemonNotFoundError (a NotFoundError)', async () => {
    stubFetch({});
    const error = await getPokemonByName('ghost-mon').catch((e) => e);
    expect(error).toBeInstanceOf(PokemonNotFoundError);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('canonical species names in entity lists', () => {
  it('getPokemonByType names each default form by its species (canonical URL slug)', async () => {
    stubFetch({
      '/type/water-canon': {
        status: 200,
        body: {
          pokemon: [
            { pokemon: { name: 'basculin-red-striped', url: 'https://pokeapi.co/api/v2/pokemon/550/' } },
            { pokemon: { name: 'feraligatr', url: 'https://pokeapi.co/api/v2/pokemon/160/' } },
            { pokemon: { name: 'basculin-blue-striped', url: 'https://pokeapi.co/api/v2/pokemon/10016/' } },
          ],
        },
      },
      '/pokemon-species?limit=2000': {
        status: 200,
        body: {
          results: [
            { name: 'feraligatr', url: 'https://pokeapi.co/api/v2/pokemon-species/160/' },
            { name: 'basculin', url: 'https://pokeapi.co/api/v2/pokemon-species/550/' },
          ],
        },
      },
    });
    const list = await getPokemonByType('water-canon');
    expect(list.map((p) => p.name)).toEqual(['feraligatr', 'basculin']);
  });

  it('the sitemap Pokémon source reads pokemon-species (canonical names), not pokemon', async () => {
    const calls = stubFetch({
      '/pokemon-species?limit=1025': { status: 200, body: { results: [{ name: 'basculin', url: 'https://pokeapi.co/api/v2/pokemon-species/550/' }] } },
    });
    const list = await getAllPokemonBasic(1025);
    expect(list.map((p) => p.name)).toEqual(['basculin']);
    expect(calls.every((url) => !url.includes('/pokemon?'))).toBe(true);
  });
});
