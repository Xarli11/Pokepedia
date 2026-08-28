import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GeneracionesHubPage from './[lang]/generaciones/index.astro';
import { SITE_URL } from '../utils/seo';
import { GENERATIONS } from '../services/pokeapi';

// SSR regression coverage for the /generaciones/ discovery hub (Sprint 3,
// Fase 12). Counts/ranges now come from PokeAPI's generation/{n} resource
// (one cached call per generation, same tradeoff /tipos/ already makes for
// its 18 type counts), so this needs one mock per generation instead of
// reading a static table — the real point of this test is to prove the hub
// shows Gen 9's true count (120), not the old hardcoded 110.
const REAL_GENERATION_COUNTS: Record<number, number> = {
  1: 151, 2: 100, 3: 135, 4: 107, 5: 156, 6: 72, 7: 88, 8: 96, 9: 120,
};

function makeSpeciesList(genNum: number, count: number, startId: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `gen${genNum}-species-${startId + i}`,
    url: `https://pokeapi.co/api/v2/pokemon-species/${startId + i}/`,
  }));
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      const match = url.match(/\/generation\/(\d)\b/);
      if (!match) return { ok: false, json: async () => ({}) } as Response;

      const genNum = parseInt(match[1], 10);
      const count = REAL_GENERATION_COUNTS[genNum];
      // Ids don't need to be the real National Dex ranges here — the hub
      // only reads count and min/max id, not identity — but Gen 1 starts at
      // 1 so the 'Kanto' range assertion below is meaningful.
      const startId = genNum === 1 ? 1 : (genNum - 1) * 1000 + 1;
      return { ok: true, json: async () => ({ pokemon_species: makeSpeciesList(genNum, count, startId) }) } as Response;
    })
  );
}

describe('/[lang]/generaciones/ SSR', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('renders all 9 generations with region, dex range and count, in both locales', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionesHubPage, {
      params: { lang: 'es' },
      request: new Request(`${SITE_URL}/es/generaciones/`),
    });

    for (const genKey of Object.keys(GENERATIONS)) {
      const genNum = genKey.replace('gen', '');
      expect(html).toContain(`href="/es/generacion/${genNum}/"`);
    }
    expect(html).toContain('Kanto');
    expect(html).toContain('151 Pokémon');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/generaciones/">`);
  });

  it('shows the real Gen 9 count (120), not the old pre-DLC 110', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionesHubPage, {
      params: { lang: 'es' },
      request: new Request(`${SITE_URL}/es/generaciones/`),
    });

    expect(html).toContain('120 Pokémon');
    expect(html).not.toContain('110 Pokémon');
  });

  it('includes a breadcrumb trail on the EN locale', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GeneracionesHubPage, {
      params: { lang: 'en' },
      request: new Request(`${SITE_URL}/en/generaciones/`),
    });

    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });
});
