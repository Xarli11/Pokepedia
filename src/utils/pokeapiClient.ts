// src/utils/pokeapiClient.ts
//
// Minimal browser-side PokeAPI fetch helper. This is NOT a client for
// src/services/pokeapi.ts — that module is server-only (its cache is an
// in-memory Map scoped to one warm Cloudflare Workers isolate; browser code
// can't share or reach it), and client <script> blocks that lazily fetch
// PokeAPI for on-page search/filter UI structurally can't import it. See
// docs/DATA_SOURCES.md ("Client-side fetches").
//
// This centralizes only the bare mechanics that were duplicated identically
// across every such <script> that talks to pokeapi.co directly: the base
// URL, the fetch call, treating a non-2xx response as a failure instead of
// silently parsing whatever body came back, and JSON parsing. No caching
// (each call site keeps its own page-local Map, sized/shaped differently
// per page), no language selection, no response normalization — those stay
// at each call site because they genuinely differ per entity type.

import { defaultVariety } from './seo';

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export class PokeApiHttpError extends Error {
	constructor(readonly status: number, url: string) {
		super(`PokeAPI request failed (${status}): ${url}`);
		this.name = 'PokeApiHttpError';
	}
}

export async function fetchPokeApiJson<T>(url: string, timeoutMs?: number): Promise<T> {
	const res = await fetch(url, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined);
	if (!res.ok) throw new PokeApiHttpError(res.status, url);
	return res.json() as Promise<T>;
}

/**
 * Browser-side twin of getPokemonByName()'s resolution (steps 1-2 in
 * services/pokeapi.ts). A Pokepedia Pokémon slug is either a `pokemon`
 * resource ("feraligatr", "feraligatr-mega", or a legacy default-form slug
 * such as "basculin-red-striped") or a species whose canonical URL is the
 * species name ("basculin", "deoxys", "zygarde"), which PokeAPI only
 * knows as pokemon-species: that one resolves to its default variety.
 * Only a real 404 falls back to the species; any other failure propagates.
 */
export async function fetchPokemonBySlug<T>(slug: string, timeoutMs?: number): Promise<T> {
	try {
		return await fetchPokeApiJson<T>(`${POKEAPI_BASE}/pokemon/${slug}`, timeoutMs);
	} catch (error) {
		if (!(error instanceof PokeApiHttpError && error.status === 404)) throw error;
	}
	const species = await fetchPokeApiJson<{ varieties: { is_default: boolean; pokemon: { url: string } }[] }>(
		`${POKEAPI_BASE}/pokemon-species/${slug}`,
		timeoutMs
	);
	return fetchPokeApiJson<T>(defaultVariety(species).pokemon.url, timeoutMs);
}
