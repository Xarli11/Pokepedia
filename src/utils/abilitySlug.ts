// src/utils/abilitySlug.ts
//
// Resolves a Pokémon Showdown ability display name to a real PokeAPI ability
// slug. Showdown says "Mind's Eye", PokeAPI says "minds-eye"; the old
// `name.toLowerCase().replace(/\s+/g, '-')` produced "mind's-eye" and a 404
// link. Same class of bug for "Dragon's Maw" and "As One (Glastrier)".
//
// No per-ability exceptions: names are compared through a normalized key
// (lowercase, diacritics and everything but [a-z0-9] removed) against the
// real PokeAPI slug list. A key shared by two different slugs is reported as
// 'ambiguous' and never resolved arbitrarily.

export type AbilityResolution =
  | { status: 'direct'; slug: string }
  | { status: 'normalized'; slug: string }
  /** "Embody Aspect (Teal)" -> "embody-aspect": PokeAPI has one entity for the qualified variants. */
  | { status: 'variant'; slug: string }
  | { status: 'ambiguous'; candidates: string[] }
  | { status: 'unresolved' };

export interface AbilityIndex {
  slugs: ReadonlySet<string>;
  byKey: ReadonlyMap<string, readonly string[]>;
}

export function normalizeAbilityKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** The slug the old code produced; kept for the "direct match" tier. */
function naiveSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function buildAbilityIndex(slugs: readonly string[]): AbilityIndex {
  const byKey = new Map<string, string[]>();
  for (const slug of new Set(slugs)) {
    const key = normalizeAbilityKey(slug);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), slug]);
  }
  return { slugs: new Set(slugs), byKey };
}

/** Normalized keys that map to more than one real slug (must be empty on PokeAPI data). */
export function findKeyCollisions(index: AbilityIndex): Array<{ key: string; slugs: readonly string[] }> {
  return [...index.byKey].filter(([, slugs]) => slugs.length > 1).map(([key, slugs]) => ({ key, slugs }));
}

function lookupKey(key: string, index: AbilityIndex): AbilityResolution | null {
  if (!key) return null;
  const hits = index.byKey.get(key);
  if (!hits) return null;
  if (hits.length > 1) return { status: 'ambiguous', candidates: [...hits] };
  return { status: 'normalized', slug: hits[0] };
}

export function resolveAbilitySlug(name: string, index: AbilityIndex): AbilityResolution {
  const direct = naiveSlug(name);
  if (direct && index.slugs.has(direct)) return { status: 'direct', slug: direct };

  const full = lookupKey(normalizeAbilityKey(name), index);
  if (full) return full;

  // Trailing qualifier, e.g. "Embody Aspect (Teal)": only tried when the full
  // name matched nothing (so "As One (Glastrier)" never gets here).
  const base = name.replace(/\s*\([^)]*\)\s*$/, '');
  if (base !== name) {
    const variant = lookupKey(normalizeAbilityKey(base), index);
    if (variant?.status === 'normalized') return { status: 'variant', slug: variant.slug };
    if (variant) return variant;
  }

  return { status: 'unresolved' };
}

/** Convenience: the slug when (and only when) resolution is unambiguous. */
export function abilitySlugOrNull(name: string, index: AbilityIndex): string | null {
  const r = resolveAbilitySlug(name, index);
  return 'slug' in r ? r.slug : null;
}
