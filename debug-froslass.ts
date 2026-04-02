import { getPokemonByName, getEvolutionChain } from './src/services/pokeapi';
import { getShowdownPokemon } from './src/services/smogon';
import { formatName } from './src/utils/pokemon';

async function testFroslassMega() {
    const lang = 'es';
    const name = 'froslass-mega';

    console.log("1. Fetching base data...");
    let pokemonData;
    try {
        pokemonData = await getPokemonByName(name);
    } catch (e) {
        console.error("FAILED at getPokemonByName:", e);
        return;
    }

    const { detail: rawDetail, species } = pokemonData;
    let detail = { ...rawDetail };
    
    detail.abilities = detail.abilities || [];
    detail.moves = detail.moves || [];
    detail.stats = detail.stats || [];
    detail.types = detail.types || [];

    console.log("2. Fetching Showdown data...");
    try {
        const showdownData = await getShowdownPokemon(name);
        if (showdownData) {
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

            if (showdownData.types && showdownData.types.length > 0) {
                detail.types = showdownData.types.map((typeName: string, index: number) => ({
                    slot: index + 1,
                    type: {
                        name: typeName.toLowerCase(),
                        url: `https://pokeapi.co/api/v2/type/${typeName.toLowerCase()}/`
                    }
                }));
            }

            if (showdownData.baseStats) {
                const statMap: Record<string, string> = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' };
                detail.stats = detail.stats.map((s: any) => {
                    const showdownKey = Object.keys(statMap).find(key => statMap[key] === s.stat.name);
                    return { ...s, base_stat: (showdownKey && showdownData.baseStats[showdownKey]) ? showdownData.baseStats[showdownKey] : s.base_stat };
                });
            }
        }
    } catch (e) {
        console.error("FAILED at Showdown enrichment:", e);
    }

    console.log("3. Fallback de especie...");
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
            } catch (e) {
                console.error("FAILED at Fallback de especie:", e);
            }
        }
    }

    console.log("4. Fetching Technical Data...");
    let evolutionChain = null;
    let abilitiesWithTranslation = [];
    let varieties = [];

    try {
        const results = await Promise.allSettled([
            species?.evolution_chain?.url ? getEvolutionChain(species.evolution_chain.url) : Promise.resolve(null),
            Promise.all(detail.abilities.map(async (a: any) => {
                try {
                    const res = await fetch(a.ability.url);
                    if (!res.ok) throw new Error("Ability fetch not ok");
                    const ad = await res.json();
                    return {
                        ...a,
                        displayName: ad.names?.find((n: any) => n.language.name === lang)?.name || formatName(a.ability.name),
                        description: ad.flavor_text_entries?.find((f: any) => f.language.name === lang)?.flavor_text.replace(/\f/g, ' ') || ""
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
    } catch (e) {
        console.error("FAILED at Technical Data:", e);
    }

    console.log("5. Navigation Logic...");
    const pokemonId = detail.id;
    const speciesUrl = rawDetail.species?.url || '';
    const speciesIdMatch = speciesUrl.match(/\/pokemon-species\/(\d+)\//);
    const currentDexId = pokemonId > 10000 ? (speciesIdMatch ? speciesIdMatch[1] : pokemonId) : pokemonId;
    const prevId = Number(currentDexId) === 1 ? 1025 : Number(currentDexId) - 1;
    const nextId = Number(currentDexId) === 1025 ? 1 : Number(currentDexId) + 1;

    console.log(`Navigation IDs - Current: ${currentDexId}, Prev: ${prevId}, Next: ${nextId}`);

    console.log("6. SUCCESS. No crashes.");
}

testFroslassMega();
