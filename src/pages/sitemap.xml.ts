import type { APIRoute } from 'astro';
import { getAllPokemonBasic, getAllMoves, getAllAbilities, getAllItems } from '../services/pokeapi';
import { buildSitemapEntries, renderSitemapXml, type SitemapUrlEntry } from '../utils/sitemap';

// Root cause fixed here: `moves`/`abilities`/`items` used to be declared and
// never populated, so those entity families were silently absent from the
// sitemap despite having live detail pages. Each family is now fetched
// independently via Promise.allSettled so a slow/failing upstream family
// (e.g. PokeAPI timing out) degrades that family only, instead of throwing
// away the entire sitemap.
async function safeList<T extends { name: string }>(
  promise: Promise<T[]>,
  label: string
): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    console.error(`Sitemap: failed to load ${label}`, error);
    return [];
  }
}

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
    { path: '/fuentes/', priority: '0.4' },
  ];

  const entries: SitemapUrlEntry[] = [
    ...staticPages.flatMap((p) => buildSitemapEntries(p.path, p.priority)),
    ...pokemon.flatMap((p) => buildSitemapEntries(`/pokemon/${p.name}`, '0.8')),
    ...moves.flatMap((m) => buildSitemapEntries(`/movimientos/${m.name}`, '0.6')),
    ...abilities.flatMap((a) => buildSitemapEntries(`/habilidades/${a.name}`, '0.6')),
    ...items.flatMap((i) => buildSitemapEntries(`/objetos/${i.name}`, '0.5')),
  ];

  return renderSitemapXml(entries);
}

export const GET: APIRoute = async () => {
  const [pokemon, moves, abilities, items] = await Promise.all([
    safeList(getAllPokemonBasic(1025), 'pokemon'),
    safeList(getAllMoves(), 'moves'),
    safeList(getAllAbilities(), 'abilities'),
    safeList(getAllItems(), 'items'),
  ]);

  return new Response(buildSitemapXml(pokemon, moves, abilities, items), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
};
