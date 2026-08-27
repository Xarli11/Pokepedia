import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TierLegend from './TierLegend.astro';
import { uiTranslations } from '../utils/pokemon';
import { TIER_DEFINITIONS } from '../services/smogon';

// SSR regression test (Sprint 1, P0 #14): assert known UI labels never leak
// into the wrong language, by actually rendering the component instead of
// inspecting source. This is a real reproduction of a live bug: before the
// fix, TIER_DEFINITIONS.desc was a single hardcoded Spanish string, so an
// EN-rendered page always showed Spanish tier descriptions.
describe('TierLegend SSR — no cross-language leaks', () => {
  it('renders only English tier descriptions on the EN locale', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TierLegend, { props: { lang: 'en' } });

    expect(html).toContain(uiTranslations.en.tier_legend);
    expect(html).not.toContain(uiTranslations.es.tier_legend);

    for (const tier of Object.values(TIER_DEFINITIONS)) {
      expect(html).toContain(tier.desc.en);
      // A Spanish-only description string must never appear on the EN page,
      // unless (coincidentally) it's identical to the EN one.
      if (tier.desc.es !== tier.desc.en) {
        expect(html).not.toContain(tier.desc.es);
      }
    }
  });

  it('renders only Spanish tier descriptions on the ES locale', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TierLegend, { props: { lang: 'es' } });

    expect(html).toContain(uiTranslations.es.tier_legend);
    expect(html).not.toContain(uiTranslations.en.tier_legend);

    for (const tier of Object.values(TIER_DEFINITIONS)) {
      expect(html).toContain(tier.desc.es);
      if (tier.desc.es !== tier.desc.en) {
        expect(html).not.toContain(tier.desc.en);
      }
    }
  });
});
