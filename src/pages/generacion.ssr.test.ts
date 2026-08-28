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
      if (url.includes('/pokemon?limit=151&offset=0')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
              { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon/6/' },
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
