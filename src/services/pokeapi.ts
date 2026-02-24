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

export const GENERATIONS: Record<string, { limit: number; offset: number; region: string }> = {
    'gen1': { limit: 151, offset: 0, region: 'Kanto' },
    'gen2': { limit: 100, offset: 151, region: 'Johto' },
    'gen3': { limit: 135, offset: 251, region: 'Hoenn' },
    'gen4': { limit: 107, offset: 386, region: 'Sinnoh' },
    'gen5': { limit: 156, offset: 493, region: 'Unova' },
    'gen6': { limit: 72, offset: 649, region: 'Kalos' },
    'gen7': { limit: 88, offset: 721, region: 'Alola' },
    'gen8': { limit: 96, offset: 809, region: 'Galar' },
    'gen9': { limit: 110, offset: 905, region: 'Paldea' },
};

/**
 * Obtiene la lista de Pokémon por generación.
 */
export async function getPokemonByGeneration(genKey: string = 'gen1'): Promise<PokemonDetail[]> {
    const gen = GENERATIONS[genKey] || GENERATIONS['gen1'];
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${gen.limit}&offset=${gen.offset}`);
    if (!response.ok) throw new Error('Error al conectar con PokeAPI');
    const data = await response.json();
    
    const detailedPromises = data.results.map(async (pokemon: { name: string, url: string }) => {
        const detailResponse = await fetch(pokemon.url);
        return detailResponse.json();
    });

    return Promise.all(detailedPromises);
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
 * Maneja automáticamente variedades (G-Max, Megas, etc) obteniendo su especie base.
 */
export async function getPokemonByName(name: string): Promise<{ detail: PokemonDetail, species: PokemonSpecies }> {
    // 1. Intentar obtener el detalle del Pokémon (esto funciona para variedades y formas base)
    const detailRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    if (!detailRes.ok) throw new Error(`No se pudo encontrar información de ${name}`);
    const detail: PokemonDetail = await detailRes.json();

    // 2. Obtener la especie. El nombre de la especie puede ser diferente al del Pokémon (ej: charizard-gmax -> charizard)
    // PokeAPI siempre incluye el enlace a la especie en el detalle del Pokémon.
    const speciesRes = await fetch((detail as any).species.url);
    if (!speciesRes.ok) throw new Error(`No se pudo encontrar la especie de ${name}`);
    const species: PokemonSpecies = await speciesRes.json();

    return { detail, species };
}

/**
 * Obtiene los detalles de un objeto por su URL o nombre.
 */
export async function getItemDetail(urlOrName: string) {
    const url = urlOrName.startsWith('http') ? urlOrName : `https://pokeapi.co/api/v2/item/${urlOrName}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener objeto');
    return response.json();
}

/**
 * Obtiene el listado de todos los objetos.
 */
export async function getAllItems(): Promise<{ name: string, url: string }[]> {
    const response = await fetch('https://pokeapi.co/api/v2/item?limit=2000');
    if (!response.ok) throw new Error('Error al obtener objetos');
    const data = await response.json();
    return data.results;
}

/**
 * Obtiene los detalles de una habilidad por su URL.
 */
export async function getAbilityDetail(url: string): Promise<AbilityDetail> {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener habilidad');
    return response.json();
}

/**
 * Obtiene los detalles de un movimiento por su URL.
 */
export async function getMoveDetail(url: string): Promise<MoveDetail> {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener movimiento');
    return response.json();
}

/**
 * Obtiene el listado de todas las habilidades.
 */
export async function getAllAbilities(): Promise<{ name: string, url: string }[]> {
    const response = await fetch('https://pokeapi.co/api/v2/ability?limit=500');
    if (!response.ok) throw new Error('Error al obtener habilidades');
    const data = await response.json();
    return data.results;
}

/**
 * Obtiene el listado de todos los movimientos.
 */
export async function getAllMoves(): Promise<{ name: string, url: string }[]> {
    const response = await fetch('https://pokeapi.co/api/v2/move?limit=1000');
    if (!response.ok) throw new Error('Error al obtener movimientos');
    const data = await response.json();
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
export async function getAllPokemonNames(): Promise<{ name: string, id: number | string }[]> {
    // 1. Obtener las 1025 especies base
    const response = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025');
    if (!response.ok) throw new Error('Error al obtener lista global de especies');
    const data = await response.json();
    
    const baseSpecies = data.results.map((p: any) => {
        const id = parseInt(p.url.split('/').filter(Boolean).pop());
        return { name: p.name, id: id };
    });

    // 2. Obtener variedades importantes (Megas, Gigamax, Regionales)
    // Limitamos a un rango donde suelen estar las variedades en PokeAPI para no sobrecargar
    const varResponse = await fetch('https://pokeapi.co/api/v2/pokemon?limit=500&offset=1025');
    if (!varResponse.ok) return baseSpecies; // Fallback a solo base si falla
    const varData = await varResponse.json();

    const varieties = varData.results
        .filter((p: any) => {
            const n = p.name.toLowerCase();
            return n.includes('-mega') || 
                   n.includes('-gmax') || 
                   n.includes('-alola') || 
                   n.includes('-galar') || 
                   n.includes('-hisui') || 
                   n.includes('-paldea') ||
                   n.includes('-primal');
        })
        .map((p: any) => {
            const id = parseInt(p.url.split('/').filter(Boolean).pop());
            return { name: p.name, id: id }; 
        });

    return [...baseSpecies, ...varieties];
}
