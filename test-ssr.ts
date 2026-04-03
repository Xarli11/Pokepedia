import { getPokemonByName, getEvolutionChain } from './src/services/pokeapi';
import { getShowdownPokemon } from './src/services/smogon';
import { formatName } from './src/utils/pokemon';

async function renderFroslassMega() {
    const lang = 'es';
    const name = 'froslass-mega';

    const rawName = name;
    
    let detail: any = null;
    let species: any = null;
    let pokemonData: any = null;

    try {
        pokemonData = await getPokemonByName(name);
        if (!pokemonData) throw new Error("No data");
        detail = pokemonData.detail;
        species = pokemonData.species;
    } catch (e) {
        console.error("Critical error loading pokemon base data:", e);
        return;
    }

    const rawDetail = detail;

    // Inicializar arrays para evitar errores de undefined
    detail.abilities = detail.abilities || [];
    detail.moves = detail.moves || [];
    detail.stats = detail.stats || [];
    detail.types = detail.types || [];

    // 1. Enriquecer con Showdown
    try {
        const showdownData = await getShowdownPokemon(name);
        if (showdownData) {
            // Habilidades desde Showdown
            if (showdownData.abilities) {
                detail.abilities = Object.values(showdownData.abilities).map((abilityName: any, index) => ({
                    ability: { 
                        name: abilityName.toLowerCase().replace(/\s+/g, '-'), 
                        url: `https://pokeapi.co/api/v2/ability/${abilityName.toLowerCase().replace(/\s+/g, '-')}` 
                    },
                    is_hidden: index > 0,
                    slot: index + 1
                }));
            }

            // Tipos desde Showdown
            if (showdownData.types && showdownData.types.length > 0) {
                detail.types = showdownData.types.map((typeName: string, index: number) => ({
                    slot: index + 1,
                    type: {
                        name: typeName.toLowerCase(),
                        url: `https://pokeapi.co/api/v2/type/${typeName.toLowerCase()}/`
                    }
                }));
            }

            // Stats desde Showdown
            if (showdownData.baseStats) {
                const statMap: Record<string, string> = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' };
                detail.stats = detail.stats.map((s: any) => {
                    const showdownKey = Object.keys(statMap).find(key => statMap[key] === s.stat.name);
                    return { ...s, base_stat: (showdownKey && showdownData.baseStats[showdownKey]) ? showdownData.baseStats[showdownKey] : s.base_stat };
                });
            }
        }
    } catch (e) {}

    // 2. Fallback de especie
    if (detail.moves.length === 0 || detail.abilities.length === 0) {
        const baseVariety = species?.varieties?.find((v: any) => v.is_default);
        if (baseVariety && baseVariety.pokemon.name !== detail.name) {
            try {
                const baseRes = await fetch(baseVariety.pokemon.url);
                if (baseRes.ok) {
                    const baseDetail = await baseRes.json();
                    if (detail.abilities.length === 0) detail.abilities = baseDetail.abilities || [];
                    if (detail.moves.length === 0) detail.moves = baseDetail.moves || [];
                }
            } catch (e) {}
        }
    }

    // 3. Datos Técnicos
    let evolutionChain = null;
    let abilitiesWithTranslation = [];
    let varieties = [];

    try {
        const results = await Promise.allSettled([
            species?.evolution_chain?.url ? getEvolutionChain(species.evolution_chain.url) : Promise.resolve(null),
            Promise.all(detail.abilities.map(async (a: any) => {
                try {
                    const res = await fetch(a.ability.url);
                    if (!res.ok) throw new Error();
                    const ad = await res.json();
                    return {
                        ...a,
                        displayName: ad.names?.find((n: any) => n.language.name === lang)?.name || formatName(a.ability.name),
                        description: ad.flavor_text_entries?.find((f: any) => f.language.name === lang)?.flavor_text.replace(/\f/g, ' ') || 
                                     ad.flavor_text_entries?.find((f: any) => f.language.name === 'en')?.flavor_text.replace(/\f/g, ' ') || ""
                    };
                } catch (e) {
                    return { ...a, displayName: formatName(a.ability.name), description: "" };
                }
            })),
            species?.varieties ? Promise.all(species.varieties.filter((v: any) => !v.is_default).map((v: any) => fetch(v.pokemon.url).then(r => r.ok ? r.json() : null))) : Promise.resolve([])
        ]);

        evolutionChain = results[0].status === 'fulfilled' ? results[0].value : null;
        abilitiesWithTranslation = results[1].status === 'fulfilled' ? results[1].value : [];
        varieties = (results[2].status === 'fulfilled' ? (results[2].value as any[]) : []).filter(Boolean);
    } catch (e) {}

    const t = { stat_hp: "HP" };
    const speciesName = species ? (species.names?.find((n: any) => n.language.name === lang)?.name || species.name) : detail.name;
    let localizedName = speciesName;

    if (species && detail.name !== species.name) {
        const suffix = detail.name.replace(species.name, '').replace(/-/g, ' ').trim();
        if (suffix) {
            const suffixMap: Record<string, string> = {
                'gmax': lang === 'es' ? 'Gigamax' : 'G-Max', 'mega': 'Mega', 'alola': 'Alola', 'galar': 'Galar', 'hisui': 'Hisui', 'paldea': 'Paldea', 'mega x': 'Mega X', 'mega y': 'Mega Y'
            };
            localizedName = `${speciesName} (${suffixMap[suffix.toLowerCase()] || formatName(suffix)})`;
        }
    }

    const description = species?.flavor_text_entries?.find((entry: any) => entry.language.name === lang)?.flavor_text.replace(/\f/g, ' ') || "";

    const pokemonId = detail.id;
    const officialArtwork = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;

    const totalStats = detail.stats.reduce((acc: number, s: any) => acc + s.base_stat, 0);

    const speciesUrl = rawDetail.species?.url || '';
    const speciesIdMatch = speciesUrl.match(/\/pokemon-species\/(\d+)\//);
    const currentDexId = pokemonId > 10000 ? (speciesIdMatch ? speciesIdMatch[1] : pokemonId) : pokemonId;
    const prevId = Number(currentDexId) === 1 ? 1025 : Number(currentDexId) - 1;
    const nextId = Number(currentDexId) === 1025 ? 1 : Number(currentDexId) + 1;

    console.log(`Ready to render JSX for ${localizedName}, Prev: ${prevId}, Next: ${nextId}`);
}

renderFroslassMega();
