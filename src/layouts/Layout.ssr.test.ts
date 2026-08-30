import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Layout from './Layout.astro';
import { SITE_URL } from '../utils/seo';

// Coverage for this sprint's Layout.astro changes: every page gets a real,
// self-hosted 1200x630 social card by default (never the pokeball brand
// icon), entity pages can override it with their own local /og/ route, and
// og:locale is now declared. Canonical/hreflang are untouched by this
// sprint — see the pre-existing SEO test suite (seo.test.ts) for that
// contract; here we only assert they still render, not that their values
// changed.
describe('Layout.astro OG metadata', () => {
	it('falls back to the localized default OG card when no image prop is given (es)', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/es/`),
			props: { lang: 'es' },
			slots: { default: 'content' },
		});

		expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/es/default.png/">`);
		expect(html).toContain(`<meta property="og:image:secure_url" content="${SITE_URL}/og/v1/es/default.png/">`);
		expect(html).toContain('<meta property="og:image:width" content="1200">');
		expect(html).toContain('<meta property="og:image:height" content="630">');
		expect(html).toContain('<meta property="og:image:type" content="image/png">');
		// pokeball.png legitimately remains as the favicon/apple-touch-icon —
		// only the OG/Twitter image fields must not point at it.
		expect(html).not.toMatch(/property="(og|twitter):image"[^>]*pokeball\.png/);
	});

	it('falls back to the localized default OG card for en', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/en/`),
			props: { lang: 'en' },
			slots: { default: 'content' },
		});

		expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/en/default.png/">`);
	});

	it('uses an explicit local /og/ image prop verbatim (entity pages) and never raw.githubusercontent', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/es/pokemon/dragonite/`),
			props: { lang: 'es', image: '/og/v1/es/pokemon/dragonite.png/', imageAlt: 'Dragonite' },
			slots: { default: 'content' },
		});

		expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/v1/es/pokemon/dragonite.png/">`);
		expect(html).toContain('<meta property="og:image:alt" content="Dragonite">');
		// raw.githubusercontent.com legitimately remains as a <link rel="preconnect">
		// perf hint (the page's on-page artwork <img> still points there) —
		// only the OG/Twitter image fields must never resolve to it.
		expect(html).not.toMatch(/property="(og|twitter):image"[^>]*raw\.githubusercontent\.com/);
	});

	it('declares og:locale and its alternate, matching the page language', async () => {
		const container = await AstroContainer.create();
		const htmlEs = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/es/`),
			props: { lang: 'es' },
			slots: { default: 'content' },
		});
		expect(htmlEs).toContain('<meta property="og:locale" content="es_ES">');
		expect(htmlEs).toContain('<meta property="og:locale:alternate" content="en_US">');

		const htmlEn = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/en/`),
			props: { lang: 'en' },
			slots: { default: 'content' },
		});
		expect(htmlEn).toContain('<meta property="og:locale" content="en_US">');
		expect(htmlEn).toContain('<meta property="og:locale:alternate" content="es_ES">');
	});

	it('canonical and hreflang still render (untouched by this sprint)', async () => {
		const container = await AstroContainer.create();
		const html = await container.renderToString(Layout, {
			request: new Request(`${SITE_URL}/es/tipo/dragon/`),
			props: { lang: 'es' },
			slots: { default: 'content' },
		});

		expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/tipo/dragon/">`);
		expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/tipo/dragon/">`);
		expect(html).toContain('<link rel="alternate" hreflang="x-default"');
	});
});
