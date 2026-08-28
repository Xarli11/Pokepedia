import { describe, it, expect } from 'vitest';
import { buildSitemapXml } from './sitemap.xml';

describe('buildSitemapXml', () => {
  it('includes the Sources & Methodology page for both locales', () => {
    const xml = buildSitemapXml([], [], [], []);

    expect(xml).toContain('<loc>https://pokepedia.app/es/fuentes/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/fuentes/</loc>');
  });

  it('produces well-formed XML with the sitemap namespace', () => {
    const xml = buildSitemapXml([], [], [], []);

    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('includes an entry per entity family when given real lists', () => {
    const xml = buildSitemapXml(
      [{ name: 'pikachu' }],
      [{ name: 'thunderbolt' }],
      [{ name: 'static' }],
      [{ name: 'light-ball' }]
    );

    expect(xml).toContain('<loc>https://pokepedia.app/es/pokemon/pikachu/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/movimientos/thunderbolt/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/habilidades/static/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/objetos/light-ball/</loc>');
  });

  it('includes all 18 type landing pages and the /tipos/ hub, both locales', () => {
    const xml = buildSitemapXml([], [], [], []);

    expect(xml).toContain('<loc>https://pokepedia.app/es/tipo/dragon/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/tipo/dragon/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/tipo/fairy/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/tipos/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/tipos/</loc>');
  });

  it('includes all 9 generation landing pages and the /generaciones/ hub, both locales', () => {
    const xml = buildSitemapXml([], [], [], []);

    expect(xml).toContain('<loc>https://pokepedia.app/es/generacion/1/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/generacion/1/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/generacion/9/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/es/generaciones/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/generaciones/</loc>');
  });
});
