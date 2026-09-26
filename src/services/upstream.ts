// src/services/upstream.ts
//
// What every server-side call to an external data provider shares: one
// place for its timeout and one structured log line for failures. Pages
// treat providers differently (PokeAPI is a required dependency, Showdown /
// Smogon / WikiDex are optional enrichment — see errors.ts), but none may
// block a response indefinitely, and a failure has to be traceable to the
// endpoint that caused it.

/**
 * Per-provider request timeouts, in ms.
 *
 * pokeapi 8000: the required dependency. Measured latency of a healthy
 * request (cold, local) is 15-800 ms, so 8 s is ~10x the worst observed and
 * still bounds a page that chains several calls. Unchanged.
 * showdown 5000 / smogon 5000: optional enrichment; pokedex.json (524 KB)
 * takes 0.7-0.8 s and the Smogon sets file (55 KB) < 0.3 s. Smogon sets
 * was 8 s: an optional file must not hold the page longer than the
 * required data would.
 * wikidex 3000: optional fallback text; had NO timeout before.
 */
export const UPSTREAM_TIMEOUT_MS = {
    pokeapi: 8000,
    showdown: 5000,
    smogon: 5000,
    wikidex: 3000,
} as const;

export type UpstreamProvider = keyof typeof UPSTREAM_TIMEOUT_MS;

/** A successful upstream call slower than this is logged (once) as slow. */
export const SLOW_UPSTREAM_MS = 2000;

export function providerOf(url: string): UpstreamProvider | 'other' {
    if (url.includes('pokeapi.co')) return 'pokeapi';
    if (url.includes('pokemonshowdown.com')) return 'showdown';
    if (url.includes('pkmn.github.io')) return 'smogon';
    if (url.includes('wikidex.net')) return 'wikidex';
    return 'other';
}

export interface UpstreamLog {
    event: 'upstream_error' | 'upstream_retry' | 'upstream_slow' | 'upstream_stale';
    url: string;
    status?: number;
    ms?: number;
    /** Error class name (TimeoutError, TypeError, UpstreamError, NotFoundError...). */
    error?: string;
    attempt?: number;
}

/**
 * One JSON line per notable upstream event: provider, resource, status,
 * duration, error class. Only failures / retries / slow calls / stale
 * serves are logged — never every request — and only the URL path is kept
 * (no query string, no user data: the app has none).
 */
export function logUpstream(entry: UpstreamLog): void {
    let resource = entry.url;
    try {
        const u = new URL(entry.url);
        resource = u.pathname.replace(/^\/api\/v2\//, '');
    } catch {
        /* keep raw */
    }
    console.warn(
        JSON.stringify({
            evt: entry.event,
            provider: providerOf(entry.url),
            resource,
            status: entry.status,
            ms: entry.ms,
            error: entry.error,
            attempt: entry.attempt,
        })
    );
}

/** fetch() bounded by the provider's timeout. Rejects with TimeoutError past it. */
export function fetchWithTimeout(url: string, provider: UpstreamProvider, init: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS[provider]) });
}
