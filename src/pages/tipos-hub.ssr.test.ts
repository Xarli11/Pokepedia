import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TiposHubPage from './[lang]/tipos/index.astro';
import { SITE_URL } from '../utils/seo';
import { typeColors } from '../utils/pokemon';

// SSR regression coverage for the /tipos/ discovery hub (Sprint 3, Fase 12):
// must list all 18 types with a real per-type count, not a bare link list.
function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/api/v2/type/')) {
        return {
          ok: true,
          json: async () => ({
            pokemon: [
              { pokemon: { name: 'test-a', url: 'https://pokeapi.co/api/v2/pokemon/1/' } },
              { pokemon: { name: 'test-b', url: 'https://pokeapi.co/api/v2/pokemon/2/' } },
            ],
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    })
  );
}

describe('/[lang]/tipos/ SSR', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('renders all 18 types with a link and a count, in both locales', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TiposHubPage, {
      params: { lang: 'es' },
      request: new Request(`${SITE_URL}/es/tipos/`),
    });

    for (const typeSlug of Object.keys(typeColors)) {
      expect(html).toContain(`href="/es/tipo/${typeSlug}/"`);
    }
    expect(html).toContain('2 Pokémon');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/tipos/">`);
  });

  it('includes a breadcrumb trail', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TiposHubPage, {
      params: { lang: 'en' },
      request: new Request(`${SITE_URL}/en/tipos/`),
    });

    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });
});
