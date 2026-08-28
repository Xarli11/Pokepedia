import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPokemonByName,
  getPokemonByType,
  getPokemonByGeneration,
  getGenerationMembershipMap,
  getDexRangeFromEntries,
  idFromResourceUrl,
  PokemonNotFoundError,
} from './pokeapi';

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

describe('getPokemonByType', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps PokeAPI /type/{name} pokemon entries to the lightweight list shape, sorted by id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/type/dragon-test')) {
        return jsonResponse({
          name: 'dragon-test',
          pokemon: [
            { pokemon: { name: 'dragonite-test', url: 'https://pokeapi.co/api/v2/pokemon/149/' }, slot: 1 },
            { pokemon: { name: 'dratini-test', url: 'https://pokeapi.co/api/v2/pokemon/147/' }, slot: 1 },
            // Variety/form (id > 10000) must be filtered out.
            { pokemon: { name: 'charizard-mega-y-test', url: 'https://pokeapi.co/api/v2/pokemon/10035/' }, slot: 1 },
          ],
        });
      }
      return jsonResponse({}, false);
    }));

    const list = await getPokemonByType('dragon-test');
    expect(list.map((p) => p.name)).toEqual(['dratini-test', 'dragonite-test']);
    expect(list.every((p) => p.id < 10000)).toBe(true);
  });
});

describe('idFromResourceUrl', () => {
  it('extracts the trailing numeric id from a PokeAPI resource URL', () => {
    expect(idFromResourceUrl('https://pokeapi.co/api/v2/pokemon-species/1025/')).toBe(1025);
    expect(idFromResourceUrl('https://pokeapi.co/api/v2/pokemon/6')).toBe(6);
  });
});

describe('getDexRangeFromEntries', () => {
  it('returns the min/max id regardless of input order', () => {
    expect(getDexRangeFromEntries([{ id: 5 }, { id: 2 }, { id: 9 }])).toEqual({ start: 2, end: 9 });
  });
});

// Regression coverage for the Gen 9 undercount bug: the old GENERATIONS
// {limit, offset} table stopped at National Dex id 1015, silently dropping
// the Indigo Disk/Teal Mask DLC species (ids 1016-1025). This fixture is an
// independent ground-truth snapshot (verified against live PokeAPI
// generation/9 in the session that fixed this) — not the code under test —
// so these assertions actually catch a regression instead of restating the
// implementation.
function buildGen9SpeciesFixture() {
  // Ids 906-1015: synthetic filler standing in for the ~110 species PokeAPI
  // already classified correctly before the fix (not the point of this test).
  const filler = Array.from({ length: 110 }, (_, i) => {
    const id = 906 + i;
    return { name: `gen9-species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` };
  });
  // Ids 1016-1025: the real DLC species that were missing — actual names,
  // verified live.
  const dlcAdditions = [
    ['fezandipiti', 1016], ['ogerpon', 1017], ['archaludon', 1018], ['hydrapple', 1019],
    ['gouging-fire', 1020], ['raging-bolt', 1021], ['iron-boulder', 1022], ['iron-crown', 1023],
    ['terapagos', 1024], ['pecharunt', 1025],
  ].map(([name, id]) => ({ name: name as string, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` }));

  return [...filler, ...dlcAdditions];
}

function buildGen1SpeciesFixture() {
  return Array.from({ length: 151 }, (_, i) => {
    const id = i + 1;
    return { name: `gen1-species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` };
  });
}

describe('getPokemonByGeneration — Gen 9 full DLC coverage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns all 120 Gen 9 species (906-1025), not just the pre-DLC 110 (906-1015)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/generation/9')) return jsonResponse({ pokemon_species: buildGen9SpeciesFixture() });
      return jsonResponse({}, false);
    }));

    const list = await getPokemonByGeneration('gen9');

    expect(list).toHaveLength(120);

    const ids = list.map((p) => p.id);
    expect(Math.max(...ids)).toBe(1025);
    expect(Math.min(...ids)).toBe(906);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids/forms

    const names = list.map((p) => p.name);
    for (const expected of ['fezandipiti', 'ogerpon', 'archaludon', 'hydrapple', 'gouging-fire', 'raging-bolt', 'iron-boulder', 'iron-crown', 'terapagos', 'pecharunt']) {
      expect(names).toContain(expected);
    }

    // The specific bug: ids past the old hardcoded 1015 ceiling must be present.
    expect(ids.filter((id) => id > 1015)).toHaveLength(10);
  });

  it('does not regress Gen 1 — still exactly 151 species', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/generation/1')) return jsonResponse({ pokemon_species: buildGen1SpeciesFixture() });
      return jsonResponse({}, false);
    }));

    const list = await getPokemonByGeneration('gen1');
    expect(list).toHaveLength(151);
    expect(Math.min(...list.map((p) => p.id))).toBe(1);
    expect(Math.max(...list.map((p) => p.id))).toBe(151);
  });

  it('returns entries sorted by National Dex id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/generation/2')) {
        return jsonResponse({
          pokemon_species: [
            { name: 'c', url: 'https://pokeapi.co/api/v2/pokemon-species/200/' },
            { name: 'a', url: 'https://pokeapi.co/api/v2/pokemon-species/152/' },
            { name: 'b', url: 'https://pokeapi.co/api/v2/pokemon-species/175/' },
          ],
        });
      }
      return jsonResponse({}, false);
    }));

    const list = await getPokemonByGeneration('gen2');
    expect(list.map((p) => p.id)).toEqual([152, 175, 200]);
  });
});

describe('getGenerationMembershipMap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('classifies ids from every generation, including post-1015 Gen 9 DLC species', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      const match = url.match(/\/generation\/(\d)\b/);
      if (!match) return jsonResponse({}, false);
      const genNum = match[1];
      if (genNum === '1') {
        return jsonResponse({ pokemon_species: [{ name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' }] });
      }
      if (genNum === '9') {
        return jsonResponse({
          pokemon_species: [
            { name: 'sprigatito', url: 'https://pokeapi.co/api/v2/pokemon-species/906/' },
            { name: 'pecharunt', url: 'https://pokeapi.co/api/v2/pokemon-species/1025/' },
          ],
        });
      }
      return jsonResponse({ pokemon_species: [] });
    }));

    const map = await getGenerationMembershipMap();
    expect(map.get(1)).toBe('gen1');
    expect(map.get(906)).toBe('gen9');
    expect(map.get(1025)).toBe('gen9'); // the id the old range-based lookup couldn't classify
  });
});
