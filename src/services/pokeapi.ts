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
 * Obtiene la lista básica de Pokémon por generación.
 * Esta versión devuelve datos ligeros para SSR y deja los detalles pesados para el cliente.
 */
export async function getPokemonByGeneration(genKey: string = 'gen1'): Promise<any[]> {
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
export async function getFirstGenPokemon(): Promise<any[]> {
    return getPokemonByGeneration('gen1');
}

/**
 * Obtiene los detalles completos de un Pokémon por su nombre con Fallback Robusto.
 */
export async function getPokemonByName(name: string): Promise<{ detail: PokemonDetail, species: PokemonSpecies }> {
    const cleanName = name.toLowerCase();
    
    try {
        const detail = await fetchWithCache<PokemonDetail>(`https://pokeapi.co/api/v2/pokemon/${cleanName}`);
        const species = await fetchWithCache<PokemonSpecies>((detail as any).species.url);
        
        return { detail, species };
    } catch (error) {
        console.warn(`Fallback to base species for: ${cleanName}`);
        
        const baseName = cleanName.split('-')[0];
        try {
            const baseDetail = await fetchWithCache<PokemonDetail>(`https://pokeapi.co/api/v2/pokemon/${baseName}`);
            const species = await fetchWithCache<PokemonSpecies>((baseDetail as any).species.url);
            
            // Intentar recuperar el ID real si es una variedad conocida
            const allNames = await getAllPokemonNames();
            const varietyEntry = allNames.find(p => p.name.toLowerCase() === cleanName);
            const realId = varietyEntry?.id;

            return { 
                detail: { 
                    ...baseDetail, 
                    id: realId ? (typeof realId === 'string' ? parseInt(realId) : realId) : baseDetail.id,
                    name: cleanName 
                }, 
                species 
            };
        } catch (innerError) {
            throw new Error(`Pokemon not found: ${cleanName}`);
        }
    }
}

/**
 * Otros servicios auxiliares.
 */
export async function getItemDetail(urlOrName: string) {
    const url = urlOrName.startsWith('http') ? urlOrName : `https://pokeapi.co/api/v2/item/${urlOrName}`;
    return fetchWithCache<any>(url);
}

export async function getAllItems(): Promise<{ name: string, url: string }[]> {
    const data = await fetchWithCache<any>('https://pokeapi.co/api/v2/item?limit=2000');
    const { isRealItem } = await import('../utils/pokemon');
    return data.results.filter((item: any) => isRealItem(item.name));
}

export async function getAbilityDetail(url: string): Promise<AbilityDetail> {
    return fetchWithCache<AbilityDetail>(url);
}

export async function getMoveDetail(url: string): Promise<MoveDetail> {
    return fetchWithCache<MoveDetail>(url);
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

export async function getAllPokemonNames(): Promise<{ name: string, id: number | string, sprite?: string }[]> {
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
