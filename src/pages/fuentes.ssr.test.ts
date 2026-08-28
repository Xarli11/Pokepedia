import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import FuentesPage from './[lang]/fuentes/index.astro';
import { uiTranslations } from '../utils/pokemon';
import { SITE_URL } from '../utils/seo';

// Astro escapes text interpolations, so a raw "&" in a translation string
// (e.g. "Sources & Methodology") never appears literally in rendered HTML.
const htmlEscaped = (s: string) => s.replace(/&/g, '&amp;');

// SSR regression coverage for the Sources & Methodology route (Fase 6):
// correct per-locale title/content, and canonical/hreflang wired through
// Layout.astro the same way every other page gets it (no special-casing).
describe('/[lang]/fuentes/ SSR', () => {
  it('renders the Spanish page with es content and correct canonical/hreflang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FuentesPage, {
      params: { lang: 'es' },
      request: new Request(`${SITE_URL}/es/fuentes/`),
    });

    expect(html).toContain(htmlEscaped(uiTranslations.es.sources_title));
    expect(html).toContain(uiTranslations.es.sources_intro_body);
    expect(html).not.toContain(uiTranslations.en.sources_intro_body);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/fuentes/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="${SITE_URL}/es/fuentes/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/fuentes/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/">`);
  });

  it('renders the English page with en content and correct canonical/hreflang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FuentesPage, {
      params: { lang: 'en' },
      request: new Request(`${SITE_URL}/en/fuentes/`),
    });

    expect(html).toContain(htmlEscaped(uiTranslations.en.sources_title));
    expect(html).toContain(uiTranslations.en.sources_intro_body);
    expect(html).not.toContain(uiTranslations.es.sources_intro_body);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/en/fuentes/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/fuentes/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="es" href="${SITE_URL}/es/fuentes/">`);
  });

  it('links out to PokeAPI, Pokémon Showdown and Smogon', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FuentesPage, {
      params: { lang: 'en' },
      request: new Request(`${SITE_URL}/en/fuentes/`),
    });

    expect(html).toContain('https://pokeapi.co');
    expect(html).toContain('https://pokemonshowdown.com');
    expect(html).toContain('https://www.smogon.com');
  });
});
