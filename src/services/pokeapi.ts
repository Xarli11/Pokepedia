// src/services/pokeapi.ts

import { EntityNotFoundError, NotFoundError, UpstreamError, errorForUpstreamStatus } from './errors';
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
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener cadena evolutiva');
    return response.json();
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
 * Simple In-Memory Cache for Node.js SSR
 */
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 Hours

interface FetchOptions {
    ttl?: number;
    /** See UpstreamStatusOptions: only primary entity lookups by slug set it. */
    invalidIdIsNotFound?: boolean;
}

async function fetchWithCache<T>(url: string, { ttl = CACHE_TTL, invalidIdIsNotFound = false }: FetchOptions = {}): Promise<T> {
    const cached = cache.get(url);
    const now = Date.now();

    if (cached && (now - cached.timestamp < ttl)) {
        return cached.data;
    }

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (error) {
        // fetch only rejects when no HTTP answer arrived: the 8s timeout
        // (TimeoutError) or a network/DNS/TLS failure (TypeError).
        throw new UpstreamError(`PokeAPI request failed for ${url}`, undefined, { cause: error });
    }
    if (!response.ok) throw errorForUpstreamStatus(response.status, url, { invalidIdIsNotFound });

    let data: T;
    try {
        data = await response.json();
    } catch (error) {
        // A 2xx that isn't JSON is an upstream fault (proxy/CDN error page,
        // truncated body), not a missing entity.
        throw new UpstreamError(`PokeAPI returned invalid JSON for ${url}`, response.status, { cause: error });
    }

    cache.set(url, { data, timestamp: now });
    return data;
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
    const data = await fetchWithCache<{ results: { name: string; url: string }[] }>(
        'https://pokeapi.co/api/v2/pokemon-species?limit=2000'
    );
    return new Map(data.results.map((s) => [idFromResourceUrl(s.url), s.name]));
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
        
        const response = await fetch(url);
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
 * Complete list of a PokeAPI resource, however many entries it has.
 *
 * `?limit=N` with a hard-coded N silently truncates once the catalog grows:
 * /item?limit=2000 returned 2000 of 2223 items, dropping 223 (TMs, mega
 * stones, picnic items...) from the sitemap and the items index. The list is
 * therefore requested with the API's own `count`, and if a page still comes
 * back short it is completed by following `next`, so the result is
 * `count` entries by construction (checked, not assumed).
 */
export async function getCompleteResourceList(resource: string): Promise<NamedResource[]> {
    const base = `https://pokeapi.co/api/v2/${resource}`;
    const head = await fetchWithCache<ResourceListPage>(`${base}?limit=1`);
    const count = head.count;
    let page = await fetchWithCache<ResourceListPage>(`${base}?limit=${count}`);
    const results = [...page.results];
    // Defensive: follow `next` (bounded by count) if the server capped the page.
    let guard = 0;
    while (page.next && results.length < count && guard++ < 50) {
        page = await fetchWithCache<ResourceListPage>(page.next);
        results.push(...page.results);
    }
    if (results.length !== count) {
        throw new UpstreamError(`PokeAPI ${resource} list incomplete: ${results.length} of ${count}`);
    }
    return results;
}

export async function getAllItems(): Promise<NamedResource[]> {
    const { isRealItem } = await import('../utils/pokemon');
    const seen = new Set<string>();
    // PokeAPI lists at least one slug twice (roseli-berry: ids 723 and 2279),
    // which would emit the same URL twice.
    return (await getCompleteResourceList('item')).filter((item) => {
        if (!isRealItem(item.name) || seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
    });
}

/**
 * Lightweight, cached Pokémon name list for entity discovery (e.g. sitemap).
 * Deliberately limited to base species (no varieties). Read from
 * pokemon-species, not pokemon: species names are the canonical URLs,
 * whereas the `pokemon` list names 37 species by their default variety
 * ("basculin-red-striped"), which now 301s to the species URL.
 */
export async function getAllPokemonBasic(limit: number = 1025): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>(`https://pokeapi.co/api/v2/pokemon-species?limit=${limit}`);
    return data.results || [];
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

export async function getAllAbilities(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/ability?limit=500');
    return data.results;
}

export async function getAllMoves(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/move?limit=1000');
    return data.results;
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

        const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
        const baseSpecies = data.results.map((p: any) => {
            const id = parseInt(p.url.split('/').filter(Boolean).pop());
            return { 
                name: p.name, 
                id: id,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
            };
        });

        const varData = await fetchWithCache<any>('https://pokeapi.co/api/v2/pokemon?limit=1000&offset=1025');
        const varieties = varData.results
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
