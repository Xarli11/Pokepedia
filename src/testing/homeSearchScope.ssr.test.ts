import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import HomePage from '../pages/[lang]/index.astro';
import { SITE_URL } from '../utils/seo';

// UX polish: the Pokédex home search box is a LOCAL filter over the current
// generation/favorites grid — never a second global-entity search. The
// header's own global search (Layout.astro) is untouched and unaffected.

const API = 'https://pokeapi.co/api/v2';

const FIXTURES: Record<string, unknown> = {
  [`${API}/generation/1`]: { pokemon_species: [{ name: 'bulbasaur', url: `${API}/pokemon-species/1/` }, { name: 'charizard', url: `${API}/pokemon-species/6/` }] },
  [`${API}/generation/4`]: { pokemon_species: [{ name: 'turtwig', url: `${API}/pokemon-species/387/` }, { name: 'garchomp', url: `${API}/pokemon-species/445/` }] },
  [`${API}/generation/5`]: { pokemon_species: [{ name: 'victini', url: `${API}/pokemon-species/494/` }] },
  'https://play.pokemonshowdown.com/data/pokedex.json': {},
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input).replace(/\/$/, '');
    const data = FIXTURES[url];
    if (data === undefined) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

const render = async (lang: string, gen: string) =>
  (await AstroContainer.create()).renderToString(HomePage, { params: { lang }, request: new Request(`${SITE_URL}/${lang}/?gen=${gen}`) });

describe('Pokédex home search: local, not global', () => {
  it('ES/Kanto: placeholder names the region, input is "pokedex-search" not "global-search"', async () => {
    const html = await render('es', 'gen1');
    expect(html).toContain('id="pokedex-search"');
    expect(html).toContain('placeholder="Buscar Pokémon en Kanto..."');
    expect(html).not.toContain('id="global-search"');
  });

  it('EN/Sinnoh (gen4): placeholder in English', async () => {
    const html = await render('en', 'gen4');
    expect(html).toContain('placeholder="Search Pokémon in Sinnoh..."');
  });

  it('EN/Unova (gen5): the search placeholder says "Unova", not the Spanish "Teselia"', async () => {
    // The generation-pill label itself still says "Teselia" on EN pages too
    // (GENERATIONS.region is one ES/EN-agnostic string) — a pre-existing,
    // separate bug not fixed in this phase. This only asserts the NEW
    // placeholder text, which must not inherit that mistake.
    const html = await render('en', 'gen5');
    expect(html).toContain('placeholder="Search Pokémon in Unova..."');
  });

  it('ES/Unova (gen5): region label stays "Teselia" in Spanish', async () => {
    const html = await render('es', 'gen5');
    expect(html).toContain('placeholder="Buscar Pokémon en Teselia..."');
  });

  it('favorites: placeholder is favorites-specific, not region-specific', async () => {
    const es = await render('es', 'favorites');
    expect(es).toContain('placeholder="Buscar en favoritos..."');
    const en = await render('en', 'favorites');
    expect(en).toContain('placeholder="Search favorites..."');
  });

  it('no global multi-entity dropdown markup on this page (removed, not just hidden)', async () => {
    const html = await render('es', 'gen1');
    expect(html).not.toContain('search-suggestions');
    expect(html).not.toContain('suggestions-list');
  });

  it('no global search-index request is wired to this surface (no data-search-version on index-data)', async () => {
    const html = await render('es', 'gen1');
    const indexData = html.match(/<div id="index-data"[^>]*>/)?.[0] ?? '';
    expect(indexData).not.toContain('data-search-version');
    expect(indexData).toContain('data-region="Kanto"');
  });

  it("the header's global search modal is untouched: still present, still global", async () => {
    const html = await render('es', 'gen1');
    expect(html).toContain('id="global-search-modal"');
    expect(html).toContain('id="global-search-input"');
    expect(html).toContain('id="global-search-trigger"');
  });

  it('default (no-query) empty state text is centralized and type-only, not "search suggestions" wording', async () => {
    const html = await render('es', 'gen1');
    expect(html).toContain('id="no-results-title"');
    expect(html).toContain('id="no-results-body"');
    expect(html).not.toMatch(/sugerencias/i);
  });
});
