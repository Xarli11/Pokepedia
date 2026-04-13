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
}

export interface AbilityDetail {
    id: number;
    name: string;
    names: PokemonName[];
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

    const response = await fetch(url);
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
 * Obtiene la lista de Pokémon por generación.
 */
export async function getPokemonByGeneration(genKey: string = 'gen1'): Promise<PokemonDetail[]> {
    if (genKey === 'favorites') return [];

    const gen = GENERATIONS[genKey] || GENERATIONS['gen1'];
    const data = await fetchWithCache<any>(`https://pokeapi.co/api/v2/pokemon?limit=${gen.limit}&offset=${gen.offset}`);

    const results: PokemonDetail[] = [];
    const CHUNK_SIZE = 40; // Cloudflare limit is 50 subrequests per request

    for (let i = 0; i < data.results.length; i += CHUNK_SIZE) {
        const chunk = data.results.slice(i, i + CHUNK_SIZE);
        const detailedPromises = chunk.map(async (pokemon: { name: string, url: string }) => {
            return fetchWithCache<PokemonDetail>(pokemon.url);
        });
        const chunkResults = await Promise.all(detailedPromises);
        results.push(...chunkResults);
    }

    return results;
}
/**
 * Obtiene la lista de los primeros 151 Pokémon con sus detalles básicos.
 * @deprecated Use getPokemonByGeneration('gen1') instead
 */
export async function getFirstGenPokemon(): Promise<PokemonDetail[]> {
    return getPokemonByGeneration('gen1');
}

/**
 * Obtiene los detalles completos de un Pokémon por su nombre.
 * Maneja automáticamente casos donde el nombre es una especie pero no un endpoint de pokemon directo
 * (ej: basculin -> basculin-red-striped, gourgeist -> gourgeist-average)
 */
export async function getPokemonByName(name: string): Promise<{ detail: PokemonDetail, species: PokemonSpecies }> {
    try {
        // 1. Intentar obtener el detalle del Pokémon (esto funciona para variedades y formas base con nombre exacto)
        const detail = await fetchWithCache<PokemonDetail>(`https://pokeapi.co/api/v2/pokemon/${name}`);
        const species = await fetchWithCache<PokemonSpecies>((detail as any).species.url);
        return { detail, species };
    } catch (error) {
        // 2. Si falla, es posible que el nombre sea de una especie pero el pokemon tenga un nombre de forma (ej: basculin)
        try {
            const species = await fetchWithCache<PokemonSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${name}`);
            // Obtener la variedad por defecto
            const defaultVariety = species.varieties.find(v => v.is_default) || species.varieties[0];
            const detail = await fetchWithCache<PokemonDetail>(defaultVariety.pokemon.url);
            return { detail, species };
        } catch (innerError) {
            console.error(`Error fetching pokemon by name "${name}":`, innerError);
            throw error; // Re-lanzar el error original si el fallback también falla
        }
    }
}

/**
 * Obtiene los detalles de un objeto por su URL o nombre.
 */
export async function getItemDetail(urlOrName: string) {
    const url = urlOrName.startsWith('http') ? urlOrName : `https://pokeapi.co/api/v2/item/${urlOrName}`;
    return fetchWithCache<any>(url);
}

/**
 * Obtiene el listado de todos los objetos.
 */
export async function getAllItems(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/item?limit=2000');
    
    // Filtrar objetos "fake" o datos basura
    const { isRealItem } = await import('../utils/pokemon');
    return data.results.filter((item: any) => isRealItem(item.name));
}

/**
 * Obtiene los detalles de una habilidad por su URL.
 */
export async function getAbilityDetail(url: string): Promise<AbilityDetail> {
    return fetchWithCache<AbilityDetail>(url);
}

/**
 * Obtiene los detalles de un movimiento por su URL.
 */
export async function getMoveDetail(url: string): Promise<MoveDetail> {
    return fetchWithCache<MoveDetail>(url);
}

/**
 * Obtiene el listado de todas las habilidades.
 */
export async function getAllAbilities(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/ability?limit=500');
    return data.results;
}

/**
 * Obtiene el listado de todos los movimientos.
 */
export async function getAllMoves(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/move?limit=1000');
    return data.results;
}

/**
 * Obtiene el nombre traducido de un recurso.
 */
export function getLocalizedName(names: PokemonName[] | undefined, lang: string): string {
    if (!names) return '';
    return names.find(n => n.language.name === lang)?.name || names.find(n => n.language.name === 'en')?.name || '';
}

/**
 * Obtiene una lista completa de todos los Pokémon incluyendo variedades relevantes 
 * (Megas, G-Max, Formas Regionales) para el buscador.
 */
export async function getAllPokemonNames(): Promise<{ name: string, id: number | string, sprite?: string }[]> {
    try {
        const cacheKey = 'global-pokemon-names-list';
        const cached = cache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        // 1. Obtener todas las especies (usamos un límite alto para cubrir futuras expansiones)
        const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
        
        const baseSpecies = data.results.map((p: any) => {
            const id = parseInt(p.url.split('/').filter(Boolean).pop());
            return { 
                name: p.name, 
                id: id,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
            };
        });

        // 2. Obtener variedades importantes (Megas, Gigamax, Regionales)
        // El offset 1025 es donde suelen empezar las variedades en PokeAPI
        const varData = await fetchWithCache<any>('https://pokeapi.co/api/v2/pokemon?limit=1000&offset=1025');

        const varieties = varData.results
            .map((p: any) => {
                const id = parseInt(p.url.split('/').filter(Boolean).pop());
                // Solo incluimos variedades que tengan IDs de variedad (normalmente > 10000)
                // para evitar duplicados de la lista de especies base
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
