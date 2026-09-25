// src/utils/favorites.ts
//
// Browser-side favorites resolution for the homepage's favorites view.
// Favorites are stored as Pokepedia slugs; a legacy entry saved under a
// species' default-form slug ("basculin-red-striped") and the canonical
// species slug ("basculin") are the same Pokémon, so they must collapse to a
// single entry — in storage AND in what gets rendered, from the first load.
import { canonicalPokemonSlug } from './seo';

type PokemonLike = Parameters<typeof canonicalPokemonSlug>[0];

export interface ResolvedFavorites<T> {
    /** Favorites to store: canonical slugs, unique, in first-seen order. */
    keys: string[];
    /** Resolved Pokémon to render: exactly one per canonical slug. */
    entities: T[];
}

/**
 * Resolves every stored favorite and deduplicates by canonicalPokemonSlug()
 * — never by the stored string — keeping first-seen order. Real alternate
 * forms have their own canonical slug, so they stay distinct
 * ("basculin" vs "basculin-blue-striped"). An entry that fails to resolve
 * (e.g. PokeAPI down) is kept in storage as-is and simply not rendered.
 */
export async function resolveFavorites<T extends PokemonLike>(
    names: string[],
    resolve: (slug: string) => Promise<T>
): Promise<ResolvedFavorites<T>> {
    const results = await Promise.allSettled(names.map((name) => resolve(name)));
    const keys: string[] = [];
    const entities: T[] = [];
    const seen = new Set<string>();

    results.forEach((result, i) => {
        const resolved = result.status === 'fulfilled' && result.value ? result.value : null;
        const key = resolved ? canonicalPokemonSlug(resolved) : names[i];
        if (seen.has(key)) return;
        seen.add(key);
        keys.push(key);
        if (resolved) entities.push(resolved);
    });

    return { keys, entities };
}
