// src/utils/typeMatchups.ts
//
// Static type-effectiveness matrix and the matchups derived from it.
//
// CHART VERSION: the MODERN chart, in force since Generation VI (Fairy exists;
// Steel no longer resists Ghost or Dark). It is the one every current game
// uses. Older charts (Gen I, Gens II-V) are deliberately not modelled.
//
// SCOPE: pure typing. The result is what a Pokémon's types alone imply — it
// says nothing about abilities (Levitate, Flash Fire, Thick Fat…), held items,
// moves that change a type, Terastallization or weather. Callers must present
// it as such (see TypeMatchups.astro); the specialised, interactive analysis
// lives in PokeTypes (docs/DATA_SOURCES.md).
//
// No network, no I/O: a constant 18x18 table. The matrix is written
// attacker-first (what each type hits super-effectively / not very
// effectively / not at all) — the way the games document it — and the tests
// check all 324 attacker x defender cells against an independent fixture.

export const TYPE_CHART_GENERATION = 6;

/** Canonical order of the 18 types (the order the rest of the site lists them in). */
export const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

export type TypeName = (typeof TYPE_NAMES)[number];

/** Effectiveness of ONE attacking type against ONE defending type. */
export type ElementalMultiplier = 0 | 0.5 | 1 | 2;

/** Effectiveness against a whole typing (one or two types). */
export type Multiplier = 0 | 0.25 | 0.5 | 1 | 2 | 4;

interface AttackingRow {
  superEffective: readonly TypeName[];
  notVeryEffective: readonly TypeName[];
  noEffect: readonly TypeName[];
}

const NONE: readonly TypeName[] = [];

const ATTACKING: Record<TypeName, AttackingRow> = {
  normal:   { superEffective: NONE, notVeryEffective: ['rock', 'steel'], noEffect: ['ghost'] },
  fire:     { superEffective: ['grass', 'ice', 'bug', 'steel'], notVeryEffective: ['fire', 'water', 'rock', 'dragon'], noEffect: NONE },
  water:    { superEffective: ['fire', 'ground', 'rock'], notVeryEffective: ['water', 'grass', 'dragon'], noEffect: NONE },
  electric: { superEffective: ['water', 'flying'], notVeryEffective: ['electric', 'grass', 'dragon'], noEffect: ['ground'] },
  grass:    { superEffective: ['water', 'ground', 'rock'], notVeryEffective: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], noEffect: NONE },
  ice:      { superEffective: ['grass', 'ground', 'flying', 'dragon'], notVeryEffective: ['fire', 'water', 'ice', 'steel'], noEffect: NONE },
  fighting: { superEffective: ['normal', 'ice', 'rock', 'dark', 'steel'], notVeryEffective: ['poison', 'flying', 'psychic', 'bug', 'fairy'], noEffect: ['ghost'] },
  poison:   { superEffective: ['grass', 'fairy'], notVeryEffective: ['poison', 'ground', 'rock', 'ghost'], noEffect: ['steel'] },
  ground:   { superEffective: ['fire', 'electric', 'poison', 'rock', 'steel'], notVeryEffective: ['grass', 'bug'], noEffect: ['flying'] },
  flying:   { superEffective: ['grass', 'fighting', 'bug'], notVeryEffective: ['electric', 'rock', 'steel'], noEffect: NONE },
  psychic:  { superEffective: ['fighting', 'poison'], notVeryEffective: ['psychic', 'steel'], noEffect: ['dark'] },
  bug:      { superEffective: ['grass', 'psychic', 'dark'], notVeryEffective: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], noEffect: NONE },
  rock:     { superEffective: ['fire', 'ice', 'flying', 'bug'], notVeryEffective: ['fighting', 'ground', 'steel'], noEffect: NONE },
  ghost:    { superEffective: ['ghost', 'psychic'], notVeryEffective: ['dark'], noEffect: ['normal'] },
  dragon:   { superEffective: ['dragon'], notVeryEffective: ['steel'], noEffect: ['fairy'] },
  dark:     { superEffective: ['ghost', 'psychic'], notVeryEffective: ['fighting', 'dark', 'fairy'], noEffect: NONE },
  steel:    { superEffective: ['ice', 'rock', 'fairy'], notVeryEffective: ['fire', 'water', 'electric', 'steel'], noEffect: NONE },
  fairy:    { superEffective: ['fighting', 'dragon', 'dark'], notVeryEffective: ['fire', 'poison', 'steel'], noEffect: NONE },
};

/** attacker -> defender -> multiplier, built once from ATTACKING. */
const MATRIX: Record<TypeName, Record<TypeName, ElementalMultiplier>> = (() => {
  const out = {} as Record<TypeName, Record<TypeName, ElementalMultiplier>>;
  for (const attacker of TYPE_NAMES) {
    const row = {} as Record<TypeName, ElementalMultiplier>;
    for (const defender of TYPE_NAMES) row[defender] = 1;
    for (const d of ATTACKING[attacker].superEffective) row[d] = 2;
    for (const d of ATTACKING[attacker].notVeryEffective) row[d] = 0.5;
    for (const d of ATTACKING[attacker].noEffect) row[d] = 0;
    out[attacker] = row;
  }
  return out;
})();

export function isTypeName(value: string): value is TypeName {
  return (TYPE_NAMES as readonly string[]).includes(value);
}

/** One of the 324 elemental interactions: attacker type vs defender type. */
export function elementalMultiplier(attacker: TypeName, defender: TypeName): ElementalMultiplier {
  return MATRIX[attacker][defender];
}

/** Damage multiplier of an attacking type against a typing of one or two types. */
export function damageMultiplier(attacker: TypeName, defenders: readonly TypeName[]): Multiplier {
  return defenders.reduce<number>((acc, d) => acc * MATRIX[attacker][d], 1) as Multiplier;
}

export interface TypeMatchups {
  /** Attacking types that deal x4 / x2 / x0.5 / x0.25 / x0 (never x1), in canonical type order. */
  x4: TypeName[];
  x2: TypeName[];
  x05: TypeName[];
  x025: TypeName[];
  x0: TypeName[];
}

/** Rows the UI renders, strongest first. */
export const MATCHUP_LEVELS: readonly { key: keyof TypeMatchups; multiplier: Multiplier }[] = [
  { key: 'x4', multiplier: 4 },
  { key: 'x2', multiplier: 2 },
  { key: 'x05', multiplier: 0.5 },
  { key: 'x025', multiplier: 0.25 },
  { key: 'x0', multiplier: 0 },
];

/** Display form of a multiplier ("×2", "×½", "×¼", "×0"). */
export function formatMultiplier(multiplier: Multiplier): string {
  switch (multiplier) {
    case 0.5: return '×½';
    case 0.25: return '×¼';
    default: return `×${multiplier}`;
  }
}

/**
 * Matchups for a typing, or null when there is nothing trustworthy to show:
 * no types, more than two, a repeated type, or a type outside the 18 (the
 * block is then simply not rendered — never a guess).
 */
export function matchupsFor(types: readonly string[]): TypeMatchups | null {
  if (types.length < 1 || types.length > 2) return null;
  if (!types.every(isTypeName)) return null;
  if (new Set(types).size !== types.length) return null;
  const defenders = types as readonly TypeName[];

  const result: TypeMatchups = { x4: [], x2: [], x05: [], x025: [], x0: [] };
  for (const attacker of TYPE_NAMES) {
    switch (damageMultiplier(attacker, defenders)) {
      case 4: result.x4.push(attacker); break;
      case 2: result.x2.push(attacker); break;
      case 0.5: result.x05.push(attacker); break;
      case 0.25: result.x025.push(attacker); break;
      case 0: result.x0.push(attacker); break;
      default: break; // x1: neutral, not listed
    }
  }
  return result;
}
