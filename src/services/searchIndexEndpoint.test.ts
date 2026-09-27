import { describe, it, expect } from 'vitest';
import { GET } from '../pages/search-index/[lang].json';
import { validateSearchIndex } from '../data/catalogs/searchIndex';

const call = (lang: string, query = '') => (GET as any)({ params: { lang }, url: new URL(`https://pokepedia.app/search-index/${lang}.json/${query}`) }) as Promise<Response>;

describe('/search-index/{lang}.json', () => {
  it.each(['es', 'en'])('serves the %s index as JSON with a versioned long cache', async (lang) => {
    const res = await call(lang, '?v=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    const body = await res.json();
    expect(body.lang).toBe(lang);
    validateSearchIndex(body);
  });

  it('an unversioned request gets a short cache, not immutable', async () => {
    expect((await call('es')).headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('unknown languages are 404', async () => {
    expect((await call('fr')).status).toBe(404);
  });
});
