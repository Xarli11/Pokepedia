// src/utils/pokemonFacts.ts
//
// Normalized, language-agnostic factual data for the Pokémon page's
// encyclopedic sections (training, breeding, classification, regional
// Pokédex numbers), built once from the `pokemon` + `pokemon-species`
// objects the page already has in hand — no extra PokeAPI request. Labels
// are resolved separately (growthRateLabel/eggGroupLabel/pokedexLabel) so
// this layer stays presentation-free; the Astro template only renders
// `buildPokemonFacts()`'s output.
//
// PokeAPI does not expose ES text for growth rates or egg groups (verified
// live 2026-09-27: every `growth-rate` resource's `descriptions` has no
// `es` entry; `egg-group` resources DO have real `names.es`, used as-is).
// GROWTH_RATE_ES below uses the games' own official Spanish terms
// (Lento/Medio/Rápido/Medio lento/Errático/Fluctuante), not a translation
// invented for this project.

import { isMainSeriesPokedex, pokedexRank, pokedexVersionGroups, isGlobalPokedex } from '../services/pokedexes';
import type { PokemonDetail, PokemonSpecies } from '../services/pokeapi';

export interface GenderInfo {
  /** No gender at all (Ditto, most Legendaries, genderless species). */
  genderless: boolean;
  /** 0-100, null when genderless. */
  malePercent: number | null;
  femalePercent: number | null;
}

/**
 * PokeAPI's `gender_rate` is eighths-that-are-female, not a direct
 * percentage: -1 means genderless; 0 means 0/8 female (100% male); 8 means
 * 8/8 female (100% female); 4 is the common 50/50 split. Verified against
 * PokeAPI's own documentation before assuming the semantics.
 */
export function genderInfo(genderRate: number | null | undefined): GenderInfo {
  if (typeof genderRate !== 'number' || genderRate < 0) return { genderless: true, malePercent: null, femalePercent: null };
  const femalePercent = (genderRate / 8) * 100;
  return { genderless: false, malePercent: 100 - femalePercent, femalePercent };
}

export interface EvYieldEntry {
  /** Raw PokeAPI stat name (e.g. 'special-attack'); label it at render time. */
  stat: string;
  amount: number;
}

/** Non-zero effort values only, in the Pokémon's own stat order. */
export function evYield(stats: readonly { effort: number; stat: { name: string } }[]): EvYieldEntry[] {
  return stats.filter((s) => s.effort > 0).map((s) => ({ stat: s.stat.name, amount: s.effort }));
}

const GROWTH_RATE_ES: Readonly<Record<string, string>> = {
  slow: 'Lento',
  medium: 'Medio',
  fast: 'Rápido',
  'medium-slow': 'Medio lento',
  'slow-then-very-fast': 'Errático',
  'fast-then-very-slow': 'Fluctuante',
};

const GROWTH_RATE_EN: Readonly<Record<string, string>> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
  'medium-slow': 'Medium Slow',
  'slow-then-very-fast': 'Erratic',
  'fast-then-very-slow': 'Fluctuating',
};

export function growthRateLabel(name: string, lang: string): string {
  const table = lang === 'en' ? GROWTH_RATE_EN : GROWTH_RATE_ES;
  return table[name] ?? name.replace(/-/g, ' ');
}

// PokeAPI does have real localized names for egg groups; this mirrors them
// (verified live) rather than re-fetching them per page.
const EGG_GROUP_ES: Readonly<Record<string, string>> = {
  monster: 'Monstruo', water1: 'Agua 1', bug: 'Bicho', flying: 'Volador',
  ground: 'Campo', fairy: 'Hada', plant: 'Planta', humanshape: 'Humanoide',
  water3: 'Agua 3', mineral: 'Mineral', indeterminate: 'Amorfo', water2: 'Agua 2',
  ditto: 'Ditto', dragon: 'Dragón', 'no-eggs': 'Desconocido',
};

const EGG_GROUP_EN: Readonly<Record<string, string>> = {
  monster: 'Monster', water1: 'Water 1', bug: 'Bug', flying: 'Flying',
  ground: 'Field', fairy: 'Fairy', plant: 'Grass', humanshape: 'Human-Like',
  water3: 'Water 3', mineral: 'Mineral', indeterminate: 'Amorphous', water2: 'Water 2',
  ditto: 'Ditto', dragon: 'Dragon', 'no-eggs': 'Undiscovered',
};

export function eggGroupLabel(name: string, lang: string): string {
  const table = lang === 'en' ? EGG_GROUP_EN : EGG_GROUP_ES;
  return table[name] ?? name.replace(/-/g, ' ');
}

export interface RegionalDexEntry {
  pokedex: string;
  entryNumber: number;
}

/**
 * Real regional/national Pokédex entries only (Conquest's gallery order and
 * the Champions battle dex are dropped via `isMainSeriesPokedex`), in a
 * stable display order (`pokedexRank`) — never PokeAPI's own array order,
 * which is not a documented contract.
 */
export function regionalDexEntries(
  pokedexNumbers: readonly { entry_number: number; pokedex: { name: string } }[]
): RegionalDexEntry[] {
  return pokedexNumbers
    .filter((p) => isMainSeriesPokedex(p.pokedex.name))
    .map((p) => ({ pokedex: p.pokedex.name, entryNumber: p.entry_number }))
    .sort((a, b) => pokedexRank(a.pokedex) - pokedexRank(b.pokedex));
}

export interface PokemonFacts {
  training: {
    baseExperience: number | null;
    captureRate: number;
    baseHappiness: number | null;
    growthRate: string;
    evYield: EvYieldEntry[];
  };
  breeding: {
    eggGroups: string[];
    gender: GenderInfo;
    hatchCounter: number | null;
  };
  classification: {
    isBaby: boolean;
    isLegendary: boolean;
    isMythical: boolean;
  };
  regionalDex: RegionalDexEntry[];
}

export function buildPokemonFacts(
  detail: Pick<PokemonDetail, 'stats' | 'base_experience'>,
  species: Pick<PokemonSpecies, 'capture_rate' | 'base_happiness' | 'hatch_counter' | 'gender_rate' | 'growth_rate' | 'egg_groups' | 'pokedex_numbers' | 'is_baby' | 'is_legendary' | 'is_mythical'>
): PokemonFacts {
  return {
    training: {
      baseExperience: detail.base_experience ?? null,
      captureRate: species.capture_rate,
      baseHappiness: species.base_happiness,
      growthRate: species.growth_rate?.name ?? '',
      evYield: evYield(detail.stats),
    },
    breeding: {
      eggGroups: (species.egg_groups ?? []).map((g) => g.name),
      gender: genderInfo(species.gender_rate),
      hatchCounter: species.hatch_counter,
    },
    classification: {
      isBaby: species.is_baby,
      isLegendary: species.is_legendary,
      isMythical: species.is_mythical,
    },
    regionalDex: regionalDexEntries(species.pokedex_numbers ?? []),
  };
}

/**
 * Fase 2E: `entries` restricted to the ones relevant to a Game Context's
 * `revisions` — reuses `pokedexes.ts`'s per-dex `versionGroups`/`global`
 * metadata, the same pure-filter shape `relationsForContext` (Fase 2D)
 * established for move learnsets. A dex shows for this context when:
 *
 *  - it is explicitly global (`isGlobalPokedex` — currently `national`
 *    only), or
 *  - its own `versionGroups` intersect `revisions`, or
 *  - this table has no entry for it at all (`pokedexVersionGroups`
 *    returns `undefined`) — never hide a real Pokédex number for a gap in
 *    our metadata table; same fail-open policy `pokedexLabel` already
 *    uses for an unrecognized name.
 *
 * Order is preserved from `entries` (already `pokedexRank`-sorted by
 * `regionalDexEntries`), so this never needs to re-sort.
 */
export function regionalDexEntriesForContext(entries: readonly RegionalDexEntry[], revisions: readonly string[]): RegionalDexEntry[] {
  const revisionSet = new Set(revisions);
  return entries.filter((e) => {
    if (isGlobalPokedex(e.pokedex)) return true;
    const versionGroups = pokedexVersionGroups(e.pokedex);
    if (!versionGroups) return true;
    return versionGroups.some((vg) => revisionSet.has(vg));
  });
}

/** Localized genus ("Mach Pokémon" / "Pokémon Mach"), falling back across languages. */
export function localizedGenus(genera: readonly { genus: string; language: { name: string } }[], lang: string): string {
  return genera.find((g) => g.language.name === lang)?.genus
    || genera.find((g) => g.language.name === 'en')?.genus
    || '';
}
