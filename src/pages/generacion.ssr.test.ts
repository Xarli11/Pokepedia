import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GeneracionPage from './[lang]/generacion/[gen].astro';
import { SITE_URL } from '../utils/seo';

// SSR regression coverage for the generation landing pages (Sprint 3, Fase
// 5): this is the first real crawlable route for "Pokémon de primera
// generación" — previously only reachable via the homepage's ?gen= query
// param, which canonical/sitemap strip by design.
function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/generation/1')) {
        return {
          ok: true,
          json: async () => ({
            pokemon_species: [
              { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' },
              { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon-species/6/' },
            ],
          }),
        } as Response;
      }
      if (url.includes('play.pokemonshowdown.com/data/pokedex.json')) {
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              bulbasaur: { types: ['Grass', 'Poison'], baseStats: { hp: 45 } },
              charizard: { types: ['Fire', 'Flying'], baseStats: { hp: 78 } },
            }),
        } as unknown as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    })
  );
}

describe('/[lang]/generacion/[gen]/ SSR', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('renders the Spanish page with a localized title/H1, correct canonical/hreflang and the pokemon list', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionPage, {
      params: { lang: 'es', gen: '1' },
      request: new Request(`${SITE_URL}/es/generacion/1/`),
    });

    expect(html).toContain('Pokémon de Generación I (Kanto) | Pokepedia.app');
    expect(html).toContain('Generación I');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/generacion/1/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/generacion/1/">`);
    expect(html).toContain('href="/es/pokemon/bulbasaur"');
    expect(html).toContain('href="/es/pokemon/charizard"');
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/es/generation/1.png/">`);
  });

  it('renders the English page with a localized title/H1 and correct canonical/hreflang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionPage, {
      params: { lang: 'en', gen: '1' },
      request: new Request(`${SITE_URL}/en/generacion/1/`),
    });

    expect(html).toContain('Generation I Pokémon (Kanto) | Pokepedia.app');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/en/generacion/1/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="${SITE_URL}/es/generacion/1/">`);
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/en/generation/1.png/">`);
  });

  it('includes a breadcrumb trail with BreadcrumbList and ItemList JSON-LD', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionPage, {
      params: { lang: 'es', gen: '1' },
      request: new Request(`${SITE_URL}/es/generacion/1/`),
    });

    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"ItemList"');
  });

  it('redirects out-of-range generation numbers instead of rendering garbage', async () => {
    const container = await AstroContainer.create();
    const response = await container.renderToResponse(GeneracionPage, {
      params: { lang: 'es', gen: '99' },
      request: new Request(`${SITE_URL}/es/generacion/99/`),
    });

    expect(response.status).toBe(302);
  });
});

// Regression coverage for the Gen 9 undercount bug directly on the public
// route: /es/generacion/9/ must list all 120 species (906-1025), including
// the DLC additions past the old hardcoded 1015 ceiling — not just 110.
describe('/[lang]/generacion/9/ SSR — full DLC coverage', () => {
  function buildGen9Fixture() {
    const filler = Array.from({ length: 110 }, (_, i) => {
      const id = 906 + i;
      return { name: `gen9-species-${id}`, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` };
    });
    const dlcAdditions = [
      ['fezandipiti', 1016], ['ogerpon', 1017], ['archaludon', 1018], ['hydrapple', 1019],
      ['gouging-fire', 1020], ['raging-bolt', 1021], ['iron-boulder', 1022], ['iron-crown', 1023],
      ['terapagos', 1024], ['pecharunt', 1025],
    ].map(([name, id]) => ({ name: name as string, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` }));
    return [...filler, ...dlcAdditions];
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes('/generation/9')) {
          return { ok: true, json: async () => ({ pokemon_species: buildGen9Fixture() }) } as Response;
        }
        if (url.includes('play.pokemonshowdown.com/data/pokedex.json')) {
          return { ok: true, headers: new Headers(), text: async () => JSON.stringify({}) } as unknown as Response;
        }
        return { ok: false, json: async () => ({}) } as Response;
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists all 120 species and links to ogerpon/terapagos/pecharunt, past the old 1015 ceiling', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionPage, {
      params: { lang: 'es', gen: '9' },
      request: new Request(`${SITE_URL}/es/generacion/9/`),
    });

    expect(html).toContain('#0906–#1025');
    expect(html).toContain('href="/es/pokemon/ogerpon"');
    expect(html).toContain('href="/es/pokemon/terapagos"');
    expect(html).toContain('href="/es/pokemon/pecharunt"');
    // The count shown in the description must be the real 120, not the old 110.
    expect(html).toContain('Los 120 Pokémon de la Generación IX');
  });
});
