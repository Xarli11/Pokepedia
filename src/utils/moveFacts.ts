// src/utils/moveFacts.ts
//
// Mechanical facts for /movimientos/{slug}/ pages, normalized from PokeAPI's
// `move` resource: target, ailment/stat-change effects, hit/turn counts,
// drain/healing/crit/flinch chances, and historical (`past_values`) changes.
// Separate from moveMeta.ts (title/description builders, unchanged) to keep
// each file's single responsibility; `MoveMechanics` here is deliberately a
// different type name than moveMeta.ts's narrower `MoveFacts`.
//
// Scope note (investigated, not built): PokeAPI's `move.meta` does not
// expose modern mechanical flags (makes contact, blocked by Protect, hit by
// Mirror Move, sound-based, punch/bite/powder/pulse/bullet/dance/slicing/
// wind move, ...) at all — verified against a real move (Earthquake's
// `meta` has no such field). Pokémon Showdown's movedex does have a `flags`
// object for these, but integrating it is a new data source (its own
// generation/caching/localization work) this phase does not build. See
// docs/architecture/move-ability-entities.md for the tracked debt.

export interface StatChange {
  /** Raw PokeAPI stat name (e.g. 'attack', 'speed'). */
  stat: string;
  /** Stages, signed (-2, -1, +1, +2, ...). */
  change: number;
}

export interface MoveMechanics {
  target: string;
  /** null when PokeAPI's ailment is 'none' or 'unknown' (nothing to report). */
  ailment: string | null;
  ailmentChance: number | null;
  /** % of damage dealt restored to the user (Giga Drain-style). Positive only. */
  drain: number | null;
  /** % of damage dealt taken by the user as recoil (Double-Edge-style). Positive only. */
  recoil: number | null;
  healing: number | null;
  critRate: number | null;
  flinchChance: number | null;
  minHits: number | null;
  maxHits: number | null;
  minTurns: number | null;
  maxTurns: number | null;
  statChanges: StatChange[];
  statChance: number | null;
}

interface RawMeta {
  ailment?: { name: string } | null;
  ailment_chance?: number | null;
  drain?: number | null;
  healing?: number | null;
  crit_rate?: number | null;
  flinch_chance?: number | null;
  min_hits?: number | null;
  max_hits?: number | null;
  min_turns?: number | null;
  max_turns?: number | null;
  stat_chance?: number | null;
}

interface RawStatChange {
  change: number;
  stat: { name: string };
}

/** Zero/none/unknown are "nothing to report", not a fact — never rendered as 0%/0 hits. */
function positiveOrNull(n: number | null | undefined): number | null {
  return typeof n === 'number' && n > 0 ? n : null;
}

export function buildMoveMechanics(
  target: { name: string },
  meta: RawMeta | null | undefined,
  statChangesRaw: readonly RawStatChange[] | undefined
): MoveMechanics {
  const ailmentName = meta?.ailment?.name;
  const ailment = ailmentName && ailmentName !== 'none' && ailmentName !== 'unknown' ? ailmentName : null;
  const statChanges = (statChangesRaw ?? []).map((s) => ({ stat: s.stat.name, change: s.change }));
  return {
    target: target?.name ?? '',
    ailment,
    ailmentChance: ailment ? positiveOrNull(meta?.ailment_chance) : null,
    // PokeAPI's single `drain` field is signed: positive = drain (Giga
    // Drain), negative = recoil (Double-Edge) — split into two honest,
    // always-non-negative facts instead of one field whose sign a reader
    // would have to already know the convention for.
    drain: positiveOrNull(meta?.drain),
    recoil: meta?.drain != null && meta.drain < 0 ? -meta.drain : null,
    healing: positiveOrNull(meta?.healing),
    critRate: positiveOrNull(meta?.crit_rate),
    flinchChance: positiveOrNull(meta?.flinch_chance),
    minHits: meta?.min_hits ?? null,
    maxHits: meta?.max_hits ?? null,
    minTurns: meta?.min_turns ?? null,
    maxTurns: meta?.max_turns ?? null,
    statChanges,
    statChance: statChanges.length > 0 ? positiveOrNull(meta?.stat_chance) : null,
  };
}

// PokeAPI has no ES names for move targets (verified live, every language
// entry is English-only, one target has no name at all) — hand-translated,
// same pattern as versionGroups.ts's ES/EN table.
const TARGET_ES: Readonly<Record<string, string>> = {
  'specific-move': 'Movimiento específico',
  'selected-pokemon-me-first': 'Pokémon seleccionado',
  ally: 'Aliado',
  'users-field': 'Campo del usuario',
  'user-or-ally': 'Usuario o aliado',
  'opponents-field': 'Campo rival',
  user: 'Usuario',
  'random-opponent': 'Rival al azar',
  'all-other-pokemon': 'Todos los demás Pokémon',
  'selected-pokemon': 'Pokémon seleccionado',
  'all-opponents': 'Todos los rivales',
  'entire-field': 'Todo el campo',
  'user-and-allies': 'Usuario y aliados',
  'all-pokemon': 'Todos los Pokémon',
  'all-allies': 'Todos los aliados',
  'fainting-pokemon': 'Pokémon debilitado',
};

const TARGET_EN: Readonly<Record<string, string>> = {
  'specific-move': 'Specific move',
  'selected-pokemon-me-first': 'Selected Pokémon',
  ally: 'Ally',
  'users-field': "User's field",
  'user-or-ally': 'User or ally',
  'opponents-field': "Opponent's field",
  user: 'User',
  'random-opponent': 'Random opponent',
  'all-other-pokemon': 'All other Pokémon',
  'selected-pokemon': 'Selected Pokémon',
  'all-opponents': 'All opponents',
  'entire-field': 'Entire field',
  'user-and-allies': 'User and allies',
  'all-pokemon': 'All Pokémon',
  'all-allies': 'All allies',
  'fainting-pokemon': 'Fainting Pokémon',
};

export function targetLabel(target: string, lang: string): string {
  const table = lang === 'en' ? TARGET_EN : TARGET_ES;
  return table[target] ?? target.replace(/-/g, ' ');
}

// PokeAPI DOES have real names for move-ailment, but only for the ones that
// actually appear as a move's ailment in practice; hand-verified against the
// full 20-entry list (2026-09-27) since some (e.g. 'unknown') have none.
const AILMENT_ES: Readonly<Record<string, string>> = {
  paralysis: 'Parálisis', sleep: 'Sueño', freeze: 'Congelación', burn: 'Quemadura',
  poison: 'Veneno', confusion: 'Confusión', infatuation: 'Enamoramiento', trap: 'Atrapado',
  nightmare: 'Pesadilla', torment: 'Tormento', disable: 'Anulación', yawn: 'Somnolencia',
  'heal-block': 'Anticura', 'no-type-immunity': 'Sin inmunidad de tipo', 'leech-seed': 'Drenadoras',
  embargo: 'Embargo', 'perish-song': 'Canto Mortal', ingrain: 'Arraigo',
};

const AILMENT_EN: Readonly<Record<string, string>> = {
  paralysis: 'Paralysis', sleep: 'Sleep', freeze: 'Freeze', burn: 'Burn',
  poison: 'Poison', confusion: 'Confusion', infatuation: 'Infatuation', trap: 'Trap',
  nightmare: 'Nightmare', torment: 'Torment', disable: 'Disable', yawn: 'Yawn',
  'heal-block': 'Heal Block', 'no-type-immunity': 'No type immunity', 'leech-seed': 'Leech Seed',
  embargo: 'Embargo', 'perish-song': 'Perish Song', ingrain: 'Ingrain',
};

export function ailmentLabel(ailment: string, lang: string): string {
  const table = lang === 'en' ? AILMENT_EN : AILMENT_ES;
  return table[ailment] ?? ailment.replace(/-/g, ' ');
}

export interface MovePastValue {
  versionGroup: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  effectChance: number | null;
  type: string | null;
}

interface RawPastValue {
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  effect_chance: number | null;
  type: { name: string } | null;
  version_group: { name: string };
}

/**
 * Historical values PokeAPI records for a move, in the shape it documents
 * them: a `past_values` entry's fields are the value that held THROUGH its
 * `version_group` (i.e. "in `versionGroup` and earlier, this was..."), a
 * field left `null` meaning that field had already reached its current
 * value by then — never invented, never re-interpreted.
 */
export function movePastValues(raw: readonly RawPastValue[] | undefined): MovePastValue[] {
  return (raw ?? []).map((v) => ({
    versionGroup: v.version_group.name,
    power: v.power,
    accuracy: v.accuracy,
    pp: v.pp,
    effectChance: v.effect_chance,
    type: v.type?.name ?? null,
  }));
}
