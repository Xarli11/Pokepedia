// src/services/gameContext.ts
//
// Game Context: the base for letting Pokepedia understand that some data
// depends on "which game" the person is looking at. Built on top of
// `VERSION_GROUPS` (chronology + ES/EN labels + defaultEligible), not a
// replacement for it — this module answers a different question.
//
// THE PROBLEM
//
// PokeAPI's `version_group` is a data-revision granularity, not a "game" a
// player would name. Scarlet/Violet ships as three version groups
// (`scarlet-violet`, `the-teal-mask`, `the-indigo-disk`); Sword/Shield as
// three (`sword-shield`, `the-isle-of-armor`, `the-crown-tundra`); Legends:
// Z-A as two (`legends-za`, `mega-dimension`). Showing each of those as an
// independent, equally-weighted option in a game selector would make The
// Indigo Disk look like a different game from Scarlet/Violet to a user who
// has never heard the term "version group".
//
// THE MODEL
//
// A `GameContextDefinition` is a game family: one or more chronologically
// ordered `revisions` (PokeAPI version group names). `revisions[0]` is
// always the base release and doubles as the context's own `id` — the same
// string PokeAPI itself uses for that base version group. Every other
// version group is either its own single-revision context (the common
// case: Red/Blue, X/Y, Legends: Arceus...) or a DLC/data revision folded
// into a base game's `revisions` (documented per-entry below; this is a
// manually curated, evidence-based grouping, never inferred from names).
//
// `kind` classifies the context itself, not each revision:
//  - 'main-series': a game a player would call "the current game".
//  - 'spin-off': Colosseum, XD — not part of the numbered/lettered series.
//  - 'battle': Pokémon Champions — a battle-only game, not a game a
//    Pokémon is "caught in".
//
// `defaultEligible` says whether this *context* may be the initial
// selection on a page — it mirrors `defaultEligible` on the context's base
// version group in `VERSION_GROUPS`, since DLC revisions never carry the
// eligibility bit themselves (see versionGroups.ts).
//
// DEFAULT RESOLUTION POLICY
//
// 1. Among the contexts a Pokémon has any data for, prefer the most recent
//    `main-series` (defaultEligible) one — a spin-off or battle-only game
//    never displaces it, no matter how new.
// 2. Within that context, resolve to the most recent revision the Pokémon
//    actually has data for (e.g. Scarlet/Violet + Indigo Disk -> the
//    context shown is still "Scarlet / Violet", the revision used
//    internally is `the-indigo-disk`, since it represents that game's
//    final state and moves/data have not been observed to differ from the
//    base revision — see docs/architecture/game-context.md).
// 3. If the Pokémon has no main-series context at all, fall back to the
//    most recent context of any kind (a spin-off/battle Pokémon still
//    needs something selected).

import {
  VERSION_GROUP_ORDER,
  isDefaultEligible,
  versionGroupRank,
  versionGroupLabel,
  sortVersionGroups,
} from './versionGroups';

export type GameContextKind = 'main-series' | 'spin-off' | 'battle';

export interface GameContextDefinition {
  /** Same string as the base (oldest) version group in `revisions`. */
  id: string;
  kind: GameContextKind;
  /** Oldest -> newest. `revisions[0] === id`. */
  revisions: readonly string[];
  /** Whether this context may be the page's initial selection. */
  defaultEligible: boolean;
}

/**
 * Version groups that are a data revision (typically DLC) of another
 * context rather than a context of their own, mapped to their base
 * context's id. Manually curated from release history — PokeAPI does not
 * expose this relationship, so never derive it from name patterns.
 *
 *  - Sword/Shield: Isle of Armor, Crown Tundra (2020 DLC).
 *  - Scarlet/Violet: Teal Mask, Indigo Disk (2023 DLC).
 *  - Legends: Z-A: Mega Dimension (DLC).
 */
const REVISION_OF: Readonly<Record<string, string>> = {
  'the-isle-of-armor': 'sword-shield',
  'the-crown-tundra': 'sword-shield',
  'the-teal-mask': 'scarlet-violet',
  'the-indigo-disk': 'scarlet-violet',
  'mega-dimension': 'legends-za',
};

const SPIN_OFF_CONTEXTS = new Set(['colosseum', 'xd']);
const BATTLE_CONTEXTS = new Set(['champions']);

function kindOf(contextId: string): GameContextKind {
  if (SPIN_OFF_CONTEXTS.has(contextId)) return 'spin-off';
  if (BATTLE_CONTEXTS.has(contextId)) return 'battle';
  return 'main-series';
}

interface MutableGameContext {
  id: string;
  kind: GameContextKind;
  revisions: string[];
  defaultEligible: boolean;
}

function buildGameContexts(): MutableGameContext[] {
  const byId = new Map<string, MutableGameContext>();
  const order: string[] = [];
  for (const name of VERSION_GROUP_ORDER) {
    const baseId = REVISION_OF[name];
    if (baseId) {
      // A DLC/revision: append to its base context (already created, since
      // VERSION_GROUP_ORDER is chronological and every base precedes its DLC).
      byId.get(baseId)?.revisions.push(name);
      continue;
    }
    byId.set(name, {
      id: name,
      kind: kindOf(name),
      revisions: [name],
      defaultEligible: isDefaultEligible(name) && kindOf(name) === 'main-series',
    });
    order.push(name);
  }
  return order.map((id) => byId.get(id)!);
}

/** Oldest -> newest by the context's base version group. Built once, immutable in practice. */
export const GAME_CONTEXTS: readonly GameContextDefinition[] = Object.freeze(buildGameContexts().map((c) => ({ ...c, revisions: Object.freeze(c.revisions) as readonly string[] })));

const CONTEXT_BY_VERSION_GROUP: Readonly<Record<string, string>> = Object.fromEntries(
  GAME_CONTEXTS.flatMap((c) => c.revisions.map((v) => [v, c.id]))
);

const CONTEXT_BY_ID: Readonly<Record<string, GameContextDefinition>> = Object.fromEntries(
  GAME_CONTEXTS.map((c) => [c.id, c])
);

/** The Game Context a PokeAPI version group belongs to (undefined if unrecognized). */
export function contextForVersionGroup(versionGroup: string): GameContextDefinition | undefined {
  const id = CONTEXT_BY_VERSION_GROUP[versionGroup];
  return id ? CONTEXT_BY_ID[id] : undefined;
}

export function gameContextById(id: string): GameContextDefinition | undefined {
  return CONTEXT_BY_ID[id];
}

/** ES/EN label for a context: the label of its base version group. */
export function gameContextLabel(id: string, lang: string): string {
  return versionGroupLabel(id, lang);
}

/** Chronological rank of a context (by its base version group). Unknown ids rank lowest. */
export function gameContextRank(id: string): number {
  return versionGroupRank(id);
}

export interface ContextAvailability {
  context: GameContextDefinition;
  /** This context's revisions the Pokémon has data for, oldest -> newest. */
  availableRevisions: readonly string[];
  /** Most recent revision the Pokémon has data for within this context. */
  latestRevision: string;
}

/**
 * Every Game Context a Pokémon has data for (any revision), newest context
 * first — the order a selector should list them in.
 */
export function availableContextsForPokemon(versionGroups: Iterable<string>): ContextAvailability[] {
  const present = new Set(versionGroups);
  const byContext = new Map<string, string[]>();
  for (const vg of present) {
    const context = contextForVersionGroup(vg);
    if (!context) continue;
    const list = byContext.get(context.id) ?? [];
    list.push(vg);
    byContext.set(context.id, list);
  }
  const result: ContextAvailability[] = [];
  for (const [id, revisions] of byContext) {
    const context = CONTEXT_BY_ID[id];
    const availableRevisions = sortVersionGroups(revisions);
    result.push({ context, availableRevisions, latestRevision: availableRevisions[availableRevisions.length - 1] });
  }
  return result.sort((a, b) => gameContextRank(b.context.id) - gameContextRank(a.context.id));
}

export interface DefaultGameContext {
  contextId: string;
  /** The specific version group to read data from for this context. */
  revision: string;
}

/**
 * The Game Context (and the data revision within it) a page should open on.
 * See the module header for the policy. '' / '' when there are no
 * recognized version groups at all.
 */
export function defaultGameContextForPokemon(versionGroups: Iterable<string>): DefaultGameContext {
  const available = availableContextsForPokemon(versionGroups);
  if (available.length === 0) return { contextId: '', revision: '' };
  const eligible = available.find((a) => a.context.defaultEligible);
  const chosen = eligible ?? available[0];
  return { contextId: chosen.context.id, revision: chosen.latestRevision };
}
