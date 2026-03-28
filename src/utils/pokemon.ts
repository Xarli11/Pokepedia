// src/utils/pokemon.ts

export const typeTranslations: Record<string, Record<string, string>> = {
    es: {
        normal: 'Normal',
        fire: 'Fuego',
        water: 'Agua',
        electric: 'Eléctrico',
        grass: 'Planta',
        ice: 'Hielo',
        fighting: 'Lucha',
        poison: 'Veneno',
        ground: 'Tierra',
        flying: 'Volador',
        psychic: 'Psíquico',
        bug: 'Bicho',
        rock: 'Roca',
        ghost: 'Fantasma',
        dragon: 'Dragón',
        dark: 'Siniestro',
        steel: 'Acero',
        fairy: 'Hada'
    },
    en: {
        normal: 'Normal',
        fire: 'Fire',
        water: 'Water',
        electric: 'Electric',
        grass: 'Grass',
        ice: 'Ice',
        fighting: 'Fighting',
        poison: 'Poison',
        ground: 'Ground',
        flying: 'Flying',
        psychic: 'Psychic',
        bug: 'Bug',
        rock: 'Rock',
        ghost: 'Ghost',
        dragon: 'Dragon',
        dark: 'Dark',
        steel: 'Steel',
        fairy: 'Fairy'
    }
};

export const uiTranslations: Record<string, Record<string, string>> = {
    es: {
        'search_placeholder': 'Busca por nombre, número o tipo...',
        'back_to_pokedex': 'Volver a la Pokedex',
        'favorites': 'Favoritos',
        'no_favorites': 'No tienes Pokémon favoritos todavía.',
        'basic_info': 'Información Básica',
        'height': 'Altura',
        'weight': 'Peso',
        'abilities': 'Habilidades',
        'hidden': 'Oculta',
        'base_stats': 'Estadísticas Base',
        'moves': 'Movimientos',
        'moves_subtitle': 'Ataques aprendidos',
        'moves_title_seo': 'Movimientos Pokémon | Pokepedia',
        'moves_desc_seo': 'Consulta la base de datos técnica de todos los ataques Pokémon.',
        'abilities_title_seo': 'Habilidades Pokémon | Pokepedia',
        'abilities_desc_seo': 'Descubre todas las habilidades y sus efectos en combate.',
        'all_types': 'Todos los tipos',
        'search_move': 'Buscar ataque...',
        'search_ability': 'Buscar habilidad por nombre...',
        'all_methods': 'Todos los métodos',
        'by_level': 'Por nivel',
        'level': 'Nivel',
        'move': 'Movimiento',
        'method': 'Método',
        'no_moves': 'No se encontraron movimientos con esos filtros.',
        'hp': 'PS',
        'attack': 'Ataque',
        'defense': 'Defensa',
        'special-attack': 'At. Esp.',
        'special-defense': 'Def. Esp.',
        'speed': 'Velocidad',
        'desc_hero': 'La Enciclopedia',
        'desc_subtitle': 'Análisis estratégico, calculadora de tipos, tabla de debilidades y estadísticas base avanzadas de toda la Pokédex.',
        'evolution_chain': 'Cadena Evolutiva',
        'evolves_at': 'Nivel',
        'evolves_with': 'Con',
        'evolves_by': 'Por',
        'evolves_to': 'Evoluciona a',
        'condition_rain': 'Lluvia',
        'condition_day': 'Día',
        'condition_night': 'Noche',
        'condition_upside_down': 'Consola del revés',
        'condition_affection': 'Afecto',
        'condition_beauty': 'Belleza',
        'condition_happiness': 'Amistad',
        'condition_party_type': 'Tipo en equipo',
        'condition_party_species': 'Pokémon en equipo',
        'condition_location': 'Cerca de',
        'condition_stats': 'Stats',
        'loc_route': 'Ruta',
        'loc_city': 'Ciudad',
        'loc_town': 'Pueblo',
        'loc_cave': 'Cueva',
        'loc_forest': 'Bosque',
        'loc_mountain': 'Montaña',
        'loc_tower': 'Torre',
        'back_to_moves': 'Volver a Movimientos',
        'back_to_abilities': 'Volver a Habilidades',
        'back_to_items': 'Volver a Objetos',
        'items': 'Objetos',
        'items_subtitle': 'Herramientas y consumibles útiles.',
        'search_item': 'Buscar objeto...',
        'category': 'Categoría',
        'cost': 'Coste',
        'power': 'Potencia',
        'accuracy': 'Precisión',
        'physical': 'Físico',
        'special': 'Especial',
        'status': 'Estado',
        'pokemon_with_ability': 'Pokémon con esta habilidad',
        'pokemon_with_move': 'Pokémon que aprenden este ataque',
        'other_forms': 'Otras Formas',
        'total': 'Total',
        'stat_hp': 'PS',
        'stat_atk': 'ATQ',
        'stat_def': 'DEF',
        'stat_spatk': 'AT.ESP',
        'stat_spdef': 'DF.ESP',
        'stat_spd': 'VEL',
        'region': 'Región',
        'special_form': 'Forma Especial',
        'comp_analysis': 'Análisis Estratégico',
        'comp_usage': 'Clasificación de Uso',
        'comp_meta': 'Resumen de Meta',
        'comp_effects': 'Efectos Competitivos',
        'comp_no_data': 'Este Pokémon no tiene datos competitivos registrados en el formato actual.',
        'comp_no_abilities': 'No se han encontrado habilidades competitivas para este Pokémon.',
        'comp_error': 'Error al conectar con los servidores competitivos.',
        'comp_smogon_link': 'Abrir Estrategia en Smogon',
        'comp_meta_desc': 'Este Pokémon se sitúa en {tier}. Sus habilidades más efectivas para el juego competitivo son: {abilities}.',
        'support_project': '¿Te gusta Pokepedia? Invítame a un café',
        'compare': 'Comparar',
        'compare_desc': 'Enfrenta a dos Pokémon para analizar sus diferencias técnicas.',
        'select_pokemon': 'Seleccionar Pokémon',
        'vs': 'VS',
        'stat_winner': 'Superior',
        'no_advantage': 'Sin ventaja'
        },
        en: {
        'search_placeholder': 'Search by name, number or type...',

        'back_to_pokedex': 'Back to Pokedex',
        'favorites': 'Favorites',
        'no_favorites': 'You don\'t have any favorite Pokémon yet.',
        'basic_info': 'Basic Information',
        'height': 'Height',
        'weight': 'Weight',
        'abilities': 'Abilities',
        'hidden': 'Hidden',
        'base_stats': 'Base Stats',
        'moves': 'Moves',
        'moves_subtitle': 'Learned moves',
        'moves_title_seo': 'Pokémon Moves | Pokepedia',
        'moves_desc_seo': 'Check the technical database of all Pokémon attacks.',
        'abilities_title_seo': 'Pokémon Abilities | Pokepedia',
        'abilities_desc_seo': 'Discover all abilities and their effects in battle.',
        'all_types': 'All Types',
        'search_move': 'Search move...',
        'search_ability': 'Search ability by name...',
        'all_methods': 'All methods',
        'by_level': 'By level',
        'level': 'Level',
        'move': 'Move',
        'method': 'Method',
        'no_moves': 'No moves found with those filters.',
        'hp': 'HP',
        'attack': 'Attack',
        'defense': 'Defense',
        'special-attack': 'Sp. Atk.',
        'special-defense': 'Sp. Def.',
        'speed': 'Speed',
        'desc_hero': 'The Ultimate',
        'desc_subtitle': 'Technical Pokémon Encyclopedia with competitive meta analysis, type calculators, weakness charts, and advanced base stats.',
        'evolution_chain': 'Evolution Chain',
        'evolves_at': 'Level',
        'evolves_with': 'With',
        'evolves_by': 'By',
        'evolves_to': 'Evolves to',
        'condition_rain': 'Rain',
        'condition_day': 'Daytime',
        'condition_night': 'Nighttime',
        'condition_upside_down': 'Upside down',
        'condition_affection': 'Affection',
        'condition_beauty': 'Beauty',
        'condition_happiness': 'Friendship',
        'condition_party_type': 'Type in party',
        'condition_party_species': 'Pokémon in party',
        'condition_location': 'Near',
        'condition_stats': 'Stats',
        'loc_route': 'Route',
        'loc_city': 'City',
        'loc_town': 'Town',
        'loc_cave': 'Cave',
        'loc_forest': 'Forest',
        'loc_mountain': 'Mountain',
        'loc_tower': 'Tower',
        'back_to_moves': 'Back to Moves',
        'back_to_abilities': 'Back to Abilities',
        'back_to_items': 'Back to Items',
        'items': 'Items',
        'items_subtitle': 'Useful tools and consumables.',
        'search_item': 'Search item...',
        'category': 'Category',
        'cost': 'Cost',
        'power': 'Power',
        'accuracy': 'Accuracy',
        'physical': 'Physical',
        'special': 'Special',
        'status': 'Status',
        'pokemon_with_ability': 'Pokémon with this ability',
        'pokemon_with_move': 'Pokémon that learn this move',
        'other_forms': 'Other Forms',
        'total': 'Total',
        'stat_hp': 'HP',
        'stat_atk': 'ATK',
        'stat_def': 'DEF',
        'stat_spatk': 'SP.ATK',
        'stat_spdef': 'SP.DEF',
        'stat_spd': 'SPD',
        'region': 'Region',
        'special_form': 'Special Form',
        'comp_analysis': 'Strategic Analysis',
        'comp_usage': 'Usage Classification',
        'comp_meta': 'Meta Summary',
        'comp_effects': 'Competitive Effects',
        'comp_no_data': 'No competitive data found for this Pokémon in the current format.',
        'comp_no_abilities': 'No competitive abilities found for this Pokémon.',
        'comp_error': 'Error connecting to competitive servers.',
        'comp_smogon_link': 'Open Smogon Strategy',
        'comp_meta_desc': 'This Pokémon is ranked in {tier}. Its most effective abilities for competitive play are: {abilities}.',
        'support_project': 'Enjoying Pokepedia? Buy me a coffee',
        'compare': 'Compare',
        'compare_desc': 'Face two Pokémon to analyze their technical differences.',
        'select_pokemon': 'Select Pokémon',
        'vs': 'VS',
        'stat_winner': 'Superior',
        'no_advantage': 'No advantage'
    }
};

export const evolutionTranslations: Record<string, Record<string, string>> = {
    es: {
        'level-up': 'Subir nivel',
        'trade': 'Intercambio',
        'use-item': 'Usar objeto',
        'shed': 'Nincada',
        'other': 'Especial'
    },
    en: {
        'level-up': 'Level Up',
        'trade': 'Trade',
        'use-item': 'Use Item',
        'shed': 'Shed',
        'other': 'Special'
    }
};

export const methodTranslations: Record<string, Record<string, string>> = {
    es: {
        'level-up': 'Nivel',
        'machine': 'MT/MO',
        'egg': 'Huevo',
        'tutor': 'Tutor'
    },
    en: {
        'level-up': 'Level',
        'machine': 'TM/HM',
        'egg': 'Egg',
        'tutor': 'Tutor'
    }
};

export const versionTranslations: Record<string, string> = {
    'red': 'Rojo',
    'blue': 'Azul',
    'yellow': 'Amarillo',
    'gold': 'Oro',
    'silver': 'Plata',
    'crystal': 'Cristal',
    'ruby': 'Rubí',
    'sapphire': 'Zafiro',
    'emerald': 'Esmeralda',
    'firered': 'Rojo Fuego',
    'leafgreen': 'Verde Hoja',
    'diamond': 'Diamante',
    'pearl': 'Perla',
    'platinum': 'Platino',
    'heartgold': 'HeartGold',
    'soulsilver': 'SoulSilver',
    'black': 'Negro',
    'white': 'Blanco',
    'black-2': 'Negro 2',
    'white-2': 'Blanco 2',
    'x': 'X',
    'y': 'Y',
    'omega-ruby': 'Rubí Omega',
    'alpha-sapphire': 'Zafiro Alfa',
    'sun': 'Sol',
    'moon': 'Luna',
    'ultra-sun': 'Ultra Sol',
    'ultra-moon': 'Ultra Luna',
    'lets-go-pikachu': 'Let\'s Go Pikachu',
    'lets-go-eevee': 'Let\'s Go Eevee',
    'sword': 'Espada',
    'shield': 'Escudo',
    'scarlet': 'Escarlata',
    'violet': 'Púrpura',
    'red-blue': 'Rojo / Azul',
    'gold-silver': 'Oro / Plata',
    'ruby-sapphire': 'Rubí / Zafiro',
    'firered-leafgreen': 'Rojo Fuego / Verde Hoja',
    'diamond-pearl': 'Diamante / Perla',
    'heartgold-soulsilver': 'HeartGold / SoulSilver',
    'black-white': 'Negro / Blanco',
    'black-2-white-2': 'Negro 2 / Blanco 2',
    'x-y': 'X / Y',
    'omega-ruby-alpha-sapphire': 'Rubí Omega / Zafiro Alfa',
    'sun-moon': 'Sol / Luna',
    'ultra-sun-ultra-moon': 'Ultra Sol / Ultra Luna',
    'lets-go-pikachu-lets-go-eevee': 'Let\'s Go Pikachu / Eevee',
    'sword-shield': 'Espada / Escudo',
    'scarlet-violet': 'Escarlata / Púrpura'
};

export const typeColors: Record<string, string> = {
    normal: '#A8A77A',
    fire: '#EE8130',
    water: '#6390F0',
    electric: '#F7D02C',
    grass: '#7AC74C',
    ice: '#96D9D6',
    fighting: '#C22E28',
    poison: '#A33EA1',
    ground: '#E2BF65',
    flying: '#A98FF3',
    psychic: '#F95587',
    bug: '#A6B91A',
    rock: '#B6A136',
    ghost: '#735797',
    dragon: '#6F35FC',
    dark: '#705746',
    steel: '#B7B7CE',
    fairy: '#D685AD'
};

export const encounterTranslations: Record<string, Record<string, string>> = {
    es: {
        'walk': 'Caminando',
        'surf': 'Surf',
        'old-rod': 'Caña Vieja',
        'good-rod': 'Caña Buena',
        'super-rod': 'Supercaña',
        'gift': 'Regalo',
        'headbutt': 'Golpe Cabeza',
        'rock-smash': 'Golpe Roca',
        'sweet-scent': 'Dulce Aroma',
        'only-one': 'Único',
        'pokeflute': 'Poké Flauta',
        'rough-terrain': 'Terreno Abrupto',
        'sea-foam-islands-surf': 'Islas Espuma (Surf)',
        'cave-spots': 'Sombras en Cueva',
        'bridge-spots': 'Sombras en Puente',
        'super-rod-spots': 'Sombras Supercaña',
        'surf-spots': 'Sombras en Agua',
        'grass-spots': 'Hierba Movediza',
        'dark-grass': 'Hierba Oscura',
        'yellow-flowers': 'Flores Amarillas',
        'purple-flowers': 'Flores Moradas',
        'red-flowers': 'Flores Rojas',
        'rough-grass': 'Hierba Alta',
        'gift-egg': 'Huevo Regalo',
        'location': 'Ubicación',
        'chance': 'Probabilidad',
        'method': 'Método',
        'encounters_title': 'Localización y Encuentros',
        'more_areas': 'zonas más...'
    },
    en: {
        'walk': 'Walking',
        'surf': 'Surf',
        'old-rod': 'Old Rod',
        'good-rod': 'Good Rod',
        'super-rod': 'Super Rod',
        'gift': 'Gift',
        'headbutt': 'Headbutt',
        'rock-smash': 'Rock Smash',
        'sweet-scent': 'Sweet Scent',
        'only-one': 'Only One',
        'pokeflute': 'Poké Flute',
        'rough-terrain': 'Rough Terrain',
        'sea-foam-islands-surf': 'Sea Foam Islands (Surf)',
        'cave-spots': 'Cave Spots',
        'bridge-spots': 'Bridge Spots',
        'super-rod-spots': 'Super Rod Spots',
        'surf-spots': 'Surf Spots',
        'grass-spots': 'Grass Spots',
        'dark-grass': 'Dark Grass',
        'yellow-flowers': 'Yellow Flowers',
        'purple-flowers': 'Purple Flowers',
        'red-flowers': 'Red Flowers',
        'rough-grass': 'Rough Grass',
        'gift-egg': 'Gift Egg',
        'location': 'Location',
        'chance': 'Chance',
        'method': 'Method',
        'encounters_title': 'Location & Encounters',
        'more_areas': 'more areas...'
    }
};

export const itemTranslations: Record<string, Record<string, string>> = {
    es: {
        'countable': 'Contable',
        'consumable': 'Consumible',
        'usable-in-battle': 'Uso en combate',
        'holdable': 'Equipable',
        'holdable-active': 'Equipable (Activo)',
        'underground': 'Subsuelo',
        'all-machines': 'Todas las MT/MO',
        'machines': 'MT / MO',
        'pokeballs': 'Poké Balls',
        'standard-balls': 'Poké Balls',
        'special-balls': 'Bolas Especiales',
        'apricorn-balls': 'Bolas de Bonguri',
        'medicine': 'Medicina',
        'evolution': 'Evolución',
        'berries': 'Bayas',
        'held-items': 'Objetos Equipables',
        'choice': 'Elección',
        'effort-training': 'Entrenamiento Esfuerzo',
        'bad-held-items': 'Objetos Perjudiciales',
        'training': 'Entrenamiento',
        'plates': 'Tablas',
        'species-specific': 'Específicos de Especie',
        'type-enhancement': 'Potenciadores de Tipo',
        'collectibles': 'Coleccionables',
        'evolution-stones': 'Piedras Evolutivas',
        'unused': 'Sin uso',
        'plot-adventure': 'Historia/Aventura',
        'stat-boosts': 'Mejora de Stats'
    },
    en: {
        'countable': 'Countable',
        'consumable': 'Consumable',
        'usable-in-battle': 'Usable in battle',
        'holdable': 'Holdable',
        'holdable-active': 'Holdable (Active)',
        'underground': 'Underground',
        'all-machines': 'All Machines',
        'standard-balls': 'Standard Balls',
        'special-balls': 'Special Balls',
        'apricorn-balls': 'Apricorn Balls',
        'medicine': 'Medicine',
        'evolution': 'Evolution',
        'berries': 'Berries',
        'held-items': 'Held Items',
        'choice': 'Choice',
        'effort-training': 'Effort Training',
        'bad-held-items': 'Bad Held Items',
        'training': 'Training',
        'plates': 'Plates',
        'species-specific': 'Species Specific',
        'type-enhancement': 'Type Enhancement',
        'collectibles': 'Collectibles',
        'evolution-stones': 'Evolution Stones',
        'unused': 'Unused',
        'plot-adventure': 'Plot/Adventure',
        'stat-boosts': 'Stat Boosts'
    }
};

/**
 * Normaliza las categorías técnicas de PokeAPI a categorías de usuario.
 */
export function getItemSuperCategory(rawCat: string): string {
    const categories: Record<string, string[]> = {
        'berries': ['berries', 'baking-only', 'picky-healing', 'type-protection', 'in-a-pinch'],
        'medicine': ['medicine', 'healing', 'status-cures', 'revival', 'vitamins', 'pp-recovery'],
        'pokeballs': ['standard-balls', 'special-balls', 'apricorn-balls'],
        'held-items': ['held-items', 'choice', 'plates', 'type-enhancement', 'effort-training', 'bad-held-items'],
        'evolution': ['evolution', 'evolution-stones', 'mega-stones', 'z-crystals'],
        'machines': ['all-machines']
    };

    for (const [superCat, list] of Object.entries(categories)) {
        if (list.includes(rawCat)) return superCat;
    }
    return rawCat;
}

export function formatPokemonNumber(id: number): string {
    return `#${id.toString().padStart(4, '0')}`;
}

export function formatName(name: string): string {
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Traduce nombres de ubicaciones técnicos a algo legible en español, 
 * manejando el orden correcto de las palabras (Ej: Cerulean City -> Ciudad Celeste).
 */
export function formatLocationName(name: string, lang: string = 'es'): string {
    let n = name.toLowerCase().replace(/-/g, ' ');
    if (lang !== 'es') return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // 1. Mapeo de nombres emblemáticos que cambian por completo
    const specialLocations: Record<string, string> = {
        'cerulean city': 'Ciudad Celeste',
        'pallet town': 'Pueblo Paleta',
        'vermilion city': 'Ciudad Carmín',
        'saffron city': 'Ciudad Azafrán',
        'lavender town': 'Pueblo Lavanda',
        'celadon city': 'Ciudad Azulona',
        'fuchsia city': 'Ciudad Fucsia',
        'cinnabar island': 'Isla Canela',
        'viridian city': 'Ciudad Verde',
        'pewter city': 'Ciudad Plateada',
        'goldenrod city': 'Ciudad Trigal',
        'ecruteak city': 'Ciudad Iris',
        'olivine city': 'Ciudad Olivo',
        'azalea town': 'Pueblo Azalea',
        'violet city': 'Ciudad Malva',
        'cherrygrove city': 'Pueblo Cerezo',
        'new bark town': 'Pueblo Primavera',
        'lumiose city': 'Ciudad Luminalia',
        'victory road': 'Calle Victoria',
        'mt silver': 'Monte Plateado',
        'mt moon': 'Monte Moon',
        'seafoam islands': 'Islas Espuma'
    };

    if (specialLocations[n]) return specialLocations[n];

    // 2. Limpieza de términos técnicos
    n = n.replace(/\barea\b/gi, '').replace(/\bmain\b/gi, 'Principal').trim();

    // 3. Diccionario de tipos de lugar
    const terms: Record<string, string> = {
        'city': 'Ciudad',
        'town': 'Pueblo',
        'route': 'Ruta',
        'cave': 'Cueva',
        'forest': 'Bosque',
        'mount': 'Monte',
        'mt': 'Monte',
        'island': 'Isla',
        'path': 'Senda',
        'lake': 'Lago',
        'tower': 'Torre',
        'sea': 'Mar',
        'woods': 'Bosque',
        'temple': 'Templo',
        'ruins': 'Ruinas'
    };

    // 4. Traducción de nombres específicos
    const nameTranslations: Record<string, string> = {
        'pallet': 'Paleta',
        'cerulean': 'Celeste',
        'vermilion': 'Carmín',
        'pewter': 'Plateada',
        'viridian': 'Verde',
        'saffron': 'Azafrán',
        'fuchsia': 'Fucsia',
        'celadon': 'Azulona',
        'lavender': 'Lavanda',
        'cinnabar': 'Canela',
        'lumiose': 'Luminalia',
        'victory': 'Victoria',
        'silver': 'Plateado'
    };

    // 5. Lógica de transposición y traducción
    for (const [eng, esp] of Object.entries(terms)) {
        if (n.includes(eng)) {
            let specificName = n.replace(eng, '').trim();
            
            // Traducir el nombre específico si existe en el mapa
            if (nameTranslations[specificName]) {
                specificName = nameTranslations[specificName];
            }

            const capitalizedName = specificName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return `${esp} ${capitalizedName}`.trim();
        }
    }

    // Fallback normal
    return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Filtra objetos que no son oficiales o parecen ser datos basura de la PokeAPI.
 */
export function isRealItem(name: string): boolean {
    // Filtrar objetos que empiezan con caracteres extraños o códigos alfanuméricos sospechosos
    if (name.startsWith('★')) return false;
    if (/^[a-z]\d+/.test(name)) return false; // ej: m12, c23...
    if (name.includes('data-span')) return false;
    if (name.length > 30 && /\d/.test(name)) return false; // Nombres excesivamente largos con números
    return true;
}

/**
 * Formatea nombres de Pokémon manejando variedades (G-Max, Megas, etc.)
 */
export function formatPokemonName(technicalName: string, speciesName: string, lang: string = 'es'): string {
    const name = technicalName.toLowerCase();
    const species = speciesName.toLowerCase();
    
    if (name === species) return formatName(species);

    const suffix = name.replace(species, '').replace(/-/g, ' ').trim();
    if (!suffix) return formatName(species);

    const suffixMap: Record<string, string> = {
        'gmax': lang === 'es' ? 'Gigamax' : 'G-Max',
        'mega': 'Mega',
        'alola': 'Alola',
        'galar': 'Galar',
        'hisui': 'Hisui',
        'paldea': 'Paldea',
        'mega x': 'Mega X',
        'mega y': 'Mega Y',
        'primal': lang === 'es' ? 'Primigenio' : 'Primal',
        'origin': lang === 'es' ? 'Origen' : 'Origin'
    };

    const prettySuffix = suffixMap[suffix.toLowerCase()] || suffix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${formatName(species)} (${prettySuffix})`;
}

/**
 * Mapea el nombre técnico de PokeAPI al nombre que espera PokeTypes.
 * Esta función asegura el 100% de compatibilidad entre ambos sistemas.
 */
export function getPoketypesName(name: string): string {
    const n = name.toLowerCase();
    
    // 1. Mapeo de Excepciones Directas (Nombres que cambian totalmente o tienen sufijos únicos)
    const specialMappings: Record<string, string> = {
        'zacian-hero': 'zacian',
        'zamazenta-hero': 'zamazenta',
        'zygarde': 'zygarde-50',
        'zygarde-10-power-construct': 'zygarde-10',
        'zygarde-50-power-construct': 'zygarde-50',
        'zygarde-complete': 'zygarde-complete',
        'darmanitan-standard': 'darmanitan',
        'darmanitan-zen': 'darmanitan-zen',
        'darmanitan-galar-standard': 'darmanitan-galar',
        'darmanitan-galar-zen': 'darmanitan-galar-zen',
        'mimikyu-disguised': 'mimikyu',
        'mimikyu-busted': 'mimikyu-busted',
        'aegislash-shield': 'aegislash',
        'aegislash-blade': 'aegislash-blade',
        'keldeo-ordinary': 'keldeo',
        'keldeo-resolute': 'keldeo-resolute',
        'meloetta-aria': 'meloetta',
        'meloetta-pirouette': 'meloetta-pirouette',
        'toxtricity-amped': 'toxtricity',
        'toxtricity-low-key': 'toxtricity',
        'toxtricity-amped-gmax': 'toxtricity-gmax',
        'toxtricity-low-key-gmax': 'toxtricity-gmax',
        'wishiwashi-solo': 'wishiwashi',
        'wishiwashi-school': 'wishiwashi-school',
        'deoxys-normal': 'deoxys',
        'deoxys-attack': 'deoxys-attack',
        'deoxys-defense': 'deoxys-defense',
        'deoxys-speed': 'deoxys-speed',
        'giratina-altered': 'giratina',
        'giratina-origin': 'giratina-origin',
        'shaymin-land': 'shaymin',
        'shaymin-sky': 'shaymin-sky',
        'basculin-red-striped': 'basculin',
        'basculin-blue-striped': 'basculin-blue-striped',
        'basculin-white-striped': 'basculin-white-striped',
        'basculegion-male': 'basculegion-male',
        'basculegion-female': 'basculegion-female',
        'enamorus-incarnate': 'enamorus',
        'enamorus-therian': 'enamorus-therian',
        'thundurus-incarnate': 'thundurus',
        'thundurus-therian': 'thundurus-therian',
        'tornadus-incarnate': 'tornadus',
        'tornadus-therian': 'tornadus-therian',
        'landorus-incarnate': 'landorus',
        'landorus-therian': 'landorus-therian',
        'pumpkaboo-average': 'pumpkaboo',
        'pumpkaboo-small': 'pumpkaboo',
        'pumpkaboo-large': 'pumpkaboo',
        'pumpkaboo-super': 'pumpkaboo',
        'gourgeist-average': 'gourgeist',
        'gourgeist-small': 'gourgeist',
        'gourgeist-large': 'gourgeist',
        'gourgeist-super': 'gourgeist',
        'oricorio-baile': 'oricorio',
        'oricorio-pom-pom': 'oricorio-pom-pom',
        'oricorio-pau': 'oricorio-pau',
        'oricorio-sensu': 'oricorio-sensu',
        'lycanroc-midday': 'lycanroc',
        'lycanroc-midnight': 'lycanroc-midnight',
        'lycanroc-dusk': 'lycanroc-dusk',
        'rockruff-own-tempo': 'rockruff',
        'urshifu-single-strike': 'urshifu',
        'urshifu-rapid-strike': 'urshifu-rapid-strike',
        'urshifu-single-strike-gmax': 'urshifu-gmax',
        'urshifu-rapid-strike-gmax': 'urshifu-rapid-strike-gmax',
        'calyrex-ice': 'calyrex-ice',
        'calyrex-shadow': 'calyrex-shadow',
        'maushold-family-of-four': 'maushold',
        'maushold-family-of-three': 'maushold',
        'dudunsparce-two-segment': 'dudunsparce',
        'dudunsparce-three-segment': 'dudunsparce',
        'palafin-zero': 'palafin',
        'palafin-hero': 'palafin-hero',
        'gimmighoul-chest': 'gimmighoul',
        'gimmighoul-roaming': 'gimmighoul',
        'poltchageist-counterfeit': 'poltchageist',
        'poltchageist-artisan': 'poltchageist',
        'sinistcha-unremarkable': 'sinistcha',
        'sinistcha-masterpiece': 'sinistcha',
        'squawkabilly-green-plumage': 'squawkabilly',
        'squawkabilly-blue-plumage': 'squawkabilly-blue-plumage',
        'squawkabilly-yellow-plumage': 'squawkabilly-yellow-plumage',
        'squawkabilly-white-plumage': 'squawkabilly-white-plumage',
        'tatsugiri-curly': 'tatsugiri',
        'tatsugiri-droopy': 'tatsugiri-droopy',
        'tatsugiri-stretchy': 'tatsugiri-stretchy',
        'minior-red-meteor': 'minior',
        'minior-red': 'minior'
    };

    if (specialMappings[n]) return specialMappings[n];

    // 2. Limpieza de sufijos cosméticos o de estado que no alteran tipos/stats en PokeTypes
    const genericSuffixes = [
        '-spring', '-summer', '-autumn', '-winter', // Sawsbuck/Deerling
        '-gulping', '-gorging', // Cramorant
        '-hangry', // Morpeko
        '-meteor' // Minior
    ];

    for (const suffix of genericSuffixes) {
        if (n.endsWith(suffix)) return n.replace(suffix, '');
    }

    // 3. Manejo de formas regionales (Asegurar que mantenemos el sufijo regional)
    // Ej: rattata-alola -> rattata-alola (PokeTypes lo encontrará por apiName)
    
    return n;
}
