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

// --- Phase 5: sitemap reliability and cost --------------------------------
import { vi, afterEach, beforeEach } from 'vitest';
import type { APIContext, MiddlewareNext } from 'astro';

const API = 'https://pokeapi.co/api/v2';
const family = (resource: string, n: number) => ({
  count: n,
  next: null,
  results: Array.from({ length: n }, (_, i) => ({ name: `${resource}-${i}`, url: `${API}/${resource}/${i + 1}/` })),
});

function stubUpstream(failing?: string) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const resource = ['pokemon-species', 'move', 'ability', 'item'].find((r) => url.includes(`/${r}?`))!;
      if (resource === failing) return { ok: false, status: 503, headers: new Headers(), json: async () => ({}) } as unknown as Response;
      const n = { 'pokemon-species': 5, move: 4, ability: 3, item: 2 }[resource]!;
      return { ok: true, status: 200, headers: new Headers(), json: async () => family(resource, n) } as unknown as Response;
    })
  );
  return calls;
}

async function freshSitemap() {
  vi.resetModules();
  const mod = await import('./sitemap.xml');
  const { onRequest } = await import('../middleware');
  const run = () =>
    onRequest(
      { request: new Request('https://pokepedia.app/sitemap.xml'), routePattern: '/sitemap.xml', params: {}, redirect: () => new Response(null) } as unknown as APIContext,
      (() => mod.GET({} as APIContext)) as unknown as MiddlewareNext
    ) as Promise<Response>;
  return { run };
}

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('answers 200 with every family, using one catalog request per family', async () => {
    const calls = stubUpstream();
    const { run } = await freshSitemap();
    const res = await run();
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(4);
    const xml = await res.text();
    expect(xml).toContain('/es/pokemon/pokemon-species-0/');
    expect(xml).toContain('/es/movimientos/move-3/');
    expect(xml).toContain('/es/habilidades/ability-2/');
    expect(xml).toContain('/es/objetos/item-1/');
  });

  it('is stable: two requests return the identical document', async () => {
    stubUpstream();
    const { run } = await freshSitemap();
    const a = await (await run()).text();
    const b = await (await run()).text();
    expect(a).toBe(b);
  });

  it.each(['pokemon-species', 'move', 'ability', 'item'])(
    'a failing %s catalog is a 503 + Retry-After + no-store, never a partial 200 sitemap',
    async (failing) => {
      stubUpstream(failing);
      const { run } = await freshSitemap();
      const res = await run();
      expect(res.status).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('60');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
  );
});
