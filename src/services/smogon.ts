// src/services/smogon.ts

import { fetchWithTimeout, logUpstream, type UpstreamProvider } from './upstream';

// Showdown / Smogon datasets: near-static files (pokedex.json 524 KB,
// gen9ou.json 55 KB), optional enrichment for every page that uses them.
//
// Cache policy, two layers, static datasets ONLY (PokeAPI has its own in
// services/pokeapi.ts; entity HTML is never cached):
//  1. in-memory, per isolate, 24 h.
//  2. Cloudflare Cache API (`caches.default`, per data center, shared by
//     isolates) when the runtime has it: fresh for EDGE_FRESH_MS, kept up to
//     EDGE_MAX_AGE_S as a stale fallback. Keyed by the dataset URL (one
//     dataset = one key, no language or entity in it). Only a body that
//     parsed AND passed the dataset's validator is ever written, so an
//     error page, an empty object or a truncated file can't be cached.
//     Absent (Node, tests, unsupported host) it is skipped silently.
//  Upstream failure -> the last valid copy (memory, then edge) is served
//  and logged as stale; with none, the dataset is simply unavailable (null)
//  and the page degrades (optional enrichment, HTTP 200 degraded).
const cache = new Map<string, { data: any, timestamp: number }>();
const inflight = new Map<string, Promise<any>>();
const CACHE_TTL = 1000 * 60 * 60 * 24;
const EDGE_FRESH_MS = 1000 * 60 * 60 * 6;
const EDGE_MAX_AGE_S = 60 * 60 * 24 * 7;
const CACHED_AT_HEADER = 'x-pokepedia-cached-at';
const MAX_DATASET_BYTES = 10 * 1024 * 1024;

type Validator = (data: any) => boolean;
// Structural checks: a JSON error body ({"error": "..."}) or an empty object
// must never be cached or served as the dataset.
const isRecordOfObjects: Validator = (d) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    const first = Object.values(d)[0];
    return !!first && typeof first === 'object';
};
const isPokedex = isRecordOfObjects;
const isSets = isRecordOfObjects;

function parseDataset(text: string): any {
    // Limpiar el JSON si viene con formato de variable de JS
    return JSON.parse(text.replace(/^var \w+ = /i, '').replace(/;$/, '').trim());
}

function edgeCache(): any | null {
    try {
        return (globalThis as any).caches?.default ?? null;
    } catch {
        return null;
    }
}

async function edgeRead(url: string, validate: Validator): Promise<{ data: any, fresh: boolean } | null> {
    const edge = edgeCache();
    if (!edge) return null;
    try {
        const res: Response | undefined = await edge.match(new Request(url));
        if (!res) return null;
        const data = parseDataset(await res.text());
        if (!validate(data)) return null;
        const cachedAt = Number(res.headers.get(CACHED_AT_HEADER)) || 0;
        return { data, fresh: Date.now() - cachedAt < EDGE_FRESH_MS };
    } catch {
        return null;
    }
}

async function edgeWrite(url: string, text: string): Promise<void> {
    const edge = edgeCache();
    if (!edge) return;
    try {
        await edge.put(new Request(url), new Response(text, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${EDGE_MAX_AGE_S}`,
                [CACHED_AT_HEADER]: String(Date.now()),
            },
        }));
    } catch {
        /* the cache is an optimisation, never a dependency */
    }
}

async function fetchDataset<T>(url: string, provider: UpstreamProvider, validate: Validator): Promise<T | null> {
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;

    const pending = inflight.get(url);
    if (pending) return pending as Promise<T | null>;

    const load = (async (): Promise<T | null> => {
        const edge = await edgeRead(url, validate);
        if (edge?.fresh) {
            cache.set(url, { data: edge.data, timestamp: Date.now() });
            return edge.data;
        }

        const started = Date.now();
        try {
            const response = await fetchWithTimeout(url, provider);
            if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });

            // Verificación de Content-Length antes de descargar el cuerpo si es posible
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > MAX_DATASET_BYTES) throw new Error('dataset too large (header)');

            const text = await response.text();
            if (text.length > MAX_DATASET_BYTES) throw new Error('dataset too large (body)');

            const data = parseDataset(text);
            if (!validate(data)) throw new Error('dataset failed validation');

            cache.set(url, { data, timestamp: Date.now() });
            await edgeWrite(url, text);
            return data;
        } catch (e) {
            const error = e as Error & { status?: number };
            logUpstream({ event: 'upstream_error', url, status: error.status, ms: Date.now() - started, error: error.name });
            const stale = edge?.data ?? cached?.data ?? null;
            if (stale) logUpstream({ event: 'upstream_stale', url });
            return stale;
        } finally {
            inflight.delete(url);
        }
    })();
    inflight.set(url, load);
    return load;
}

const POKEDEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';

export async function getShowdownPokemon(name: string): Promise<any | null> {
    try {
        const pokedex = await fetchDataset<any>(POKEDEX_URL, 'showdown', isPokedex);
        if (!pokedex) return null;
        
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pokedex[cleanName] || null;
    } catch (e) {
        // Silenciamos fallos críticos de memoria/CPU para permitir que la página cargue sin datos de Smogon
        return null;
    }
}

export async function getPokemonTier(name: string): Promise<string> {
    const pokemon = await getShowdownPokemon(name);
    return pokemon?.tier || 'Untiered';
}

export async function getSmogonDataBatch(names: string[]): Promise<Record<string, { types: string[], baseStats: Record<string, number> }>> {
    const pokedex = await fetchDataset<any>(POKEDEX_URL, 'showdown', isPokedex);
    if (!pokedex) return {};
    const result: Record<string, { types: string[], baseStats: Record<string, number> }> = {};
    for (const name of names) {
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const data = pokedex[key];
        if (data) {
            result[name] = {
                types: (data.types || []).map((t: string) => t.toLowerCase()),
                baseStats: data.baseStats || {}
            };
        }
    }
    return result;
}

const TIER_TO_FORMAT: Record<string, string> = {
    'Uber': 'gen9ubers', 'OU': 'gen9ou', 'UU': 'gen9uu',
    'RU': 'gen9ru', 'NU': 'gen9nu', 'PU': 'gen9pu',
    'LC': 'gen9lc', 'AG': 'gen9anythinggoes',
};

function smogonKey(name: string): string {
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export interface SmogonSet {
    name: string;
    moves: string[];
    ability: string | null;
    item: string | null;
    nature: string | null;
}

export async function getSmogonSets(pokemonName: string, tier: string): Promise<SmogonSet[] | null> {
    try {
        const format = TIER_TO_FORMAT[tier] || 'gen9ou';
        const data = await fetchDataset<Record<string, any>>(
            `https://pkmn.github.io/smogon/data/sets/${format}.json`,
            'smogon',
            isSets
        );
        if (!data) return null;
        const sets = data[smogonKey(pokemonName)];
        if (!sets) return null;
        return Object.entries(sets).map(([setName, set]: [string, any]) => ({
            name: setName,
            moves: (set.moves || []).map((slot: any) => Array.isArray(slot) ? slot[0] : slot),
            ability: Array.isArray(set.ability) ? set.ability[0] : (set.ability ?? null),
            item: Array.isArray(set.item) ? set.item[0] : (set.item ?? null),
            nature: Array.isArray(set.nature) ? set.nature[0] : (set.nature ?? null),
        }));
    } catch {
        return null;
    }
}

// Root cause fixed here: `desc` used to be a single hardcoded Spanish
// string, so English pages rendered Spanish tier descriptions regardless of
// `lang` (see TierLegend.astro, which consumes this). `label` stays a
// single value on purpose — OU/UU/Uber/etc. are competitive-scene jargon
// used as-is in both languages, not translated terms.
export const TIER_DEFINITIONS: Record<string, { label: string, desc: Record<'es' | 'en', string>, color: string }> = {
    'Uber': { label: 'Uber', desc: { es: 'Pokémon demasiado poderosos para el estándar.', en: 'Pokémon too powerful for the standard tiers.' }, color: 'bg-red-500' },
    'OU': { label: 'Overused', desc: { es: 'El estándar competitivo.', en: 'The competitive standard.' }, color: 'bg-emerald-500' },
    'UU': { label: 'Underused', desc: { es: 'Pokémon fuertes de uso medio.', en: 'Strong mid-usage Pokémon.' }, color: 'bg-blue-500' },
    'RU': { label: 'Rarely Used', desc: { es: 'Pokémon de liga intermedia.', en: 'Pokémon of the intermediate league.' }, color: 'bg-amber-500' },
    'NU': { label: 'Never Used', desc: { es: 'Pokémon con nichos específicos.', en: 'Pokémon with specific niches.' }, color: 'bg-violet-500' },
    'PU': { label: 'PU', desc: { es: 'Categoría de uso bajo.', en: 'Low-usage category.' }, color: 'bg-slate-500' },
    'LC': { label: 'Little Cup', desc: { es: 'Pokémon nivel 5.', en: 'Level 5 Pokémon.' }, color: 'bg-pink-500' },
    'AG': { label: 'Anything Goes', desc: { es: 'Sin reglas.', en: 'No rules.' }, color: 'bg-black' }
};
