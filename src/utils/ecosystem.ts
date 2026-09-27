// src/utils/ecosystem.ts
//
// Boundaries between the three sibling products (see docs/DATA_SOURCES.md):
//   Pokepedia  → factual, structured Pokémon knowledge.
//   PokeTypes  → type matchups / coverage (deep links live in utils/pokemon.ts).
//   PokeStudio → team building, sets, strategy, damage calculation.
//
// PokeStudio has no public, stable URL yet, so nothing may link to it. This
// is the single place to switch that on: set POKESTUDIO_BASE_URL and every
// call site that renders `buildPokeStudioUrl()` starts showing its CTA; while
// it is null the CTA is simply not rendered (no broken or invented links).

export const POKESTUDIO_BASE_URL: string | null = null;

/** Deep link to PokeStudio for a Pokémon, or null while the integration is not public. */
export function buildPokeStudioUrl(pokemonSlug: string, base: string | null = POKESTUDIO_BASE_URL): string | null {
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('p', pokemonSlug);
  return url.toString();
}
