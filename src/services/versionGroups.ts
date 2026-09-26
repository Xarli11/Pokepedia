// src/services/versionGroups.ts
//
// Explicit chronological ranking of core-series version groups.
//
// Why this exists: "most recent entry" must NOT be determined by an entry's
// position in whatever array PokeAPI happens to return — the API does not
// document array order as a stable contract, and relying on it silently
// breaks if that ever changes. Recency is instead resolved against this
// fixed, hand-verified table, so selection is order-independent by
// construction (see src/services/localizedText.ts).

//
// Ordering decisions for groups whose position is not obvious (all documented
// in docs/DATA_SOURCES.md):
//  - `red-green-japan` / `blue-japan`: the original Japanese releases, older
//    than red-blue.
//  - `colosseum` / `xd`: GameCube spin-offs. Placed after firered-leafgreen
//    (the newest Gen III core release they are contemporary with) and before
//    diamond-pearl. Relative order of the pre-existing entries is unchanged.
//  - `the-isle-of-armor` / `the-crown-tundra`: sword-shield DLC, released
//    2020, i.e. before brilliant-diamond-shining-pearl (2021).
//  - `mega-dimension`: Z-A DLC, after legends-za.
//  - `champions`: Pokémon Champions (2026), the newest group PokeAPI lists.
export const VERSION_GROUP_ORDER: readonly string[] = [
  'red-green-japan',
  'blue-japan',
  'red-blue',
  'yellow',
  'gold-silver',
  'crystal',
  'ruby-sapphire',
  'emerald',
  'firered-leafgreen',
  'colosseum',
  'xd',
  'diamond-pearl',
  'platinum',
  'heartgold-soulsilver',
  'black-white',
  'black-2-white-2',
  'x-y',
  'omega-ruby-alpha-sapphire',
  'sun-moon',
  'ultra-sun-ultra-moon',
  'lets-go-pikachu-lets-go-eevee',
  'sword-shield',
  'the-isle-of-armor',
  'the-crown-tundra',
  'brilliant-diamond-shining-pearl',
  'legends-arceus',
  'scarlet-violet',
  'the-teal-mask',
  'the-indigo-disk',
  'legends-za',
  'mega-dimension',
  'champions',
];

const RANK_BY_NAME: Record<string, number> = Object.fromEntries(
  VERSION_GROUP_ORDER.map((name, i) => [name, i])
);

/**
 * Chronological rank of a version group (higher = more recent).
 * Unknown/unrecognized version groups rank below every known one, so a
 * recognized reliable version group always outranks an unrecognized one,
 * while an unrecognized one can still be selected if it's the only option.
 */
export function versionGroupRank(versionGroup: string | undefined): number {
  if (!versionGroup) return -1;
  return RANK_BY_NAME[versionGroup] ?? -1;
}

/**
 * Version groups ordered oldest → newest. Order-independent with respect to
 * the input (never alphabetical); unknown groups sort first, ties by name so
 * the result is deterministic.
 */
export function sortVersionGroups(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => versionGroupRank(a) - versionGroupRank(b) || a.localeCompare(b));
}

/** Most recent version group among `names` ('' when there are none). */
export function latestVersionGroup(names: Iterable<string>): string {
  const sorted = sortVersionGroups(names);
  return sorted[sorted.length - 1] ?? '';
}

const LABELS_ES: Record<string, string> = {
  'red-green-japan': 'Rojo / Verde (Japón)',
  'blue-japan': 'Azul (Japón)',
  'red-blue': 'Rojo / Azul',
  'yellow': 'Amarillo',
  'gold-silver': 'Oro / Plata',
  'crystal': 'Cristal',
  'ruby-sapphire': 'Rubí / Zafiro',
  'emerald': 'Esmeralda',
  'firered-leafgreen': 'Rojo Fuego / Verde Hoja',
  'colosseum': 'Colosseum',
  'xd': 'XD',
  'diamond-pearl': 'Diamante / Perla',
  'platinum': 'Platino',
  'heartgold-soulsilver': 'HeartGold / SoulSilver',
  'black-white': 'Negro / Blanco',
  'black-2-white-2': 'Negro 2 / Blanco 2',
  'x-y': 'X / Y',
  'omega-ruby-alpha-sapphire': 'Rubí Omega / Zafiro Alfa',
  'sun-moon': 'Sol / Luna',
  'ultra-sun-ultra-moon': 'Ultra Sol / Ultra Luna',
  'lets-go-pikachu-lets-go-eevee': "Let's Go Pikachu / Eevee",
  'sword-shield': 'Espada / Escudo',
  'the-isle-of-armor': 'La Isla de la Armadura',
  'the-crown-tundra': 'Las Nieves de la Corona',
  'brilliant-diamond-shining-pearl': 'Diamante Brillante / Perla Reluciente',
  'legends-arceus': 'Leyendas Pokémon: Arceus',
  'scarlet-violet': 'Escarlata / Púrpura',
  'the-teal-mask': 'La Máscara Turquesa',
  'the-indigo-disk': 'El Disco Índigo',
  'legends-za': 'Leyendas Pokémon: Z-A',
  'mega-dimension': 'Mega Dimensión',
  'champions': 'Pokémon Champions',
};

const LABELS_EN: Record<string, string> = {
  'red-green-japan': 'Red / Green (Japan)',
  'blue-japan': 'Blue (Japan)',
  'red-blue': 'Red / Blue',
  'yellow': 'Yellow',
  'gold-silver': 'Gold / Silver',
  'crystal': 'Crystal',
  'ruby-sapphire': 'Ruby / Sapphire',
  'emerald': 'Emerald',
  'firered-leafgreen': 'FireRed / LeafGreen',
  'colosseum': 'Colosseum',
  'xd': 'XD',
  'diamond-pearl': 'Diamond / Pearl',
  'platinum': 'Platinum',
  'heartgold-soulsilver': 'HeartGold / SoulSilver',
  'black-white': 'Black / White',
  'black-2-white-2': 'Black 2 / White 2',
  'x-y': 'X / Y',
  'omega-ruby-alpha-sapphire': 'Omega Ruby / Alpha Sapphire',
  'sun-moon': 'Sun / Moon',
  'ultra-sun-ultra-moon': 'Ultra Sun / Ultra Moon',
  'lets-go-pikachu-lets-go-eevee': "Let's Go Pikachu / Eevee",
  'sword-shield': 'Sword / Shield',
  'the-isle-of-armor': 'The Isle of Armor',
  'the-crown-tundra': 'The Crown Tundra',
  'brilliant-diamond-shining-pearl': 'Brilliant Diamond / Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet-violet': 'Scarlet / Violet',
  'the-teal-mask': 'The Teal Mask',
  'the-indigo-disk': 'The Indigo Disk',
  'legends-za': 'Legends: Z-A',
  'mega-dimension': 'Mega Dimension',
  'champions': 'Pokémon Champions',
};

/** Display name of a version group in `lang` (es | en); prettified slug when unknown. */
export function versionGroupLabel(name: string, lang: string): string {
  const table = lang === 'en' ? LABELS_EN : LABELS_ES;
  return table[name] ?? name.replace(/-/g, ' ');
}
