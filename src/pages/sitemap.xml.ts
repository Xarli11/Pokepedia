import type { APIRoute } from 'astro';
import { getAllPokemonBasic, getAllMoves, getAllAbilities, getAllItems, GENERATIONS } from '../services/pokeapi';
import { buildSitemapEntries, renderSitemapXml, type SitemapUrlEntry } from '../utils/sitemap';
import { typeColors } from '../utils/pokemon';
import { indexableItems } from '../utils/itemIndexing';

interface NamedEntity {
  name: string;
}

/**
 * Pure entry-list -> XML builder, with no dependency on the request/route
 * context. Kept separate from GET() so it's directly unit-testable without
 * fabricating an APIContext the route doesn't actually use.
 */
export function buildSitemapXml(
  pokemon: NamedEntity[],
  moves: NamedEntity[],
  abilities: NamedEntity[],
  items: NamedEntity[]
): string {
  const staticPages = [
    { path: '/', priority: '1.0' },
    { path: '/movimientos/', priority: '0.9' },
    { path: '/habilidades/', priority: '0.9' },
    { path: '/objetos/', priority: '0.9' },
    { path: '/tipos/', priority: '0.8' },
    { path: '/generaciones/', priority: '0.8' },
    { path: '/fuentes/', priority: '0.4' },
  ];

  const typeSlugs = Object.keys(typeColors);
  const generationNums = Object.keys(GENERATIONS).map((k) => k.replace('gen', ''));

  const entries: SitemapUrlEntry[] = [
    ...staticPages.flatMap((p) => buildSitemapEntries(p.path, p.priority)),
    ...pokemon.flatMap((p) => buildSitemapEntries(`/pokemon/${p.name}`, '0.8')),
    ...moves.flatMap((m) => buildSitemapEntries(`/movimientos/${m.name}`, '0.6')),
    ...abilities.flatMap((a) => buildSitemapEntries(`/habilidades/${a.name}`, '0.6')),
    // Only indexable items: noindex ones (src/data/itemSeoManifest.json) stay
    // reachable pages but never appear here.
    ...indexableItems(items).flatMap((i) => buildSitemapEntries(`/objetos/${i.name}`, '0.5')),
    ...typeSlugs.flatMap((tp) => buildSitemapEntries(`/tipo/${tp}`, '0.7')),
    ...generationNums.flatMap((n) => buildSitemapEntries(`/generacion/${n}`, '0.7')),
  ];

  return renderSitemapXml(entries);
}

// Every entity family is a required dependency of the sitemap. It used to
// swallow a failing family (safeList -> []) and answer 200 with the rest,
// cached for 24 h by s-maxage: a transient PokeAPI blip would have told
// crawlers that all moves (or abilities, or items) had left the site. A
// failure now propagates as UpstreamError, which src/middleware.ts answers
// 503 + Retry-After + no-store — a retryable status crawlers understand —
// and the catalogs' stale-on-error copy (services/pokeapi.ts) makes even
// that rare. The sitemap costs 4 requests (one per catalog), all cached.
export const GET: APIRoute = async () => {
  const [pokemon, moves, abilities, items] = await Promise.all([
    getAllPokemonBasic(),
    getAllMoves(),
    getAllAbilities(),
    getAllItems(),
  ]);

  return new Response(buildSitemapXml(pokemon, moves, abilities, items), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
};
