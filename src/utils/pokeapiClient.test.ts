import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPokemonBySlug, PokeApiHttpError, POKEAPI_BASE } from './pokeapiClient';
import { canonicalPokemonSlug, pagePath } from './seo';

// Favorites are stored as canonical slugs. For 37 species that slug is the
// species name ("basculin"), which PokeAPI only knows as pokemon-species —
// `pokemon/basculin` is a 404 (verified live). The favorites view must
// resolve it to the default variety exactly like the server does, and the
// card it renders must still link the species URL.

type Variety = [name: string, id: number, isDefault: boolean];

function pokemon(id: number, name: string, speciesName: string, isDefault: boolean) {
  return { id, name, is_default: isDefault, species: { name: speciesName } };
}

// Mirrors live PokeAPI for the three required examples.
const SPECIES: Record<string, Variety[]> = {
  basculin: [['basculin-red-striped', 550, true], ['basculin-blue-striped', 10016, false]],
  deoxys: [['deoxys-normal', 386, true], ['deoxys-attack', 10001, false]],
  zygarde: [['zygarde-50', 718, true], ['zygarde-10-power-construct', 10118, false]],
};
const POKEMON: Record<string, ReturnType<typeof pokemon>> = {};
for (const [speciesName, varieties] of Object.entries(SPECIES)) {
  for (const [name, id, isDefault] of varieties) {
    POKEMON[name] = POKEMON[String(id)] = pokemon(id, name, speciesName, isDefault);
  }
}
POKEMON.feraligatr = pokemon(160, 'feraligatr', 'feraligatr', true);

function stubPokeApi(overrides: Record<string, number> = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const path = url.replace(POKEAPI_BASE, '').replace(/\/$/, '');
      const reply = (status: number, body: unknown = {}) =>
        ({ ok: status < 300, status, json: async () => body }) as unknown as Response;
      if (path in overrides) return reply(overrides[path]);
      const [, kind, key] = path.split('/');
      if (kind === 'pokemon' && POKEMON[key]) return reply(200, POKEMON[key]);
      if (kind === 'pokemon-species' && SPECIES[key]) {
        return reply(200, {
          name: key,
          varieties: SPECIES[key].map(([name, id, isDefault]) => ({
            is_default: isDefault,
            pokemon: { name, url: `${POKEAPI_BASE}/pokemon/${id}/` },
          })),
        });
      }
      return reply(404);
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchPokemonBySlug (favorites)', () => {
  it.each([
    ['basculin', 'basculin-red-striped'],
    ['deoxys', 'deoxys-normal'],
    ['zygarde', 'zygarde-50'],
  ])('species slug %s -> default variety %s, card still links the species URL', async (slug, variety) => {
    stubPokeApi();
    const result = await fetchPokemonBySlug<ReturnType<typeof pokemon>>(slug);
    expect(result.name).toBe(variety);
    expect(canonicalPokemonSlug(result)).toBe(slug);
    expect(pagePath('es', 'pokemon', canonicalPokemonSlug(result))).toBe(`/es/pokemon/${slug}/`);
  });

  it('a regular pokemon slug resolves directly (no species request)', async () => {
    const calls = stubPokeApi();
    const result = await fetchPokemonBySlug<ReturnType<typeof pokemon>>('feraligatr');
    expect(result.name).toBe('feraligatr');
    expect(calls.some((url) => url.includes('pokemon-species'))).toBe(false);
  });

  it('legacy favorites saved under a default-form slug still load, and re-key to the species', async () => {
    stubPokeApi();
    const result = await fetchPokemonBySlug<ReturnType<typeof pokemon>>('basculin-red-striped');
    expect(result.name).toBe('basculin-red-striped');
    expect(canonicalPokemonSlug(result)).toBe('basculin');
  });

  it('a transient failure is not treated as "not a pokemon": no species fallback', async () => {
    const calls = stubPokeApi({ '/pokemon/basculin': 503 });
    const error = (await fetchPokemonBySlug('basculin').catch((e: unknown) => e)) as PokeApiHttpError;
    expect(error).toBeInstanceOf(PokeApiHttpError);
    expect(error.status).toBe(503);
    expect(calls.some((url) => url.includes('pokemon-species'))).toBe(false);
  });

  it('an unknown slug still fails', async () => {
    stubPokeApi();
    await expect(fetchPokemonBySlug('not-a-pokemon')).rejects.toBeInstanceOf(PokeApiHttpError);
  });
});
