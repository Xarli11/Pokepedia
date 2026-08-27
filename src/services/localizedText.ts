// src/services/localizedText.ts
//
// SPRINT 0 — data pipeline integrity.
//
// Centralized, entity-agnostic localized-text selection for PokeAPI
// entries. Replaces scattered `.find(e => e.language.name === lang)` calls
// that blindly trusted whatever entry happened to come first/last.
//
// ---------------------------------------------------------------------
// ROOT CAUSE (reproduced against live PokeAPI data, see
// scratchpad investigation covering 65 items / 15 abilities / 10 moves /
// 5 species across es/fr/de/it/en):
//
// For ITEMS, the Spanish (`es`) `flavor_text_entries` for the `x-y`
// version group is systematically unreliable: in the sampled set, every
// item whose earliest-available Spanish entry diverges from that same
// item's later, stable description has its divergent entry at `x-y`
// (33/33 occurrences). Word-overlap between that entry and the item's own
// later text averages 0.17 (Jaccard over content words) — i.e. mostly
// unrelated content — versus 0.81 for the equivalent "early vs late
// wording" divergence in French, 0.73 in German, 0.56 in Italian and 0.46
// in English (all of which are ordinary wording revisions of the SAME
// item, confirmed by manual reading, not corruption).
//
// At least four cases are proven, not inferred: the `x-y` Spanish entry
// is an EXACT STRING MATCH for a different, real item's stable
// description:
//   - assault-vest  x-y/es  == a Mega Stone (Venusaurite) description
//   - life-orb      x-y/es  == choice-scarf's real description
//   - choice-scarf  x-y/es  == toxic-plate's real description
//   - power-herb    x-y/es  == sticky-barb's real description
//   - venusaurite   x-y/es  == charizardite-x's real description
//   - charizardite-x x-y/es == alakazite's real description (id 699 -> 718,
//     not a constant offset, i.e. a real permutation, not a simple shift)
//
// This is NOT a generic "first-ever localized entry is unreliable" rule:
// items whose first-ever Spanish entry lands on a LATER version group
// (because the item didn't exist yet in x-y — e.g. protective-pads,
// terrain-extender, adrenaline-orb, all introduced in `sun-moon`) have a
// perfectly correct first entry. The corruption is specific to the `x-y`
// import batch itself, not to "being first".
//
// Abilities and moves were sampled and show NO cross-entity swaps — their
// early-vs-late divergences are ordinary wording refinement (same
// pattern as the French/German/Italian/English control groups). Pokédex
// species flavor text is not comparable by this method at all: unlike an
// item's mechanical description, species flavor text is *designed* to
// differ per game version, so "the text changed" carries no corruption
// signal there.
//
// CONCLUSION: reject only the proven combination
// (entityType: 'item', field: 'flavor', language: 'es', versionGroup: 'x-y').
// Everything else — including es/x-y for abilities/moves, and es/other
// version groups for items — passes through normally. See
// BLOCKED_COMBINATIONS below; do not add entries to it without the same
// standard of evidence (cross-entity string match or a quantified,
// documented divergence pattern), and do not widen it to "block all
// early version groups" — that is not what the data shows.
// ---------------------------------------------------------------------

import { versionGroupRank } from './versionGroups';

export type FieldType = 'effect' | 'flavor';

export interface LanguageEntry {
  language: { name: string };
}

export interface EffectEntry extends LanguageEntry {
  effect: string;
  short_effect?: string;
}

export interface FlavorEntry extends LanguageEntry {
  text?: string;
  flavor_text?: string;
  version_group?: { name: string };
}

/** Full provenance of a selected text, kept for debugging/auditing (Sprint 0 Step 4). */
export interface ProvenancedText {
  text: string;
  source: 'effect_entries' | 'flavor_text_entries';
  language: string;
  versionGroup?: string;
  fallbackUsed: boolean;
  fieldType: FieldType;
}

export interface BlockedCombination {
  entityType: string;
  field: FieldType;
  language: string;
  versionGroup: string;
  reason: string;
}

/**
 * The complete, evidence-backed denylist. Every entry here must be
 * justified in the module doc comment above with reproducible evidence —
 * a cross-entity string match or a quantified divergence pattern, not a
 * hunch. See localizedText.test.ts for the tests pinning this down.
 */
export const BLOCKED_COMBINATIONS: readonly BlockedCombination[] = [
  {
    entityType: 'item',
    field: 'flavor',
    language: 'es',
    versionGroup: 'x-y',
    reason:
      'Verified cross-item content swap in live PokeAPI data (assault-vest/life-orb/choice-scarf/power-herb/venusaurite/charizardite-x). See module doc comment for the full evidence.',
  },
];

export function isBlockedCombination(
  entityType: string,
  field: FieldType,
  language: string,
  versionGroup: string | undefined
): boolean {
  if (!versionGroup) return false;
  return BLOCKED_COMBINATIONS.some(
    (b) => b.entityType === entityType && b.field === field && b.language === language && b.versionGroup === versionGroup
  );
}

function cleanText(raw: string): string {
  return raw.replace(/\f/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface SelectTextOptions {
  /** e.g. 'item', 'ability', 'move' — used to scope the corruption denylist. */
  entityType: string;
  requestedLang: string;
  /** Language fallback ladder tried after requestedLang. Defaults to ['en']. */
  fallbackLangs?: string[];
}

/**
 * Mechanical/technical effect. Source: effect_entries.
 *
 * effect_entries carries no version_group (PokeAPI treats it as a single,
 * current definition per language) and was never observed to be corrupted
 * in the investigation above — so no denylist applies here. It is,
 * however, rarely available in Spanish for items, so a language fallback
 * is expected and reported via `fallbackUsed`.
 */
export function selectLocalizedEffect(
  entries: EffectEntry[] | undefined,
  options: SelectTextOptions
): ProvenancedText | null {
  const list = entries || [];
  const langLadder = [options.requestedLang, ...(options.fallbackLangs ?? ['en'])];

  for (const lang of langLadder) {
    const match = list.find((e) => e.language.name === lang);
    if (!match) continue;
    const raw = match.short_effect || match.effect;
    if (!raw) continue;
    return {
      text: cleanText(raw),
      source: 'effect_entries',
      language: lang,
      versionGroup: undefined,
      fallbackUsed: lang !== options.requestedLang,
      fieldType: 'effect',
    };
  }
  return null;
}

/**
 * Narrative in-game flavor text. Source: flavor_text_entries.
 *
 * Deterministic, order-independent selection: among all candidates for a
 * given language, picks the one with the HIGHEST known chronological
 * version-group rank (see versionGroups.ts) that is NOT a denylisted
 * combination — never "first in the array" or "last in the array". If
 * every candidate for a language is denylisted (or the language has no
 * entries at all), that language is skipped entirely and the next rung of
 * the fallback ladder is tried. If nothing reliable is found anywhere in
 * the ladder, returns null rather than surfacing a probably-wrong text.
 */
export function selectLocalizedFlavor(
  entries: FlavorEntry[] | undefined,
  options: SelectTextOptions
): ProvenancedText | null {
  const list = entries || [];
  const langLadder = [options.requestedLang, ...(options.fallbackLangs ?? ['en'])];

  for (const lang of langLadder) {
    const candidates = list
      .filter((e) => e.language.name === lang)
      .map((e) => ({ text: e.text || e.flavor_text, versionGroup: e.version_group?.name }))
      .filter((e): e is { text: string; versionGroup: string | undefined } => !!e.text)
      .filter((e) => !isBlockedCombination(options.entityType, 'flavor', lang, e.versionGroup));

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => versionGroupRank(b.versionGroup) - versionGroupRank(a.versionGroup));
    const best = candidates[0];

    return {
      text: cleanText(best.text),
      source: 'flavor_text_entries',
      language: lang,
      versionGroup: best.versionGroup,
      fallbackUsed: lang !== options.requestedLang,
      fieldType: 'flavor',
    };
  }
  return null;
}
