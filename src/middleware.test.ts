import { describe, it, expect, vi } from 'vitest';
import type { APIContext, MiddlewareNext } from 'astro';
import { onRequest } from './middleware';
import { SITE_URL } from './utils/seo';
import { NotFoundError, UpstreamError } from './services/errors';

// The routePattern/params pairs below are what Astro's router hands the
// middleware for these requests: every page under src/pages/[lang]/ matches
// any first segment, and Astro passes the decoded segment as params.lang.
function run(path: string, routePattern: string, params: Record<string, string | undefined>) {
  const ok = new Response('page', { status: 200 });
  const next = vi.fn(async () => ok) as unknown as MiddlewareNext;
  const context = {
    request: new Request(`${SITE_URL}${path}`),
    routePattern,
    params,
    redirect: (location: string, status: number) =>
      new Response(null, { status, headers: { Location: location } }),
  } as unknown as APIContext;
  return { result: onRequest(context, next), next, ok };
}

describe('middleware: unsupported locales are 404', () => {
  it.each([
    ['/xx/', '/[lang]', { lang: 'xx' }],
    ['/fr/movimientos/', '/[lang]/movimientos', { lang: 'fr' }],
    ['/$%7Blang%7D/objetos/potion/', '/[lang]/objetos/[name]', { lang: '${lang}', name: 'potion' }],
  ])('%s -> 404 without rendering the page', async (path, routePattern, params) => {
    const { result, next } = run(path, routePattern, params);
    const response = await result;
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['/es/', '/[lang]', { lang: 'es' }],
    ['/en/', '/[lang]', { lang: 'en' }],
    ['/es/pokemon/feraligatr/', '/[lang]/pokemon/[name]', { lang: 'es', name: 'feraligatr' }],
  ])('%s renders normally', async (path, routePattern, params) => {
    const { result, next, ok } = run(path, routePattern, params);
    expect(await result).toBe(ok);
    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves non-locale routes alone (sitemap, OG images, API)', async () => {
    for (const [path, routePattern, params] of [
      ['/sitemap.xml', '/sitemap.xml', {}],
      ['/og/v1/xx/default.png/', '/og/v1/[lang]/default.png', { lang: 'xx' }],
      ['/api/suggestions/', '/api/suggestions', {}],
    ] as const) {
      const { result, ok } = run(path, routePattern, params);
      expect(await result).toBe(ok);
    }
  });

  it('maps a page\'s thrown NotFoundError / UpstreamError to 404 / 503 and re-throws real bugs', async () => {
    const withNext = (next: () => Promise<Response>) =>
      onRequest(
        {
          request: new Request(`${SITE_URL}/es/movimientos/surf/`),
          routePattern: '/[lang]/movimientos/[name]',
          params: { lang: 'es', name: 'surf' },
        } as unknown as APIContext,
        next as unknown as MiddlewareNext
      );

    expect((await withNext(async () => { throw new NotFoundError('x'); })).status).toBe(404);
    const unavailable = await withNext(async () => { throw new UpstreamError('x', 504); });
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('retry-after')).toBe('60');
    const bug = new TypeError('real bug');
    await expect(withNext(async () => { throw bug; })).rejects.toBe(bug);
  });

  it('keeps the root language negotiation redirect', async () => {
    const context = {
      request: new Request(`${SITE_URL}/`, { headers: { 'accept-language': 'en-US,en;q=0.9' } }),
      routePattern: '/',
      params: {},
      redirect: (location: string, status: number) =>
        new Response(null, { status, headers: { Location: location } }),
    } as unknown as APIContext;
    const response = await onRequest(context, vi.fn() as unknown as MiddlewareNext);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/en/');
  });
});
