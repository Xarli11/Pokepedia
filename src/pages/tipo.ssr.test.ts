import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TipoPage from './[lang]/tipo/[type].astro';
import { SITE_URL } from '../utils/seo';

// SSR regression coverage for the type landing pages (Sprint 3, Fase 4):
// correct per-locale title/H1/canonical/hreflang, breadcrumb + structured
// data present, and the Pokémon list actually rendered as crawlable links —
// not just a client-side filtered view like the homepage's type dropdown.
function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/type/dragon')) {
        return {
          ok: true,
          json: async () => ({
            name: 'dragon',
            pokemon: [
              { pokemon: { name: 'dratini', url: 'https://pokeapi.co/api/v2/pokemon/147/' }, slot: 1 },
              { pokemon: { name: 'dragonite', url: 'https://pokeapi.co/api/v2/pokemon/149/' }, slot: 1 },
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
              dratini: { types: ['Dragon'], baseStats: { hp: 41 } },
              dragonite: { types: ['Dragon', 'Flying'], baseStats: { hp: 91 } },
            }),
        } as unknown as Response;
      }
      // getGenerationMembershipMap fetches all 9 generations to build the
      // "by generation" breakdown — only Gen 1 (which owns dratini/dragonite,
      // ids 147/149) needs real members here.
      if (url.includes('/generation/1')) {
        return {
          ok: true,
          json: async () => ({
            pokemon_species: [
              { name: 'dratini', url: 'https://pokeapi.co/api/v2/pokemon-species/147/' },
              { name: 'dragonite', url: 'https://pokeapi.co/api/v2/pokemon-species/149/' },
            ],
          }),
        } as Response;
      }
      if (url.includes('/generation/')) {
        return { ok: true, json: async () => ({ pokemon_species: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    })
  );
}

describe('/[lang]/tipo/[type]/ SSR', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('renders the Spanish page with a localized title/H1 and correct canonical/hreflang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TipoPage, {
      params: { lang: 'es', type: 'dragon' },
      request: new Request(`${SITE_URL}/es/tipo/dragon/`),
    });

    expect(html).toContain('Pokémon de tipo Dragón: lista y estadísticas | Pokepedia.app');
    expect(html).toContain('>Dragón<');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/tipo/dragon/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/tipo/dragon/">`);
    expect(html).toContain('href="/es/pokemon/dratini"');
    expect(html).toContain('href="/es/pokemon/dragonite"');
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/es/type/dragon.png/">`);
  });

  it('renders the English page with a localized title/H1 and correct canonical/hreflang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TipoPage, {
      params: { lang: 'en', type: 'dragon' },
      request: new Request(`${SITE_URL}/en/tipo/dragon/`),
    });

    expect(html).toContain('Dragon-type Pokémon: List &amp; Stats | Pokepedia.app');
    expect(html).toContain('>Dragon<');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/en/tipo/dragon/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="${SITE_URL}/es/tipo/dragon/">`);
    expect(html).toContain('href="/en/pokemon/dratini"');
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/en/type/dragon.png/">`);
  });

  it('includes a breadcrumb trail with BreadcrumbList JSON-LD', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TipoPage, {
      params: { lang: 'es', type: 'dragon' },
      request: new Request(`${SITE_URL}/es/tipo/dragon/`),
    });

    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"ItemList"');
  });

  it('classifies both Pokémon into Generación I via getGenerationMembershipMap', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TipoPage, {
      params: { lang: 'es', type: 'dragon' },
      request: new Request(`${SITE_URL}/es/tipo/dragon/`),
    });

    expect(html).toContain('href="/es/generacion/1/"');
    expect(html).toContain('Generación I');
    expect(html).toContain('(2)');
  });
});
