// src/services/pokedexes.ts
//
// PokeAPI regional Pokédex metadata, same pattern as versionGroups.ts: one
// hand-verified table (checked live against PokeAPI 2026-09-27, all 35
// `pokedex` resources — not guessed from slugs), not a runtime fetch, so a
// species' `pokedex_numbers` can be labelled without a request per entry.
//
// PokeAPI's own `is_main_series` flag is what actually separates real
// regional/national Pokédexes from internal ones: `conquest-gallery`
// (Pokémon Conquest's gallery order, a spin-off) and `champions` (the
// Pokémon Champions battle dex, see gameContext.ts) both come back
// `is_main_series: false` — no name-pattern guessing was needed or used.
//
// A species can legitimately be listed in both an "original" and an
// "updated" version of the same region's dex (e.g. Chikorita is in both
// `original-johto`, Gold/Silver/Crystal's dex, and `updated-johto`,
// HeartGold/SoulSilver's, which added Kanto Pokémon to it) — these are two
// different real games' dexes, not duplicates, so both are shown.

export interface PokedexMeta {
  name: string;
  es: string;
  en: string;
  /** Real regional/national dex vs. an internal one (Conquest, Champions). */
  mainSeries: boolean;
}

/** National first, then roughly geographic/chronological. Stable display order. */
export const POKEDEXES: readonly PokedexMeta[] = [
  { name: 'national', es: 'Nacional', en: 'National', mainSeries: true },
  { name: 'kanto', es: 'Kanto', en: 'Kanto', mainSeries: true },
  { name: 'letsgo-kanto', es: 'Let’s Go Kanto', en: 'Let’s Go Kanto', mainSeries: true },
  { name: 'original-johto', es: 'Johto Original', en: 'Original Johto', mainSeries: true },
  { name: 'updated-johto', es: 'Johto Actualizado', en: 'Updated Johto', mainSeries: true },
  { name: 'original-sinnoh', es: 'Sinnoh Original', en: 'Original Sinnoh', mainSeries: true },
  { name: 'extended-sinnoh', es: 'Sinnoh Extendido', en: 'Extended Sinnoh', mainSeries: true },
  { name: 'hoenn', es: 'Hoenn Original', en: 'Original Hoenn', mainSeries: true },
  { name: 'updated-hoenn', es: 'Hoenn Actualizado', en: 'New Hoenn', mainSeries: true },
  { name: 'original-unova', es: 'Teselia Original', en: 'Original Unova', mainSeries: true },
  { name: 'updated-unova', es: 'Teselia Actualizado', en: 'Updated Unova', mainSeries: true },
  { name: 'kalos-central', es: 'Kalos Centro', en: 'Central Kalos', mainSeries: true },
  { name: 'kalos-coastal', es: 'Kalos Costa', en: 'Coastal Kalos', mainSeries: true },
  { name: 'kalos-mountain', es: 'Kalos Montaña', en: 'Mountain Kalos', mainSeries: true },
  { name: 'lumiose-city', es: 'Ciudad Luminalia', en: 'Lumiose', mainSeries: true },
  { name: 'hyperspace', es: 'Luminalia Dimensional', en: 'Hyperspace', mainSeries: true },
  { name: 'original-alola', es: 'Alola Original', en: 'Original Alola', mainSeries: true },
  { name: 'original-melemele', es: 'Melemele Original', en: 'Original Melemele', mainSeries: true },
  { name: 'original-akala', es: 'Akala Original', en: 'Original Akala', mainSeries: true },
  { name: 'original-ulaula', es: "Ula-Ula Original", en: 'Original Ula’ula', mainSeries: true },
  { name: 'original-poni', es: 'Poni Original', en: 'Original Poni', mainSeries: true },
  { name: 'updated-alola', es: 'Alola Actualizado', en: 'Updated Alola', mainSeries: true },
  { name: 'updated-melemele', es: 'Melemele Actualizado', en: 'Updated Melemele', mainSeries: true },
  { name: 'updated-akala', es: 'Akala Actualizado', en: 'Updated Akala', mainSeries: true },
  { name: 'updated-ulaula', es: 'Ula-Ula Actualizado', en: 'Updated Ula’ula', mainSeries: true },
  { name: 'updated-poni', es: 'Poni Actualizado', en: 'Updated Poni', mainSeries: true },
  { name: 'galar', es: 'Galar', en: 'Galar', mainSeries: true },
  { name: 'isle-of-armor', es: 'Isla de la Armadura', en: 'Isle of Armor', mainSeries: true },
  { name: 'crown-tundra', es: 'Nieves de la Corona', en: 'Crown Tundra', mainSeries: true },
  { name: 'hisui', es: 'Hisui', en: 'Hisui', mainSeries: true },
  { name: 'paldea', es: 'Paldea', en: 'Paldea', mainSeries: true },
  { name: 'kitakami', es: 'Kitakami', en: 'Kitakami', mainSeries: true },
  { name: 'blueberry', es: 'Arándano', en: 'Blueberry', mainSeries: true },
  { name: 'conquest-gallery', es: 'Galería', en: 'Gallery', mainSeries: false },
  { name: 'champions', es: 'Champions', en: 'Champions', mainSeries: false },
];

const BY_NAME: Readonly<Record<string, PokedexMeta>> = Object.fromEntries(POKEDEXES.map((p) => [p.name, p]));
const RANK: Readonly<Record<string, number>> = Object.fromEntries(POKEDEXES.map((p, i) => [p.name, i]));

/** Display order rank; unknown pokedexes sort last (never dropped silently). */
export function pokedexRank(name: string): number {
  return RANK[name] ?? POKEDEXES.length;
}

/** Whether a pokedex is a real regional/national dex (not Conquest/Champions). */
export function isMainSeriesPokedex(name: string): boolean {
  return BY_NAME[name]?.mainSeries ?? false;
}

/** ES/EN label; the formatted slug for an unrecognized pokedex. */
export function pokedexLabel(name: string, lang: string): string {
  const meta = BY_NAME[name];
  if (!meta) return name.replace(/-/g, ' ');
  return lang === 'en' ? meta.en : meta.es;
}
