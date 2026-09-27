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
//
// Fase 2E adds `versionGroups`/`global`, verified live 2026-09-28 against
// every `/pokedex/{name}` (not derived from `mainSeries` or guessed): which
// PokeAPI version groups a dex's numbers actually apply to, for
// `regionalDexEntriesForContext` (pokemonFacts.ts) to filter a Pokémon
// page's regional Pokédex section by the page's Game Context. PokeAPI
// returns `version_groups: []` for exactly two of the 35 dexes —
// `national` and `conquest-gallery` — and an empty array is NEVER read as
// "shows in every context" by default; each of those two is a distinct,
// explicit decision (see their entries below), not a fallback rule. Every
// other dex — all 33 of them — came back with at least one real version
// group; there is currently no "known main-series dex with genuinely no
// version-group data" case left undecided.

export interface PokedexMeta {
  name: string;
  es: string;
  en: string;
  /** Real regional/national dex vs. an internal one (Conquest, Champions). */
  mainSeries: boolean;
  /**
   * PokeAPI version groups this dex's entry numbers apply to (verified
   * live against `/pokedex/{name}`, 2026-09-28) — intersected against a
   * Game Context's revisions by `regionalDexEntriesForContext` to decide
   * whether to show this dex's number for that context. Empty only for
   * the two dexes PokeAPI itself returns no version group for; whether
   * that means "global" is `global`'s call, never inferred from this
   * array being empty.
   */
  versionGroups: readonly string[];
  /**
   * True only where PokeAPI's own empty `version_groups` legitimately
   * means "applies to every game", by the dex's own definition — verified
   * per entry, never assumed from an empty array. Currently `national`
   * only: it is the cross-game index by design, which is exactly why
   * PokeAPI has no per-game breakdown for it. `conquest-gallery` also
   * comes back empty but is NOT global (see its entry) — it is excluded
   * before context-filtering ever runs (`isMainSeriesPokedex`), so this
   * flag is simply false for it rather than an unverified guess.
   */
  global: boolean;
}

/** National first, then roughly geographic/chronological. Stable display order. */
export const POKEDEXES: readonly PokedexMeta[] = [
  { name: 'national', es: 'Nacional', en: 'National', mainSeries: true, versionGroups: [], global: true },
  { name: 'kanto', es: 'Kanto', en: 'Kanto', mainSeries: true, versionGroups: ['red-blue', 'yellow', 'firered-leafgreen', 'red-green-japan', 'blue-japan'], global: false },
  { name: 'letsgo-kanto', es: 'Let’s Go Kanto', en: 'Let’s Go Kanto', mainSeries: true, versionGroups: ['lets-go-pikachu-lets-go-eevee'], global: false },
  { name: 'original-johto', es: 'Johto Original', en: 'Original Johto', mainSeries: true, versionGroups: ['gold-silver', 'crystal'], global: false },
  { name: 'updated-johto', es: 'Johto Actualizado', en: 'Updated Johto', mainSeries: true, versionGroups: ['heartgold-soulsilver'], global: false },
  { name: 'original-sinnoh', es: 'Sinnoh Original', en: 'Original Sinnoh', mainSeries: true, versionGroups: ['diamond-pearl', 'brilliant-diamond-shining-pearl'], global: false },
  { name: 'extended-sinnoh', es: 'Sinnoh Extendido', en: 'Extended Sinnoh', mainSeries: true, versionGroups: ['platinum'], global: false },
  { name: 'hoenn', es: 'Hoenn Original', en: 'Original Hoenn', mainSeries: true, versionGroups: ['ruby-sapphire', 'emerald'], global: false },
  { name: 'updated-hoenn', es: 'Hoenn Actualizado', en: 'New Hoenn', mainSeries: true, versionGroups: ['omega-ruby-alpha-sapphire'], global: false },
  { name: 'original-unova', es: 'Teselia Original', en: 'Original Unova', mainSeries: true, versionGroups: ['black-white'], global: false },
  { name: 'updated-unova', es: 'Teselia Actualizado', en: 'Updated Unova', mainSeries: true, versionGroups: ['black-2-white-2'], global: false },
  { name: 'kalos-central', es: 'Kalos Centro', en: 'Central Kalos', mainSeries: true, versionGroups: ['x-y'], global: false },
  { name: 'kalos-coastal', es: 'Kalos Costa', en: 'Coastal Kalos', mainSeries: true, versionGroups: ['x-y'], global: false },
  { name: 'kalos-mountain', es: 'Kalos Montaña', en: 'Mountain Kalos', mainSeries: true, versionGroups: ['x-y'], global: false },
  { name: 'lumiose-city', es: 'Ciudad Luminalia', en: 'Lumiose', mainSeries: true, versionGroups: ['legends-za'], global: false },
  { name: 'hyperspace', es: 'Luminalia Dimensional', en: 'Hyperspace', mainSeries: true, versionGroups: ['legends-za', 'mega-dimension'], global: false },
  { name: 'original-alola', es: 'Alola Original', en: 'Original Alola', mainSeries: true, versionGroups: ['sun-moon'], global: false },
  { name: 'original-melemele', es: 'Melemele Original', en: 'Original Melemele', mainSeries: true, versionGroups: ['sun-moon'], global: false },
  { name: 'original-akala', es: 'Akala Original', en: 'Original Akala', mainSeries: true, versionGroups: ['sun-moon'], global: false },
  { name: 'original-ulaula', es: "Ula-Ula Original", en: 'Original Ula’ula', mainSeries: true, versionGroups: ['sun-moon'], global: false },
  { name: 'original-poni', es: 'Poni Original', en: 'Original Poni', mainSeries: true, versionGroups: ['sun-moon'], global: false },
  { name: 'updated-alola', es: 'Alola Actualizado', en: 'Updated Alola', mainSeries: true, versionGroups: ['ultra-sun-ultra-moon'], global: false },
  { name: 'updated-melemele', es: 'Melemele Actualizado', en: 'Updated Melemele', mainSeries: true, versionGroups: ['ultra-sun-ultra-moon'], global: false },
  { name: 'updated-akala', es: 'Akala Actualizado', en: 'Updated Akala', mainSeries: true, versionGroups: ['ultra-sun-ultra-moon'], global: false },
  { name: 'updated-ulaula', es: 'Ula-Ula Actualizado', en: 'Updated Ula’ula', mainSeries: true, versionGroups: ['ultra-sun-ultra-moon'], global: false },
  { name: 'updated-poni', es: 'Poni Actualizado', en: 'Updated Poni', mainSeries: true, versionGroups: ['ultra-sun-ultra-moon'], global: false },
  { name: 'galar', es: 'Galar', en: 'Galar', mainSeries: true, versionGroups: ['sword-shield'], global: false },
  { name: 'isle-of-armor', es: 'Isla de la Armadura', en: 'Isle of Armor', mainSeries: true, versionGroups: ['sword-shield', 'the-isle-of-armor'], global: false },
  { name: 'crown-tundra', es: 'Nieves de la Corona', en: 'Crown Tundra', mainSeries: true, versionGroups: ['sword-shield', 'the-crown-tundra'], global: false },
  { name: 'hisui', es: 'Hisui', en: 'Hisui', mainSeries: true, versionGroups: ['legends-arceus'], global: false },
  { name: 'paldea', es: 'Paldea', en: 'Paldea', mainSeries: true, versionGroups: ['scarlet-violet'], global: false },
  { name: 'kitakami', es: 'Kitakami', en: 'Kitakami', mainSeries: true, versionGroups: ['scarlet-violet', 'the-teal-mask'], global: false },
  { name: 'blueberry', es: 'Arándano', en: 'Blueberry', mainSeries: true, versionGroups: ['scarlet-violet', 'the-indigo-disk'], global: false },
  // Non-main-series (excluded by isMainSeriesPokedex before context-filtering
  // ever runs — regionalDexEntries() never lets either of these reach
  // regionalDexEntriesForContext). PokeAPI returns version_groups: [] for
  // conquest-gallery too, but it is deliberately NOT marked global: unlike
  // national, there is no "applies everywhere" semantics to justify one —
  // it simply isn't part of this feature's real dataset, and this table
  // must never assert something about it that hasn't been verified.
  { name: 'conquest-gallery', es: 'Galería', en: 'Gallery', mainSeries: false, versionGroups: [], global: false },
  { name: 'champions', es: 'Champions', en: 'Champions', mainSeries: false, versionGroups: ['champions'], global: false },
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

/**
 * The version groups a dex's numbers apply to, or `undefined` for a name
 * this table doesn't recognize at all — distinct from a *known* dex with
 * an empty list (which, per the audit above, only ever means "not global
 * either", never "shows nowhere" for a real main-series dex today).
 * `regionalDexEntriesForContext` treats `undefined` as "never hide real
 * data for a gap in our table", the same fail-open policy `pokedexLabel`
 * already uses for an unrecognized name.
 */
export function pokedexVersionGroups(name: string): readonly string[] | undefined {
  return BY_NAME[name]?.versionGroups;
}

/** Whether a dex is explicitly game-independent (currently `national` only — see `global`'s doc above). */
export function isGlobalPokedex(name: string): boolean {
  return BY_NAME[name]?.global ?? false;
}
