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

export const VERSION_GROUP_ORDER: readonly string[] = [
  'red-blue',
  'yellow',
  'gold-silver',
  'crystal',
  'ruby-sapphire',
  'emerald',
  'firered-leafgreen',
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
  'brilliant-diamond-shining-pearl',
  'legends-arceus',
  'scarlet-violet',
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
