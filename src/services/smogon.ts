// src/services/smogon.ts

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

async function fetchWithCache<T>(url: string, timeoutMs = 10000): Promise<T | null> {
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) return null;
        const text = await response.text();
        // Limpiar el JSON si viene con formato de variable de JS
        const data = JSON.parse(text.replace(/^var \w+ = /i, '').replace(/;$/, ''));
        cache.set(url, { data, timestamp: Date.now() });
        return data;
    } catch (e) {
        return cached ? cached.data : null;
    }
}

export async function getShowdownPokemon(name: string): Promise<any | null> {
    const pokedex = await fetchWithCache<any>('https://play.pokemonshowdown.com/data/pokedex.json');
    if (!pokedex) return null;
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return pokedex[cleanName] || null;
}

export async function getPokemonTier(name: string): Promise<string> {
    const pokemon = await getShowdownPokemon(name);
    return pokemon?.tier || 'Untiered';
}

export const TIER_DEFINITIONS: Record<string, { label: string, desc: string, color: string }> = {
    'Champion': { label: 'Champion', desc: 'El rango más alto en Pokémon Champions.', color: 'bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 text-black font-bold border-2 border-yellow-600 shadow-[0_0_10px_rgba(250,204,21,0.5)]' },
    'Uber': { label: 'Uber', desc: 'Pokémon demasiado poderosos para el estándar.', color: 'bg-red-500' },
    'OU': { label: 'Overused', desc: 'El estándar competitivo.', color: 'bg-emerald-500' },
    'UU': { label: 'Underused', desc: 'Pokémon fuertes de uso medio.', color: 'bg-blue-500' },
    'RU': { label: 'Rarely Used', desc: 'Pokémon de liga intermedia.', color: 'bg-amber-500' },
    'NU': { label: 'Never Used', desc: 'Pokémon con nichos específicos.', color: 'bg-violet-500' },
    'PU': { label: 'PU', desc: 'Categoría de uso bajo.', color: 'bg-slate-500' },
    'LC': { label: 'Little Cup', desc: 'Pokémon nivel 5.', color: 'bg-pink-500' },
    'AG': { label: 'Anything Goes', desc: 'Sin reglas.', color: 'bg-black' }
};
