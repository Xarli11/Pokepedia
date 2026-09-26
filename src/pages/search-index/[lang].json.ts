import type { APIRoute } from 'astro';
import { isSupportedLang } from '../../utils/seo';

// The compact global-search index for one language (src/data/generated/
// search-index.{lang}.json, built by scripts/generate-catalogs.ts). The page
// requests it once, lazily, with ?v=<content hash> from manifest.json, so a
// versioned URL can be cached for a year while a regeneration is picked up
// immediately. Served from the bundle: no upstream request.

const bodies = new Map<string, string>();

async function bodyFor(lang: 'es' | 'en'): Promise<string> {
  let body = bodies.get(lang);
  if (!body) {
    const mod = lang === 'en' ? await import('../../data/generated/search-index.en.json') : await import('../../data/generated/search-index.es.json');
    body = JSON.stringify(mod.default);
    bodies.set(lang, body);
  }
  return body;
}

export const GET: APIRoute = async ({ params, url }) => {
  const lang = params.lang;
  if (!lang || !isSupportedLang(lang)) return new Response('Not found', { status: 404 });
  return new Response(await bodyFor(lang), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    },
  });
};
