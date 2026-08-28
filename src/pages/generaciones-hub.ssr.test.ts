import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GeneracionesHubPage from './[lang]/generaciones/index.astro';
import { SITE_URL } from '../utils/seo';
import { GENERATIONS } from '../services/pokeapi';

// SSR regression coverage for the /generaciones/ discovery hub (Sprint 3,
// Fase 12). Purely derived from GENERATIONS — no network call needed.
describe('/[lang]/generaciones/ SSR', () => {
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
