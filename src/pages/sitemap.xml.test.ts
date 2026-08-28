import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/pokeapi', () => ({
  getAllPokemonBasic: vi.fn(async () => []),
  getAllMoves: vi.fn(async () => []),
  getAllAbilities: vi.fn(async () => []),
  getAllItems: vi.fn(async () => []),
}));

describe('sitemap.xml route', () => {
  it('includes the Sources & Methodology page for both locales', async () => {
    const { GET } = await import('./sitemap.xml');
    const response = await GET({} as any);
    const xml = await response.text();

    expect(xml).toContain('<loc>https://pokepedia.app/es/fuentes/</loc>');
    expect(xml).toContain('<loc>https://pokepedia.app/en/fuentes/</loc>');
  });

  it('serves well-formed XML with the sitemap content type', async () => {
    const { GET } = await import('./sitemap.xml');
    const response = await GET({} as any);

    expect(response.headers.get('Content-Type')).toBe('application/xml');
    const xml = await response.text();
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});
