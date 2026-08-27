// src/utils/sitemap.ts
//
// Pure helpers for building the sitemap XML. Reuses seo.ts so sitemap URLs
// are always canonical/trailing-slash-consistent with what Layout.astro
// emits — a single source of truth instead of a second ad hoc URL builder.

import { SUPPORTED_LANGS, canonicalUrl, localeAlternates, type SupportedLang } from './seo';

export interface SitemapUrlEntry {
  loc: string;
  hreflangs: { lang: string; href: string }[];
  priority: string;
  changefreq: string;
}

/**
 * Builds one entry per supported language for a given path suffix
 * (e.g. "/pokemon/charizard"), each carrying reciprocal hreflang alternates.
 * No `lastmod` is included — see renderSitemapXml for why.
 */
export function buildSitemapEntries(
  pathSuffix: string,
  priority: string = '0.7',
  changefreq: string = 'weekly'
): SitemapUrlEntry[] {
  const suffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;

  return SUPPORTED_LANGS.map((lang: SupportedLang) => {
    const loc = canonicalUrl(`/${lang}${suffix}`);
    const alt = localeAlternates(`/${lang}${suffix}`);
    return {
      loc,
      hreflangs: [
        { lang: 'es', href: alt.es },
        { lang: 'en', href: alt.en },
        { lang: 'x-default', href: alt.xDefault },
      ],
      priority,
      changefreq,
    };
  });
}

/**
 * Renders a full <urlset> document.
 *
 * `lastmod` is intentionally never emitted: PokeAPI does not expose a
 * reliable per-entity last-modified date, and stamping every URL with
 * today's date on every request is misleading (it implies every Pokémon,
 * move, ability and item changed today, which search engines can penalize
 * as untrustworthy freshness signaling).
 */
export function renderSitemapXml(entries: SitemapUrlEntry[]): string {
  const body = entries
    .map(
      (e) => `
  <url>
    <loc>${e.loc}</loc>
    ${e.hreflangs.map((h) => `<xhtml:link rel="alternate" hreflang="${h.lang}" href="${h.href}"/>`).join('\n    ')}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}\n</urlset>`;
}
