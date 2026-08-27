import { describe, it, expect } from 'vitest';
import { buildSitemapEntries, renderSitemapXml } from './sitemap';
import { SITE_URL } from './seo';

describe('buildSitemapEntries', () => {
  it('emits one entry per supported language with reciprocal hreflang alternates', () => {
    const entries = buildSitemapEntries('/pokemon/charizard');
    expect(entries).toHaveLength(2);

    const esEntry = entries.find((e) => e.loc === `${SITE_URL}/es/pokemon/charizard/`);
    const enEntry = entries.find((e) => e.loc === `${SITE_URL}/en/pokemon/charizard/`);
    expect(esEntry).toBeDefined();
    expect(enEntry).toBeDefined();

    expect(esEntry!.hreflangs).toContainEqual({ lang: 'en', href: `${SITE_URL}/en/pokemon/charizard/` });
    expect(esEntry!.hreflangs).toContainEqual({ lang: 'x-default', href: `${SITE_URL}/` });
  });

  it('normalizes a path suffix without a leading slash', () => {
    const entries = buildSitemapEntries('objetos/life-orb');
    expect(entries.map((e) => e.loc)).toContain(`${SITE_URL}/es/objetos/life-orb/`);
  });

  it('applies the given priority/changefreq to every emitted entry', () => {
    const entries = buildSitemapEntries('/movimientos/earthquake', '0.6', 'monthly');
    entries.forEach((e) => {
      expect(e.priority).toBe('0.6');
      expect(e.changefreq).toBe('monthly');
    });
  });
});

describe('renderSitemapXml', () => {
  it('never emits a <lastmod> tag', () => {
    const xml = renderSitemapXml(buildSitemapEntries('/pokemon/charizard'));
    expect(xml).not.toContain('<lastmod>');
  });

  it('produces well-formed, non-duplicated <loc> entries', () => {
    const entries = [...buildSitemapEntries('/pokemon/charizard'), ...buildSitemapEntries('/movimientos/earthquake')];
    const xml = renderSitemapXml(entries);
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs.every((loc) => loc.startsWith(SITE_URL) && loc.endsWith('/'))).toBe(true);
  });

  it('includes the standard urlset namespace declarations', () => {
    const xml = renderSitemapXml(buildSitemapEntries('/pokemon/charizard'));
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});
