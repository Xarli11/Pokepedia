// src/services/versionGroups.ts
//
// Version group metadata: chronology, display names and default eligibility.
//
// Why this exists: "most recent entry" must NOT be determined by an entry's
// position in whatever array PokeAPI happens to return — the API does not
// document array order as a stable contract, and relying on it silently
// breaks if that ever changes. Recency is instead resolved against this
// fixed, hand-verified table, so selection is order-independent by
// construction (see src/services/localizedText.ts).

//
// Two different questions, deliberately answered separately:
//
//  1. "Which version group is the most recent one this Pokémon has data for?"
//     -> `latestVersionGroup` (pure chronology; also what text selection uses
//        to pick the freshest text, see localizedText.ts).
//  2. "Which one should a page OPEN on?" -> `defaultVersionGroup`: the most
//     recent group flagged `defaultEligible`, i.e. a main-series game a player
//     would call "the current game". Spin-offs (Colosseum, XD, Champions) and
//     DLC (which share their base game's learnsets) can be listed, selected and
//     shown, but never displace the latest main game as the initial context.
//     If a Pokémon has no eligible group at all, the most recent available
//     one is used, so something is always selected.
//
// They differ on purpose: "latest available" is a fact about the data;
// "default context" is a product policy. A future Game Context can reuse
// `VERSION_GROUPS` (and `defaultEligible`) as its list of playable contexts.
//
// Ordering decisions for groups whose position is not obvious (also in
// docs/DATA_SOURCES.md):
//  - `red-green-japan` / `blue-japan`: the original Japanese releases, older
//    than red-blue.
//  - `colosseum` / `xd`: GameCube spin-offs, after firered-leafgreen and
//    before diamond-pearl.
//  - `the-isle-of-armor` / `the-crown-tundra`: sword-shield DLC (2020), before
//    brilliant-diamond-shining-pearl (2021).
//  - `mega-dimension`: Z-A DLC, after legends-za.
//  - `champions`: Pokémon Champions (2026), the newest group PokeAPI lists.
//    A battle game: selectable and shown, never a default.

export interface VersionGroupMeta {
  name: string;
  es: string;
  en: string;
  /** May be the initial context of a page (main-series game; not a spin-off or DLC). */
  defaultEligible: boolean;
}

/** Oldest -> newest. The single source of truth for order, labels and eligibility. */
export const VERSION_GROUPS: readonly VersionGroupMeta[] = [
  { name: 'red-green-japan', es: 'Rojo / Verde (Japón)', en: 'Red / Green (Japan)', defaultEligible: true },
  { name: 'blue-japan', es: 'Azul (Japón)', en: 'Blue (Japan)', defaultEligible: true },
  { name: 'red-blue', es: 'Rojo / Azul', en: 'Red / Blue', defaultEligible: true },
  { name: 'yellow', es: 'Amarillo', en: 'Yellow', defaultEligible: true },
  { name: 'gold-silver', es: 'Oro / Plata', en: 'Gold / Silver', defaultEligible: true },
  { name: 'crystal', es: 'Cristal', en: 'Crystal', defaultEligible: true },
  { name: 'ruby-sapphire', es: 'Rubí / Zafiro', en: 'Ruby / Sapphire', defaultEligible: true },
  { name: 'emerald', es: 'Esmeralda', en: 'Emerald', defaultEligible: true },
  { name: 'firered-leafgreen', es: 'Rojo Fuego / Verde Hoja', en: 'FireRed / LeafGreen', defaultEligible: true },
  { name: 'colosseum', es: 'Colosseum', en: 'Colosseum', defaultEligible: false },
  { name: 'xd', es: 'XD', en: 'XD', defaultEligible: false },
  { name: 'diamond-pearl', es: 'Diamante / Perla', en: 'Diamond / Pearl', defaultEligible: true },
  { name: 'platinum', es: 'Platino', en: 'Platinum', defaultEligible: true },
  { name: 'heartgold-soulsilver', es: 'HeartGold / SoulSilver', en: 'HeartGold / SoulSilver', defaultEligible: true },
  { name: 'black-white', es: 'Negro / Blanco', en: 'Black / White', defaultEligible: true },
  { name: 'black-2-white-2', es: 'Negro 2 / Blanco 2', en: 'Black 2 / White 2', defaultEligible: true },
  { name: 'x-y', es: 'X / Y', en: 'X / Y', defaultEligible: true },
  { name: 'omega-ruby-alpha-sapphire', es: 'Rubí Omega / Zafiro Alfa', en: 'Omega Ruby / Alpha Sapphire', defaultEligible: true },
  { name: 'sun-moon', es: 'Sol / Luna', en: 'Sun / Moon', defaultEligible: true },
  { name: 'ultra-sun-ultra-moon', es: 'Ultra Sol / Ultra Luna', en: 'Ultra Sun / Ultra Moon', defaultEligible: true },
  { name: 'lets-go-pikachu-lets-go-eevee', es: "Let's Go Pikachu / Eevee", en: "Let's Go Pikachu / Eevee", defaultEligible: true },
  { name: 'sword-shield', es: 'Espada / Escudo', en: 'Sword / Shield', defaultEligible: true },
  { name: 'the-isle-of-armor', es: 'La Isla de la Armadura', en: 'The Isle of Armor', defaultEligible: false },
  { name: 'the-crown-tundra', es: 'Las Nieves de la Corona', en: 'The Crown Tundra', defaultEligible: false },
  { name: 'brilliant-diamond-shining-pearl', es: 'Diamante Brillante / Perla Reluciente', en: 'Brilliant Diamond / Shining Pearl', defaultEligible: true },
  { name: 'legends-arceus', es: 'Leyendas Pokémon: Arceus', en: 'Legends: Arceus', defaultEligible: true },
  { name: 'scarlet-violet', es: 'Escarlata / Púrpura', en: 'Scarlet / Violet', defaultEligible: true },
  { name: 'the-teal-mask', es: 'La Máscara Turquesa', en: 'The Teal Mask', defaultEligible: false },
  { name: 'the-indigo-disk', es: 'El Disco Índigo', en: 'The Indigo Disk', defaultEligible: false },
  { name: 'legends-za', es: 'Leyendas Pokémon: Z-A', en: 'Legends: Z-A', defaultEligible: true },
  { name: 'mega-dimension', es: 'Mega Dimensión', en: 'Mega Dimension', defaultEligible: false },
  { name: 'champions', es: 'Pokémon Champions', en: 'Pokémon Champions', defaultEligible: false },
];

export const VERSION_GROUP_ORDER: readonly string[] = VERSION_GROUPS.map((g) => g.name);

const META_BY_NAME: Record<string, VersionGroupMeta> = Object.fromEntries(VERSION_GROUPS.map((g) => [g.name, g]));

const RANK_BY_NAME: Record<string, number> = Object.fromEntries(
  VERSION_GROUP_ORDER.map((name, i) => [name, i])
);

/** Whether a group may be the initial context. Unknown groups may not. */
export function isDefaultEligible(versionGroup: string): boolean {
  return META_BY_NAME[versionGroup]?.defaultEligible ?? false;
}

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

/**
 * The version group a page should open on: the most recent among `names` that
 * is `defaultEligible`; when there is none, the most recent available (see the
 * header). '' when there are no groups.
 */
export function defaultVersionGroup(names: Iterable<string>): string {
  const sorted = sortVersionGroups(names);
  for (let i = sorted.length - 1; i >= 0; i--) if (isDefaultEligible(sorted[i])) return sorted[i];
  return sorted[sorted.length - 1] ?? '';
}

/** Display name of a version group in `lang` (es | en); prettified slug when unknown. */
export function versionGroupLabel(name: string, lang: string): string {
  const meta = META_BY_NAME[name];
  if (!meta) return name.replace(/-/g, ' ');
  return lang === 'en' ? meta.en : meta.es;
}
