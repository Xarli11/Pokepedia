import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveFavorites } from './favorites';
import { fetchPokemonBySlug, POKEAPI_BASE } from './pokeapiClient';
import { canonicalPokemonSlug, pagePath } from './seo';

// Regression for v0.11.0: stored favorites ["basculin-red-striped", "basculin"]
// are the same Pokémon. The favorites view must render ONE card on the very
// first load (not only after the storage migration) and store ["basculin"].
// Resolution goes through the real browser resolver against a PokeAPI mock
// that mirrors live data (species-only slugs are a 404 on pokemon/{slug}).

type Variety = [name: string, id: number, isDefault: boolean];
type Pokemon = { id: number; name: string; is_default: boolean; species: { name: string } };

const SPECIES: Record<string, Variety[]> = {
  basculin: [['basculin-red-striped', 550, true], ['basculin-blue-striped', 10016, false]],
  deoxys: [['deoxys-normal', 386, true], ['deoxys-attack', 10001, false]],
  zygarde: [['zygarde-50', 718, true], ['zygarde-10-power-construct', 10118, false]],
  feraligatr: [['feraligatr', 160, true]],
};
const POKEMON: Record<string, Pokemon> = {};
for (const [speciesName, varieties] of Object.entries(SPECIES)) {
  for (const [name, id, isDefault] of varieties) {
    POKEMON[name] = POKEMON[String(id)] = { id, name, is_default: isDefault, species: { name: speciesName } };
  }
}

function stubPokeApi(failing: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const path = String(input).replace(POKEAPI_BASE, '').replace(/\/$/, '');
      const reply = (status: number, body: unknown = {}) =>
        ({ ok: status < 300, status, json: async () => body }) as unknown as Response;
      const [, kind, key] = path.split('/');
      if (failing.includes(key)) return reply(503);
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
}

const resolve = (names: string[]) => resolveFavorites<Pokemon>(names, (name) => fetchPokemonBySlug<Pokemon>(name));
const cardHrefs = (entities: Pokemon[]) => entities.map((p) => pagePath('es', 'pokemon', canonicalPokemonSlug(p)));

afterEach(() => vi.unstubAllGlobals());

describe('resolveFavorites: one entry per canonical Pokémon, from the first load', () => {
  it.each([
    ['A', ['basculin-red-striped', 'basculin'], 'basculin'],
    ['B', ['deoxys-normal', 'deoxys'], 'deoxys'],
    ['C', ['zygarde-50', 'zygarde'], 'zygarde'],
  ])('%s: %j -> a single card and storage [%s]', async (_, stored, canonical) => {
    stubPokeApi();
    const { keys, entities } = await resolve(stored as string[]);
    expect(keys).toEqual([canonical]);
    expect(entities).toHaveLength(1);
    expect(cardHrefs(entities)).toEqual([`/es/pokemon/${canonical}/`]);
  });

  it('the canonical-first order dedupes the same way', async () => {
    stubPokeApi();
    const { keys, entities } = await resolve(['basculin', 'basculin-red-striped']);
    expect(keys).toEqual(['basculin']);
    expect(entities).toHaveLength(1);
  });

  it('D: a real alternate form stays a distinct favorite (basculin vs basculin-blue-striped)', async () => {
    stubPokeApi();
    const { keys, entities } = await resolve(['basculin', 'basculin-blue-striped']);
    expect(keys).toEqual(['basculin', 'basculin-blue-striped']);
    expect(cardHrefs(entities)).toEqual(['/es/pokemon/basculin/', '/es/pokemon/basculin-blue-striped/']);
  });

  it('E: a regular favorite is left unchanged', async () => {
    stubPokeApi();
    const { keys, entities } = await resolve(['feraligatr']);
    expect(keys).toEqual(['feraligatr']);
    expect(cardHrefs(entities)).toEqual(['/es/pokemon/feraligatr/']);
  });

  it('keeps first-seen order across a mixed list', async () => {
    stubPokeApi();
    const { keys } = await resolve(['zygarde-50', 'feraligatr', 'basculin', 'zygarde', 'basculin-red-striped', 'deoxys-attack']);
    expect(keys).toEqual(['zygarde', 'feraligatr', 'basculin', 'deoxys-attack']);
  });

  it('a favorite that fails to resolve (PokeAPI down) stays stored but is not rendered', async () => {
    stubPokeApi(['deoxys']);
    const { keys, entities } = await resolve(['deoxys', 'feraligatr']);
    expect(keys).toEqual(['deoxys', 'feraligatr']);
    expect(cardHrefs(entities)).toEqual(['/es/pokemon/feraligatr/']);
  });
});
