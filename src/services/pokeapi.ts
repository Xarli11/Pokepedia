// src/services/pokeapi.ts

import { EntityNotFoundError, NotFoundError, UpstreamError, errorForUpstreamStatus } from './errors';
import { UPSTREAM_TIMEOUT_MS, SLOW_UPSTREAM_MS, fetchWithTimeout, logUpstream } from './upstream';
import { defaultVariety } from '../utils/seo';

export interface PokemonType {
    slot: number;
    type: {
        name: string;
        url: string;
    };
}

export interface PokemonName {
    language: {
        name: string;
    };
    name: string;
}

export interface PokemonDetail {
    id: number;
    name: string;
    is_default?: boolean;
    species?: {
        name: string;
        url: string;
    };
    types: PokemonType[];
    sprites: {
        front_default: string;
        other: {
            "official-artwork": {
                front_default: string;
            };
        };
    };
    stats: {
        base_stat: number;
        stat: {
            name: string;
        };
    }[];
    abilities: {
        ability: {
            name: string;
            url: string;
        };
        is_hidden: boolean;
    }[];
    moves: {
        move: {
            name: string;
            url: string;
        };
        version_group_details: {
            level_learned_at: number;
            move_learn_method: {
                name: string;
            };
            version_group: {
                name: string;
            };
        }[];
    }[];
    height: number;
    weight: number;
}

export interface PokemonSpecies {
    name: string;
    names: PokemonName[];
    flavor_text_entries: {
        flavor_text: string;
        language: {
            name: string;
        };
    }[];
    evolution_chain: {
        url: string;
    };
    varieties: {
        is_default: boolean;
        pokemon: {
            name: string;
            url: string;
        };
    }[];
    generation: {
        name: string;
        url: string;
    };
}

/**
 * Obtiene la cadena evolutiva completa por su URL.
 */
export async function getEvolutionChain(url: string) {
    // Optional enrichment: the caller degrades if this rejects. Cached and
    // timed like every other PokeAPI resource (it used a bare, uncached,
    // untimed fetch, so every Pokémon page re-downloaded it).
    return fetchWithCache<any>(url);
}

export interface MoveDetail {
    id: number;
    name: string;
    names: PokemonName[];
    type: {
        name: string;
    };
    damage_class: {
        name: string;
    };
    power: number | null;
    accuracy: number | null;
    pp: number;
    priority: number;
    flavor_text_entries: {
        flavor_text: string;
        language: { name: string };
        version_group?: { name: string };
    }[];
    learned_by_pokemon: { name: string; url: string }[];
}

export interface AbilityDetail {
    id: number;
    name: string;
    names: PokemonName[];
    flavor_text_entries: {
        flavor_text: string;
        language: { name: string };
    }[];
    effect_entries: {
        effect: string;
        short_effect?: string;
        language: { name: string };
    }[];
    pokemon: {
        pokemon: { name: string; url: string };
        is_hidden: boolean;
        slot: number;
    }[];
}

/**
 * PokeAPI fetch layer: one place for timeout, bounded retry, in-flight
 * de-duplication, the per-isolate cache and stale-on-error.
 *
 * Cache policy (in-memory, one Cloudflare Workers isolate; nothing is
 * shared across isolates or persisted):
 *  - what: successful (2xx, valid JSON) PokeAPI GET responses, keyed by the
 *    exact URL (plus an optional `variant` when a reduced projection of the
 *    same URL is stored). Language is never part of a key: PokeAPI resources
 *    carry every language and pages pick theirs at render time.
 *  - TTL: 24 h (the data changes with game releases, not with traffic).
 *  - never cached: any failure (404, 429, 5xx, timeout, network error,
 *    non-JSON). A failure is not stored and does not poison later requests.
 *  - stale-on-error: if an entry is past its TTL and PokeAPI is failing
 *    (UpstreamError only: timeout / network / 5xx / 429 / bad JSON) the
 *    previous *valid* copy of that same URL is served for up to
 *    STALE_MAX_AGE_MS and retried after STALE_RETRY_MS. A 404 is never
 *    answered from stale (the entity is gone), and with no previous copy
 *    the error propagates untouched (503 by src/middleware.ts).
 *  - bounded: LRU capped at CACHE_MAX_ENTRIES so a long-lived isolate
 *    cannot grow without limit (full pokemon/{id} objects are ~300 KB).
 *  - in-flight de-duplication: concurrent identical requests share one
 *    fetch (e.g. two evolution requirements naming the same item).
 */
// timestamp: freshness clock (pushed forward when a stale copy is re-served);
// storedAt: when the data was really fetched, which bounds how stale it may get.
const cache = new Map<string, { data: any, timestamp: number, storedAt?: number }>();
const inflight = new Map<string, Promise<any>>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 Hours
const STALE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const STALE_RETRY_MS = 1000 * 60;
const CACHE_MAX_ENTRIES = 400;

// Retry policy for GET requests: at most ONE retry, only for a transient
// fault that answered fast (network error, HTTP 5xx), never for a timeout
// (it already spent its budget), a 4xx (404 entity, 429 rate limit: retrying
// would multiply the problem) or invalid JSON; and always inside the same
// overall deadline as a single attempt.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;

interface FetchOptions {
    ttl?: number;
    /** See UpstreamStatusOptions: only primary entity lookups by slug set it. */
    invalidIdIsNotFound?: boolean;
    /**
     * Stores `transform(data)` under `${url}#${variant}` instead of the full
     * response: for callers that need a few fields of a large resource.
     */
    variant?: string;
    transform?: (data: any) => any;
}

function cacheGet(key: string) {
    const hit = cache.get(key);
    if (hit) {
        // LRU touch.
        cache.delete(key);
        cache.set(key, hit);
    }
    return hit;
}

function cacheSet(key: string, data: unknown, timestamp: number, storedAt: number = timestamp) {
    cache.delete(key);
    cache.set(key, { data, timestamp, storedAt });
    while (cache.size > CACHE_MAX_ENTRIES) {
        cache.delete(cache.keys().next().value as string);
    }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestJson<T>(url: string, invalidIdIsNotFound: boolean): Promise<T> {
    const deadline = Date.now() + UPSTREAM_TIMEOUT_MS.pokeapi;
    for (let attempt = 1; ; attempt++) {
        const started = Date.now();
        const canRetry = () => attempt < MAX_ATTEMPTS && Date.now() + RETRY_DELAY_MS < deadline;
        let response: Response;
        try {
            response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, deadline - started)) });
        } catch (error) {
            // fetch only rejects when no HTTP answer arrived: the timeout
            // (TimeoutError) or a network/DNS/TLS failure (TypeError).
            const name = (error as Error)?.name ?? 'Error';
            const timedOut = name === 'TimeoutError' || name === 'AbortError';
            logUpstream({ event: 'upstream_error', url, ms: Date.now() - started, error: name, attempt });
            if (!timedOut && canRetry()) {
                logUpstream({ event: 'upstream_retry', url, error: name, attempt });
                await sleep(RETRY_DELAY_MS);
                continue;
            }
            throw new UpstreamError(`PokeAPI request failed for ${url}`, undefined, { cause: error });
        }
        const ms = Date.now() - started;
        if (!response.ok) {
            const failure = errorForUpstreamStatus(response.status, url, { invalidIdIsNotFound });
            if (failure instanceof UpstreamError) {
                logUpstream({ event: 'upstream_error', url, status: response.status, ms, error: failure.name, attempt });
                if (response.status >= 500 && canRetry()) {
                    logUpstream({ event: 'upstream_retry', url, status: response.status, attempt });
                    await sleep(RETRY_DELAY_MS);
                    continue;
                }
            }
            throw failure;
        }
        try {
            const data = (await response.json()) as T;
            if (ms > SLOW_UPSTREAM_MS) logUpstream({ event: 'upstream_slow', url, status: response.status, ms });
            return data;
        } catch (error) {
            // A 2xx that isn't JSON is an upstream fault (proxy/CDN error page,
            // truncated body), not a missing entity.
            logUpstream({ event: 'upstream_error', url, status: response.status, ms, error: 'InvalidJson', attempt });
            throw new UpstreamError(`PokeAPI returned invalid JSON for ${url}`, response.status, { cause: error });
        }
    }
}

async function fetchWithCache<T>(url: string, { ttl = CACHE_TTL, invalidIdIsNotFound = false, variant, transform }: FetchOptions = {}): Promise<T> {
    const key = variant ? `${url}#${variant}` : url;
    const cached = cacheGet(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp < ttl)) {
        return cached.data;
    }

    // The 400-is-NotFound flag changes how a failure is classified, so it is
    // part of the in-flight key: a primary lookup never shares a promise
    // with (and inherits the errors of) a secondary one.
    const flightKey = invalidIdIsNotFound ? `${key}|entity` : key;
    const pending = inflight.get(flightKey);
    if (pending) return pending as Promise<T>;

    const load = (async () => {
        try {
            const raw = await requestJson<T>(url, invalidIdIsNotFound);
            const data = transform ? transform(raw) : raw;
            cacheSet(key, data, Date.now());
            return data as T;
        } catch (error) {
            if (error instanceof UpstreamError && cached && now - (cached.storedAt ?? cached.timestamp) < STALE_MAX_AGE_MS) {
                logUpstream({ event: 'upstream_stale', url, status: error.status, error: error.name });
                // Serve the last valid copy and don't hammer a failing upstream:
                // it counts as fresh for STALE_RETRY_MS.
                cacheSet(key, cached.data, Date.now() - ttl + STALE_RETRY_MS, cached.storedAt ?? cached.timestamp);
                return cached.data as T;
            }
            throw error;
        } finally {
            inflight.delete(flightKey);
        }
    })();
    inflight.set(flightKey, load);
    return load;
}

/**
 * Cached, timed, classified GET of any PokeAPI resource URL, for callers
 * outside this module that used a bare fetch(): same failure semantics as
 * every other secondary lookup (UpstreamError / NotFoundError, never
 * EntityNotFoundError).
 */
export function fetchPokeApiCached<T = any>(url: string): Promise<T> {
    return fetchWithCache<T>(url);
}

/**
 * Fetch of the primary entity a page URL names (/movimientos/{slug}/ ...).
 * The only place where "PokeAPI has no such resource" — including its 400
 * for an unparseable identifier — becomes EntityNotFoundError, i.e. a 404
 * page. Related/secondary fetches use fetchWithCache and never 404 a page.
 */
async function lookupEntity<T>(url: string): Promise<T> {
    try {
        return await fetchWithCache<T>(url, { invalidIdIsNotFound: true });
    } catch (error) {
        if (error instanceof NotFoundError) throw new EntityNotFoundError(error.message);
        throw error;
    }
}

// Presentation-only metadata now — species membership comes from PokeAPI's
// own generation/{n} resource (see getPokemonByGeneration below), not a
// hand-maintained id range. The previous {limit, offset} table silently
// undercounted Gen 9 by 10 species (stopped at id 1015; the Indigo
// Disk/Teal Mask DLC additions go up to 1025) because nobody updates a
// hardcoded range when an official DLC ships. Verified live against
// PokeAPI that generations 1-8 are unaffected (their old ranges match
// generation/{n} exactly) — only Gen 9 was wrong.
export const GENERATIONS: Record<string, { region: string }> = {
    'gen1': { region: 'Kanto' },
    'gen2': { region: 'Johto' },
    'gen3': { region: 'Hoenn' },
    'gen4': { region: 'Sinnoh' },
    'gen5': { region: 'Teselia' },
    'gen6': { region: 'Kalos' },
    'gen7': { region: 'Alola' },
    'gen8': { region: 'Galar' },
    'gen9': { region: 'Paldea' },
};

/**
 * Obtiene la lista básica de Pokémon por generación.
 * Esta versión devuelve datos ligeros para SSR y deja los detalles pesados para el cliente.
 */
export interface PokemonListEntry {
    name: string;
    id: number;
    url: string;
    sprite: string;
}

interface PokeApiResourceRef {
    name: string;
    url: string;
}

interface PokeApiGenerationResponse {
    pokemon_species: PokeApiResourceRef[];
}

interface PokeApiTypeResponse {
    pokemon: { slot: number; pokemon: PokeApiResourceRef }[];
}

/** Extracts the numeric id from a PokeAPI resource URL, e.g. ".../1025/" -> 1025. */
export function idFromResourceUrl(url: string): number {
    const segment = url.split('/').filter(Boolean).pop();
    return segment ? parseInt(segment, 10) : NaN;
}

function buildSpriteUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

/**
 * Species belonging to a generation, straight from PokeAPI's generation/{n}
 * `pokemon_species` list — the authoritative membership (species-level, no
 * regional/mega/gmax forms mixed in). This is the single source both the
 * generation landing pages and the homepage's `?gen=` filter read from, so
 * fixing it here fixes both surfaces at once.
 */
export async function getPokemonByGeneration(genKey: string = 'gen1'): Promise<PokemonListEntry[]> {
    if (genKey === 'favorites') return [];

    const resolvedKey = GENERATIONS[genKey] ? genKey : 'gen1';
    const genNum = parseInt(resolvedKey.replace('gen', ''), 10);
    const data = await fetchWithCache<PokeApiGenerationResponse>(`https://pokeapi.co/api/v2/generation/${genNum}`);

    return data.pokemon_species
        .map((s) => {
            const id = idFromResourceUrl(s.url);
            return { name: s.name, id, url: s.url, sprite: buildSpriteUrl(id) };
        })
        .sort((a, b) => a.id - b.id);
}

/**
 * Obtiene la lista de los primeros 151 Pokémon con sus detalles básicos.
 * @deprecated Use getPokemonByGeneration('gen1') instead
 */
export async function getFirstGenPokemon(): Promise<PokemonListEntry[]> {
    return getPokemonByGeneration('gen1');
}

/** Roman-numeral label per generation key — deterministic, not translated content. */
export const GENERATION_ROMAN: Record<string, string> = {
    gen1: 'I', gen2: 'II', gen3: 'III', gen4: 'IV', gen5: 'V', gen6: 'VI', gen7: 'VII', gen8: 'VIII', gen9: 'IX',
};

/** Pure min/max over an already-fetched entry list — no extra request. */
export function getDexRangeFromEntries(entries: { id: number }[]): { start: number; end: number } {
    const ids = entries.map((e) => e.id);
    return { start: Math.min(...ids), end: Math.max(...ids) };
}

/**
 * Reverse lookup (National Dex id -> generation key), for the type-landing
 * pages' "by generation" breakdown, which needs to classify a whole list of
 * ~70-150 ids at once. Built from getPokemonByGeneration itself — no
 * separate range table — so it can never drift from the membership lists
 * above. Each of the 9 generation/{n} calls is cached (24h TTL, same as
 * every other list endpoint in this file), so this only pays real network
 * cost once per cache window, the same tradeoff /tipos/ already makes
 * fetching all 18 types for its hub counts.
 *
 * Not used for the Pokémon detail page's single-id "which generation" link
 * — that page already has the full species object in hand, and
 * `species.generation.url` gives the answer for free (see
 * pokemon/[name].astro), so fetching all 9 generations just to classify one
 * id there would be a real, disproportionate cost on the app's
 * highest-traffic route.
 */
export async function getGenerationMembershipMap(): Promise<Map<number, string>> {
    const genKeys = Object.keys(GENERATIONS);
    const lists = await Promise.all(genKeys.map((key) => getPokemonByGeneration(key)));

    const map = new Map<number, string>();
    lists.forEach((list, i) => {
        for (const entry of list) map.set(entry.id, genKeys[i]);
    });
    return map;
}

/**
 * Lightweight Pokémon list for a given type, via PokeAPI's /type/{name}
 * resource (authoritative default-game type membership — no per-pokemon
 * fetch needed). Varieties/forms (id > 10000) are filtered out, same
 * convention used everywhere else in this codebase (see e.g. index.astro) —
 * verified live that this keeps only default species (megas, gmax,
 * regional/origin/totem forms all carry id >= 10000 and are excluded, e.g.
 * "exeggutor-alola" on the Dragon type page).
 * Callers that need types/base-stats per entry should hydrate the result
 * via getSmogonDataBatch, exactly like the homepage's generation view does.
 */
export async function getPokemonByType(typeSlug: string): Promise<PokemonListEntry[]> {
    const data = await fetchWithCache<PokeApiTypeResponse>(`https://pokeapi.co/api/v2/type/${typeSlug}`);

    return data.pokemon
        .map((entry) => entry.pokemon)
        .map((p) => {
            const id = idFromResourceUrl(p.url);
            return { name: p.name, id, url: p.url, sprite: buildSpriteUrl(id) };
        })
        .filter((p) => p.id < 10000)
        .sort((a, b) => a.id - b.id);
}

/**
 * National Dex id -> species name (the canonical URL slug of each species'
 * default variety), from the same cached species list the search
 * suggestions use. Not best-effort on purpose: callers build canonical
 * links from it, so if it can't be loaded the failure propagates (-> 503)
 * instead of silently emitting links to redirecting default-form URLs.
 */
export async function getSpeciesNamesById(): Promise<Map<number, string>> {
    const species = await getCompleteResourceList('pokemon-species');
    return new Map(species.map((s) => [idFromResourceUrl(s.url), s.name]));
}

/**
 * Parches manuales para datos que faltan en PokeAPI (Gen 8/9 en Español)
 */
const SPANISH_PATCHES: Record<string, any> = {
    'sneasler': {
        description: 'Debido a su veneno virulento y su imponente capacidad física, ninguna otra especie podía superarlo en las tierras altas heladas. Prefiriendo la soledad, esta especie no forma manadas.',
        name: 'Sneasler'
    },
    'dire-claw': {
        name: 'Garra Nociva',
        description: 'El usuario ataca al objetivo con garras destructoras, con el objetivo de asestar un golpe crítico. Esto también puede dejar al objetivo envenenado, paralizado o somnoliento.'
    },
    'victory-dance': {
        name: 'Danza Victoria',
        description: 'El usuario realiza una danza mística que aumenta su Ataque, Defensa y Velocidad.'
    },
    'ceaseless-edge': {
        name: 'Tajo Ceñudo',
        description: 'El usuario ataca con un tajo imbuido de resentimiento. Deja púas en el campo de batalla del oponente.'
    }
};

/**
 * Intenta obtener una descripción en español desde WikiDex como fallback.
 */
async function getWikiDexFallback(name: string): Promise<string | null> {
    try {
        const cleanName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
        const url = `https://www.wikidex.net/api.php?action=query&prop=extracts&titles=${cleanName}&format=json&exintro=1&explaintext=1&origin=*`;
        
        const response = await fetchWithTimeout(url, 'wikidex');
        if (!response.ok) return null;
        
        const data = await response.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null;
        
        return pages[pageId].extract || null;
    } catch (e) {
        return null;
    }
}

export class PokemonNotFoundError extends EntityNotFoundError {
    constructor(name: string) {
        super(`Pokemon not found: ${name}`);
        this.name = 'PokemonNotFoundError';
    }
}

/**
 * Obtiene los detalles completos de un Pokémon por su nombre.
 *
 * Orden de resolución (ver docs/DATA_SOURCES.md):
 *   1. pokemon/{name} exacto (nombres de variedad: "deoxys-attack", formas
 *      regionales/mega/gmax — todas son slugs `pokemon` reales en PokeAPI).
 *   2. pokemon-species/{name} exacto -> variedad por defecto (especies que
 *      no son ellas mismas un `pokemon` resource, p.ej. "basculin",
 *      "gourgeist", "basculegion" — ver commit a74ce6a).
 *   3. Fallo limpio (PokemonNotFoundError).
 *
 * Deliberadamente NO existe un paso 4 que trunque el slug (p.ej.
 * `name.split('-')[0]`). Ese fallback existió antes y se eliminó: para
 * nombres como "porygon-z" o "deoxys-attack", cuyo prefijo ("porygon",
 * "deoxys") es también una especie válida, un fallo transitorio de red en
 * los pasos 1-2 habría devuelto silenciosamente el Pokémon equivocado en
 * vez de un error. Verificado contra PokeAPI que ningún nombre real usado
 * por Pokepedia necesita ese paso (ver tests de regresión).
 */
export async function getPokemonByName(name: string): Promise<{ detail: PokemonDetail, species: PokemonSpecies }> {
    const cleanName = name.toLowerCase();

    let result: { detail: PokemonDetail, species: PokemonSpecies };

    // Solo los lookups por el slug de la URL (pasos 1 y 2) pueden concluir
    // "este Pokémon no existe" (404). La especie de un pokemon que sí existe,
    // o la variedad por defecto de una especie que sí existe, son
    // dependencias obligatorias: si PokeAPI no las tiene, su NotFoundError se
    // propaga tal cual (-> 503), nunca como PokemonNotFoundError.
    let detail: PokemonDetail | null;
    try {
        // 1. pokemon/{name}
        detail = await lookupEntity<PokemonDetail>(`https://pokeapi.co/api/v2/pokemon/${cleanName}`);
    } catch (error) {
        // Solo un "no existe" justifica probar la especie: un fallo temporal
        // de PokeAPI (UpstreamError) se propaga tal cual para responder 503.
        if (!(error instanceof EntityNotFoundError)) throw error;
        detail = null;
    }

    if (detail) {
        const species = await fetchWithCache<PokemonSpecies>((detail as any).species.url);
        result = { detail, species };
    } else {
        // 2. pokemon-species/{name} -> variedad por defecto
        let species: PokemonSpecies;
        try {
            species = await lookupEntity<PokemonSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${cleanName}`);
        } catch (error) {
            // 3. Fallo limpio — nunca adivinar la especie a partir del slug.
            if (error instanceof EntityNotFoundError) throw new PokemonNotFoundError(cleanName);
            throw error;
        }
        const defaultDetail = await fetchWithCache<PokemonDetail>(defaultVariety(species).pokemon.url);
        result = { detail: defaultDetail, species };
    }

    // APLICAR PARCHES EN ESPAÑOL
    if (SPANISH_PATCHES[cleanName]) {
        const patch = SPANISH_PATCHES[cleanName];
        if (patch.description) {
            result.species.flavor_text_entries.unshift({
                flavor_text: patch.description,
                language: { name: 'es' }
            } as any);
        }
    }

    // FALLBACK DINÁMICO WIKIDEX (Si no hay descripción en español)
    const hasSpanish = result.species.flavor_text_entries.some(e => e.language.name === 'es');
    if (!hasSpanish) {
        const wikiDesc = await getWikiDexFallback(result.species.name);
        if (wikiDesc) {
            result.species.flavor_text_entries.push({
                flavor_text: wikiDesc,
                language: { name: 'es' }
            } as any);
        }
    }

    return result;
}

/** Primary lookup for /objetos/{name}/ (see lookupEntity). */
export async function getItemDetail(name: string) {
    return lookupEntity<any>(`https://pokeapi.co/api/v2/item/${name}`);
}

export interface NamedResource {
    name: string;
    url: string;
}

interface ResourceListPage {
    count: number;
    next: string | null;
    results: NamedResource[];
}

/**
 * Page size asked of PokeAPI list endpoints: "everything". Not a catalog
 * size: PokeAPI honours any limit and answers `count`, and the result is
 * checked against that `count` below, so a catalog outgrowing (or an API
 * capping) this value is completed or rejected, never silently truncated.
 */
export const LIST_REQUEST_LIMIT = 100000;

/**
 * Complete list of a PokeAPI resource, however many entries it has.
 *
 * `?limit=N` with a hard-coded catalog-sized N silently truncates once the
 * catalog grows: /item?limit=2000 returned 2000 of 2223 items, dropping 223
 * (TMs, mega stones, picnic items...) from the sitemap and the items index;
 * /move?limit=1000 and /ability?limit=500 were the same latent bug. One
 * request asks for everything; the response's own `count` is the contract:
 * if the page still comes back short it is completed by following `next`,
 * and if that can't reach `count` the call throws (503 upstream) instead of
 * serving a partial catalog. `count` entries by construction (checked, not
 * assumed). Entries are deduplicated by name (PokeAPI lists e.g.
 * roseli-berry twice), so callers never emit the same URL twice.
 */
export async function getCompleteResourceList(resource: string): Promise<NamedResource[]> {
    const base = `https://pokeapi.co/api/v2/${resource}`;
    let page = await fetchWithCache<ResourceListPage>(`${base}?limit=${LIST_REQUEST_LIMIT}`);
    const count = page.count;
    if (typeof count !== 'number' || !Array.isArray(page.results)) {
        // Without `count` completeness can't be checked: not a catalog.
        throw new UpstreamError(`PokeAPI ${resource} list malformed (no count/results)`, undefined);
    }
    const results = [...page.results];
    // Defensive: follow `next` (bounded by count) if the server capped the page.
    let guard = 0;
    while (page.next && results.length < count && guard++ < 50) {
        page = await fetchWithCache<ResourceListPage>(page.next);
        results.push(...page.results);
    }
    if (results.length < count) {
        throw new UpstreamError(`PokeAPI ${resource} list incomplete: ${results.length} of ${count}`);
    }
    const seen = new Set<string>();
    return results.filter((entry) => {
        if (seen.has(entry.name)) return false;
        seen.add(entry.name);
        return true;
    });
}

export async function getAllItems(): Promise<NamedResource[]> {
    const { isRealItem } = await import('../utils/pokemon');
    // getCompleteResourceList already dedupes (roseli-berry: ids 723 and 2279).
    return (await getCompleteResourceList('item')).filter((item) => isRealItem(item.name));
}

/**
 * Lightweight, cached Pokémon name list for entity discovery (e.g. sitemap).
 * Deliberately limited to base species (no varieties). Read from
 * pokemon-species, not pokemon: species names are the canonical URLs,
 * whereas the `pokemon` list names 37 species by their default variety
 * ("basculin-red-striped"), which now 301s to the species URL.
 */
export async function getAllPokemonBasic(): Promise<NamedResource[]> {
    return getCompleteResourceList('pokemon-species');
}

export async function getAbilityDetail(url: string): Promise<AbilityDetail> {
    return fetchWithCache<AbilityDetail>(url);
}

/** Primary lookup for /habilidades/{name}/ (see lookupEntity). */
export async function getAbilityDetailByName(name: string): Promise<AbilityDetail> {
    return lookupEntity<AbilityDetail>(`https://pokeapi.co/api/v2/ability/${name}`);
}

export async function getMoveDetail(url: string): Promise<MoveDetail> {
    return applyMovePatches(await fetchWithCache<any>(url));
}

/** Primary lookup for /movimientos/{name}/ (see lookupEntity). */
export async function getMoveDetailByName(name: string): Promise<MoveDetail> {
    return applyMovePatches(await lookupEntity<any>(`https://pokeapi.co/api/v2/move/${name}`));
}

function applyMovePatches(data: any): MoveDetail {
    const cleanName = data.name.toLowerCase();

    // Aplicar parches de nombres y descripciones para movimientos
    if (SPANISH_PATCHES[cleanName]) {
        const patch = SPANISH_PATCHES[cleanName];
        if (patch.name) {
            data.names.unshift({ name: patch.name, language: { name: 'es' } });
        }
        if (patch.description) {
            data.flavor_text_entries.unshift({ flavor_text: patch.description, language: { name: 'es' } });
        }
    }

    return data;
}


/**
 * Resuelve el movimiento que enseña una MT/MO (item category "all-machines"),
 * incluyendo los parches de nombre/descripción de getMoveDetail. Devuelve
 * null si la máquina o el movimiento no se pueden resolver.
 */
export async function getMachineMove(machineUrl: string): Promise<MoveDetail | null> {
    try {
        const machine = await fetchWithCache<{ move: { url: string } }>(machineUrl);
        return await getMoveDetail(machine.move.url);
    } catch {
        return null;
    }
}

/**
 * Un único Pokémon por URL/id, o null si no se puede resolver — para
 * navegación previo/siguiente y otros lookups puntuales por URL.
 */
export async function getPokemonDetailByUrl(url: string): Promise<PokemonDetail | null> {
    try {
        return await fetchWithCache<PokemonDetail>(url);
    } catch {
        return null;
    }
}

/**
 * Resuelve una lista de Pokémon a partir de sus URLs de PokeAPI, con límite
 * y tolerancia a fallos individuales (Promise.allSettled): una entrada que
 * falla se omite en vez de romper toda la página. Pensado para listados
 * "aprendido/llevado por" de movimientos, objetos y habilidades, que pueden
 * referenciar decenas o cientos de Pokémon.
 */
export async function getPokemonListByUrls(urls: string[], limit: number): Promise<PokemonDetail[]> {
    const capped = urls.slice(0, limit);
    const results = await Promise.allSettled(capped.map(url => fetchWithCache<PokemonDetail>(url)));
    return results
        .filter((r): r is PromiseFulfilledResult<PokemonDetail> => r.status === 'fulfilled')
        .map(r => r.value);
}

export async function getAllAbilities(): Promise<NamedResource[]> {
    return getCompleteResourceList('ability');
}

export async function getAllMoves(): Promise<NamedResource[]> {
    return getCompleteResourceList('move');
}

export function getLocalizedName(names: PokemonName[] | undefined, lang: string): string {
    if (!names) return '';
    return names.find(n => n.language.name === lang)?.name || names.find(n => n.language.name === 'en')?.name || '';
}

export async function getLocalizedNames(
    slugs: string[],
    endpoint: 'move' | 'item',
    lang: string
): Promise<Record<string, string>> {
    if (lang !== 'es' || slugs.length === 0) return {};
    const results = await Promise.allSettled(
        slugs.map(slug => fetchWithCache<any>(`https://pokeapi.co/api/v2/${endpoint}/${slug}/`))
    );
    const map: Record<string, string> = {};
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            const name = r.value?.names?.find((n: any) => n.language.name === 'es')?.name;
            if (name) map[slugs[i]] = name;
        }
    });
    return map;
}

// id is always parseInt() of the trailing path segment of a PokeAPI resource
// URL below, so it's always numeric — never a raw string.
export interface PokemonNameEntry {
    name: string;
    id: number;
    sprite?: string;
}

export async function getAllPokemonNames(): Promise<PokemonNameEntry[]> {
    try {
        const cacheKey = 'global-pokemon-names-list';
        const cached = cache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        const species = await getCompleteResourceList('pokemon-species');
        const baseSpecies = species.map((p: any) => {
            const id = parseInt(p.url.split('/').filter(Boolean).pop());
            return { 
                name: p.name, 
                id: id,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
            };
        });

        // Varieties/forms are the `pokemon` entries with id >= 10000.
        const varData = await getCompleteResourceList('pokemon');
        const varieties = varData
            .map((p: any) => {
                const id = parseInt(p.url.split('/').filter(Boolean).pop());
                if (id < 10000) return null;
                return { 
                    name: p.name, 
                    id: id,
                    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
                }; 
            })
            .filter(Boolean);

        const result = [...baseSpecies, ...varieties];
        cache.set(cacheKey, { data: result, timestamp: now });
        return result;
    } catch (error) {
        console.error('Error in getAllPokemonNames:', error);
        return [];
    }
}
