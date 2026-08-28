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

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export async function fetchPokeApiJson<T>(url: string, timeoutMs?: number): Promise<T> {
	const res = await fetch(url, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined);
	if (!res.ok) throw new Error(`PokeAPI request failed (${res.status}): ${url}`);
	return res.json() as Promise<T>;
}
