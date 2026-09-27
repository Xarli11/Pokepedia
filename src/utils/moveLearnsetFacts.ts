// src/utils/moveLearnsetFacts.ts
//
// Domain layer between services/moveLearnsets.ts (raw decoded relations)
// and the move page: which Pokémon learn a move within a Game Context, and
// how. Game Context itself is NOT reimplemented here — `availableContextsForPokemon`
// / `defaultGameContextForPokemon` (services/gameContext.ts) already operate
// on any `Iterable<string>` of version groups regardless of where they came
// from (a Pokémon's moves, or here, a move's relations), so they're reused
// as-is; no new "game context for a move" concept was needed.

import type { LearnsetRelation } from '../services/moveLearnsets';
import { availableContextsForPokemon, defaultGameContextForPokemon, type ContextAvailability, type DefaultGameContext } from '../services/gameContext';

export interface PokemonMethodDetail {
  method: string;
  /** >0 only for 'level-up'; 0 for every other method (see moveLearnsets.ts). */
  level: number;
}

export interface PokemonLearnsetEntry {
  pokemonId: number;
  /** Distinct (method, level) pairs this Pokémon learns the move by, within the resolved scope — never one row per raw version-group relation. */
  methods: PokemonMethodDetail[];
}

/** Every Game Context this move has any relation in — same list shape MovesTable already uses. */
export function availableGameContextsForMove(relations: readonly LearnsetRelation[]): ContextAvailability[] {
  return availableContextsForPokemon(relations.map((r) => r.versionGroup));
}

/** The context this move page should open on: reuses MovesTable's exact policy (most recent main-series context; spin-offs/battle never displace it). */
export function defaultGameContextForMove(relations: readonly LearnsetRelation[]): DefaultGameContext {
  return defaultGameContextForPokemon(relations.map((r) => r.versionGroup));
}

/**
 * One entry per Pokémon that learns the move in ANY revision of `revisions`
 * (a Game Context's whole revision span — Sword/Shield base game AND Isle
 * of Armor AND Crown Tundra, not just the newest), with every distinct
 * (method, level) combination it uses across those revisions. Never drops
 * an older revision's data just because a newer one is also present, and
 * never lists the same Pokémon twice for having multiple raw
 * `version_group_details` entries.
 */
export function relationsForContext(relations: readonly LearnsetRelation[], revisions: readonly string[]): PokemonLearnsetEntry[] {
  const revisionSet = new Set(revisions);
  const byPokemon = new Map<number, Map<string, PokemonMethodDetail>>();
  for (const r of relations) {
    if (!revisionSet.has(r.versionGroup)) continue;
    let methods = byPokemon.get(r.pokemonId);
    if (!methods) { methods = new Map(); byPokemon.set(r.pokemonId, methods); }
    const key = `${r.method}:${r.level}`;
    if (!methods.has(key)) methods.set(key, { method: r.method, level: r.level });
  }
  return [...byPokemon.entries()]
    .map(([pokemonId, methods]) => ({
      pokemonId,
      methods: [...methods.values()].sort((a, b) => (a.method === 'level-up' ? -1 : 1) - (b.method === 'level-up' ? -1 : 1) || a.level - b.level),
    }))
    .sort((a, b) => a.pokemonId - b.pokemonId);
}

/** Entries that have at least one relation using `method` ('all' = no filter). */
export function filterByMethod(entries: readonly PokemonLearnsetEntry[], method: string): PokemonLearnsetEntry[] {
  if (method === 'all') return [...entries];
  return entries.filter((e) => e.methods.some((m) => m.method === method));
}

/** Every method actually used within these entries, for building a filter control that never offers an empty option. */
export function methodsPresent(entries: readonly PokemonLearnsetEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) for (const m of e.methods) set.add(m.method);
  return [...set];
}
