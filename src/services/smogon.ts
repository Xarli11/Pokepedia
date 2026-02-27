// src/services/smogon.ts

/**
 * Obtiene el Tier de Smogon para un Pokémon específico.
 * Nota: Como no hay API directa, usaremos un mapeo basado en los datos de Showdown
 * o consultaremos el endpoint de la comunidad si está disponible.
 */
export async function getPokemonTier(pokemonName: string): Promise<string> {
    try {
        // Formatear nombre para Showdown (ej: mr-mime -> mrmime)
        const formatName = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Consultar el pokedex.json oficial de Showdown
        const response = await fetch(`https://play.pokemonshowdown.com/data/pokedex.json`);
        if (!response.ok) return 'Untiered';
        const data = await response.json();
        
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
