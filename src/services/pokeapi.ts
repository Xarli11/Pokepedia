// src/services/pokeapi.ts

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

async function fetchWithCache<T>(url: string, ttl: number = CACHE_TTL): Promise<T> {
    const cached = cache.get(url);
    const now = Date.now();

    if (cached && (now - cached.timestamp < ttl)) {
        return cached.data;
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Error al conectar con PokeAPI: ${url}`);
    const data = await response.json();

    cache.set(url, { data, timestamp: now });
    return data;
}

export const GENERATIONS: Record<string, { limit: number; offset: number; region: string }> = {
    'gen1': { limit: 151, offset: 0, region: 'Kanto' },
    'gen2': { limit: 100, offset: 151, region: 'Johto' },
    'gen3': { limit: 135, offset: 251, region: 'Hoenn' },
    'gen4': { limit: 107, offset: 386, region: 'Sinnoh' },
    'gen5': { limit: 156, offset: 493, region: 'Teselia' },
    'gen6': { limit: 72, offset: 649, region: 'Kalos' },
    'gen7': { limit: 88, offset: 721, region: 'Alola' },
    'gen8': { limit: 96, offset: 809, region: 'Galar' },
    'gen9': { limit: 110, offset: 905, region: 'Paldea' },
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

export async function getPokemonByGeneration(genKey: string = 'gen1'): Promise<PokemonListEntry[]> {
    if (genKey === 'favorites') return [];

    const gen = GENERATIONS[genKey] || GENERATIONS['gen1'];
    const data = await fetchWithCache<any>(`https://pokeapi.co/api/v2/pokemon?limit=${gen.limit}&offset=${gen.offset}`);

    return data.results.map((p: any) => {
        const id = parseInt(p.url.split('/').filter(Boolean).pop());
        return {
            name: p.name,
            id: id,
            url: p.url,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
        };
    });
}

/**
 * Obtiene la lista de los primeros 151 Pokémon con sus detalles básicos.
 * @deprecated Use getPokemonByGeneration('gen1') instead
 */
export async function getFirstGenPokemon(): Promise<PokemonListEntry[]> {
    return getPokemonByGeneration('gen1');
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

export class PokemonNotFoundError extends Error {
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

    try {
        // 1. Intentar obtener el detalle del Pokémon
        const detail = await fetchWithCache<PokemonDetail>(`https://pokeapi.co/api/v2/pokemon/${cleanName}`);
        const species = await fetchWithCache<PokemonSpecies>((detail as any).species.url);
        result = { detail, species };
    } catch (error) {
        // 2. Si falla, intentar con especie
        try {
            const species = await fetchWithCache<PokemonSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${cleanName}`);
            const defaultVariety = species.varieties.find(v => v.is_default) || species.varieties[0];
            const detail = await fetchWithCache<PokemonDetail>(defaultVariety.pokemon.url);
            result = { detail, species };
        } catch (innerError) {
            // 3. Fallo limpio — nunca adivinar la especie a partir del slug.
            throw new PokemonNotFoundError(cleanName);
        }
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

export async function getItemDetail(urlOrName: string) {
    const url = urlOrName.startsWith('http') ? urlOrName : `https://pokeapi.co/api/v2/item/${urlOrName}`;
    return fetchWithCache<any>(url);
}

export async function getAllItems(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/item?limit=2000');
    const { isRealItem } = await import('../utils/pokemon');
    return data.results.filter((item: any) => isRealItem(item.name));
}

/**
 * Lightweight, cached Pokémon name list for entity discovery (e.g. sitemap).
 * Deliberately limited to base species (no varieties) — matches the scope
 * the sitemap previously fetched directly and uncached.
 */
export async function getAllPokemonBasic(limit: number = 1025): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
    return data.results || [];
}

export async function getAbilityDetail(url: string): Promise<AbilityDetail> {
    return fetchWithCache<AbilityDetail>(url);
}

export async function getAbilityDetailByName(name: string): Promise<AbilityDetail> {
    return getAbilityDetail(`https://pokeapi.co/api/v2/ability/${name}`);
}

export async function getMoveDetail(url: string): Promise<MoveDetail> {
    const data = await fetchWithCache<any>(url);
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

export async function getMoveDetailByName(name: string): Promise<MoveDetail> {
    return getMoveDetail(`https://pokeapi.co/api/v2/move/${name}`);
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
