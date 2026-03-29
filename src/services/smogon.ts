// src/services/smogon.ts

/**
 * Simple In-Memory Cache for Node.js SSR
 */
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 Hours

async function fetchWithCache<T>(url: string): Promise<T | null> {
    const cached = cache.get(url);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000) // Timeout de 5 segundos para no bloquear el worker
        });
        if (!response.ok) return null;
        const data = await response.json();

        cache.set(url, { data, timestamp: now });
        return data;
    } catch (e) {
        console.error(`Showdown fetch failed: ${url}`);
        return null;
    }
}

/**
 * Obtiene el Tier de Smogon para un Pokémon específico.
 */
export async function getPokemonTier(pokemonName: string): Promise<string> {
    try {
        const formatName = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const data = await fetchWithCache<any>(`https://play.pokemonshowdown.com/data/pokedex.json`);
        
        if (!data) return 'Untiered';
        return data[formatName]?.tier || 'Untiered';
    } catch (e) {
        return 'Untiered';
    }
}

/**
 * Definiciones y descripciones de los Tiers de Smogon
 */
export const TIER_DEFINITIONS: Record<string, { label: string, desc: string, color: string }> = {
    'Uber': { label: 'Uber', desc: 'Pokémon demasiado poderosos para el estándar (Legendarios mayores).', color: 'bg-red-500' },
    'OU': { label: 'Overused', desc: 'El estándar competitivo. Pokémon muy populares y eficaces.', color: 'bg-emerald-500' },
    'UU': { label: 'Underused', desc: 'Pokémon fuertes que no llegan al uso de OU.', color: 'bg-blue-500' },
    'RU': { label: 'Rarely Used', desc: 'Pokémon equilibrados usados en ligas intermedias.', color: 'bg-amber-500' },
    'NU': { label: 'Never Used', desc: 'Pokémon con nichos específicos en categorías bajas.', color: 'bg-violet-500' },
    'PU': { label: 'PU', desc: 'La categoría más baja de uso competitivo general.', color: 'bg-slate-500' },
    'LC': { label: 'Little Cup', desc: 'Pokémon en su primera etapa evolutiva (Nivel 5).', color: 'bg-pink-500' },
    'NFE': { label: 'Not Fully Evolved', desc: 'Pokémon que no han completado su línea evolutiva.', color: 'bg-slate-400' },
    'Untiered': { label: 'Untiered', desc: 'Pokémon con muy poco uso en el entorno competitivo actual.', color: 'bg-zinc-400' },
    'AG': { label: 'Anything Goes', desc: 'Sin reglas. Todo está permitido (Mega-Rayquaza, etc.).', color: 'bg-black' }
};

/**
 * Obtiene los sets recomendados de Showdown.
 * @deprecated Los endpoints JSON de sets han sido restringidos por Showdown.
 */
export async function getPokemonSets(pokemonName: string) {
    return null;
}
