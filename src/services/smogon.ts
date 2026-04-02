// src/services/smogon.ts

/**
 * Simple In-Memory Cache for Node.js SSR
 */
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 Hours

async function fetchWithCache<T>(url: string, timeoutMs = 8000): Promise<T | null> {
    const cached = cache.get(url);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(timeoutMs) // Timeout ajustable
        });
        if (!response.ok) return null;
        
        // Showdown a veces devuelve texto que parece un módulo en lugar de JSON puro si no está configurado,
        // pero sus endpoints .json en data/ son puros.
        const text = await response.text();
        const data = JSON.parse(text.replace(/^var \w+ = /i, '').replace(/;$/, ''));

        cache.set(url, { data, timestamp: now });
        return data;
    } catch (e) {
        console.error(`Showdown fetch failed for ${url}:`, e);
        if (cached) return cached.data;
        return null;
    }
}

/**
 * Obtiene la Pokedex completa de Showdown
 */
export async function getShowdownPokedex(): Promise<Record<string, any>> {
    const data = await fetchWithCache<any>(`https://play.pokemonshowdown.com/data/pokedex.json`);
    return data || {};
}

/**
 * Obtiene los detalles completos de un Pokémon desde la Pokedex de Showdown.
 */
export async function getShowdownPokemon(pokemonName: string): Promise<any | null> {
    const data = await getShowdownPokedex();
    const formatName = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return data[formatName] || null;
}

/**
 * Obtiene el diccionario completo de movimientos de Showdown
 */
export async function getShowdownMoves(): Promise<Record<string, any>> {
    const data = await fetchWithCache<any>(`https://play.pokemonshowdown.com/data/moves.json`, 15000);
    return data || {};
}

/**
 * Obtiene el diccionario completo de habilidades de Showdown
 */
export async function getShowdownAbilities(): Promise<Record<string, any>> {
    const data = await fetchWithCache<any>(`https://play.pokemonshowdown.com/data/abilities.json`, 10000);
    return data || {};
}

/**
 * Obtiene los conjuntos de movimientos de Showdown (Learnsets)
 */
export async function getShowdownLearnsets(): Promise<Record<string, any>> {
    // Learnsets.json es masivo (~3.5MB), aumentamos timeout
    const data = await fetchWithCache<any>(`https://play.pokemonshowdown.com/data/learnsets.json`, 20000);
    return data || {};
}

/**
 * Obtiene el Tier de Smogon para un Pokémon específico.
 */
export async function getPokemonTier(pokemonName: string): Promise<string> {
    const data = await getShowdownPokemon(pokemonName);
    return data?.tier || 'Untiered';
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
