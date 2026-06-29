// src/services/smogon.ts

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

async function fetchWithCache<T>(url: string, timeoutMs = 5000): Promise<T | null> {
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) return null;
        
        // Verificación de Content-Length antes de descargar el cuerpo si es posible
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
             console.warn(`Smogon data too large (Header): ${url}`);
             return null;
        }

        const text = await response.text();
        
        // Verificación de tamaño real del texto
        if (text.length > 10 * 1024 * 1024) {
            console.warn(`Smogon data too large (Body): ${url}`);
            return null;
        }

        // Limpiar el JSON si viene con formato de variable de JS
        const cleanText = text.replace(/^var \w+ = /i, '').replace(/;$/, '').trim();
        
        const data = JSON.parse(cleanText);
        cache.set(url, { data, timestamp: Date.now() });
        return data;
    } catch (e) {
        console.error(`Smogon fetch error: ${url}`, e);
        return cached ? cached.data : null;
    }
}

export async function getShowdownPokemon(name: string): Promise<any | null> {
    try {
        const pokedex = await fetchWithCache<any>('https://play.pokemonshowdown.com/data/pokedex.json');
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
    const pokedex = await fetchWithCache<any>('https://play.pokemonshowdown.com/data/pokedex.json');
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

export const TIER_DEFINITIONS: Record<string, { label: string, desc: string, color: string }> = {
    'Uber': { label: 'Uber', desc: 'Pokémon demasiado poderosos para el estándar.', color: 'bg-red-500' },
    'OU': { label: 'Overused', desc: 'El estándar competitivo.', color: 'bg-emerald-500' },
    'UU': { label: 'Underused', desc: 'Pokémon fuertes de uso medio.', color: 'bg-blue-500' },
    'RU': { label: 'Rarely Used', desc: 'Pokémon de liga intermedia.', color: 'bg-amber-500' },
    'NU': { label: 'Never Used', desc: 'Pokémon con nichos específicos.', color: 'bg-violet-500' },
    'PU': { label: 'PU', desc: 'Categoría de uso bajo.', color: 'bg-slate-500' },
    'LC': { label: 'Little Cup', desc: 'Pokémon nivel 5.', color: 'bg-pink-500' },
    'AG': { label: 'Anything Goes', desc: 'Sin reglas.', color: 'bg-black' }
};
