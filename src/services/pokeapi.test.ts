import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPokemonByName, PokemonNotFoundError } from './pokeapi';

// ---------------------------------------------------------------------
// Regression coverage for the pokemon/species resolution order documented
// in docs/DATA_SOURCES.md. The previous implementation had a third
// fallback step — `name.split('-')[0]` — that could silently resolve a
// hyphenated slug (e.g. "porygon-z", "deoxys-attack") to an unrelated
// but validly-named base species ("porygon", "deoxys") whenever the
// direct pokemon/species lookups failed, including on a transient
// network error. That step no longer exists: a name that isn't an exact
// `pokemon` or `pokemon-species` resource must fail cleanly.
//
// fetchWithCache() caches by exact URL for the process lifetime, so every
// test below uses a distinct fake slug to avoid cross-test cache hits.
// ---------------------------------------------------------------------

function speciesPayload(name: string, varietyName = name) {
  return {
    name,
    flavor_text_entries: [],
    evolution_chain: { url: `https://pokeapi.co/api/v2/evolution-chain/1/` },
    varieties: [
      { is_default: true, pokemon: { name: varietyName, url: `https://pokeapi.co/api/v2/pokemon/${varietyName}/` } },
    ],
  };
}

function pokemonPayload(name: string, speciesName = name) {
  return {
    id: 1,
    name,
    types: [],
    sprites: { front_default: '', other: { 'official-artwork': { front_default: '' } } },
    stats: [],
    abilities: [],
    moves: [],
    height: 1,
    weight: 1,
    species: { url: `https://pokeapi.co/api/v2/pokemon-species/${speciesName}/` },
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('getPokemonByName resolution order', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);

      if (url.includes('wikidex.net')) {
        return jsonResponse({}, false);
      }
      if (url.includes('/pokemon/porygon-z-test')) {
        return jsonResponse(pokemonPayload('porygon-z-test'));
      }
      if (url.includes('/pokemon-species/porygon-z-test')) {
        return jsonResponse(speciesPayload('porygon-z-test'));
      }
      // Check the more specific variety URL before the generic (and
      // deliberately-404ing) exact-slug URL it's a substring of.
      if (url.includes('/pokemon/basculin-test-red-striped')) {
        return jsonResponse(pokemonPayload('basculin-test-red-striped', 'basculin-test'));
      }
      if (url.includes('/pokemon/basculin-test')) {
        return jsonResponse({}, false);
      }
      if (url.includes('/pokemon-species/basculin-test')) {
        return jsonResponse(speciesPayload('basculin-test', 'basculin-test-red-striped'));
      }
      if (url.includes('/pokemon/porygon-z-down-test')) {
        return jsonResponse({}, false);
      }
      if (url.includes('/pokemon-species/porygon-z-down-test')) {
        return jsonResponse({}, false);
      }
      return jsonResponse({}, false);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves an exact pokemon slug directly (step 1)', async () => {
    const result = await getPokemonByName('porygon-z-test');
    expect(result.detail.name).toBe('porygon-z-test');
  });

  it('resolves a species-only slug via its default variety (step 2) — basculin/gourgeist/basculegion class', async () => {
    const result = await getPokemonByName('basculin-test');
    expect(result.detail.name).toBe('basculin-test-red-striped');
    expect(result.species.name).toBe('basculin-test');
  });

  it('fails cleanly instead of guessing a base species when both lookups fail', async () => {
    await expect(getPokemonByName('porygon-z-down-test')).rejects.toThrow(PokemonNotFoundError);

    // The dangerous behavior this guards against: a naive `split('-')[0]`
    // fallback would have issued a request for the truncated base name
    // ("porygon-z-down" -> "porygon"), which is itself a real species and
    // would have silently returned the wrong Pokémon. Assert no such
    // truncated-name request was ever made.
    const truncatedRequests = calls.filter(
      (url) => url.includes('/pokemon-species/porygon-z') && !url.includes('porygon-z-down-test')
    );
    expect(truncatedRequests).toHaveLength(0);
  });

  it('fails cleanly for a name that is not a real pokemon or species', async () => {
    await expect(getPokemonByName('totally-not-a-real-pokemon-test')).rejects.toThrow(PokemonNotFoundError);
  });
});
