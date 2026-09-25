// src/utils/itemSeo.ts
//
// One place for "is this item page worth indexing, and why" — pure and
// data-driven. Nothing here decides by name or by a hand-kept slug list: an
// item is judged by what PokeAPI actually holds for it (a usable description,
// a sprite, attributes, a machine / held-by relation).
//
// Evidence behind the rules (PokeAPI, 2223 items, 2026-09-25; see
// docs/audits/seo-phase4-item-indexation.md):
//  - 300 dynamax-crystal-* items all carry the same "[VAR (0000)]" flavor text
//    and a "★And15"-style internal name, no sprite/attributes/relations;
//  - 222 tm-materials + 81 picnic + 59 sandwich-ingredients + 18 tera-shard
//    items have a name and nothing else, 100% of every one of those families;
//  - 128 items are game-specific variants (`--held`/`--bag`, `--letsgo`, `la*`)
//    of another item with the exact same ES+EN name.
// Data cards, TMs, TRs and HMs, which the historical audit suspected, have
// distinct descriptions / a machine -> move relation and stay indexable.
//
// A single thin item in an otherwise documented family (Booster Energy,
// Legends Z-A mega stones: a PokeAPI data gap) is NOT noindexed on its own:
// noindex needs family-level evidence.

export type ItemDecision = 'index' | 'index-improve' | 'noindex';

export interface ItemNameEntry {
  name: string;
  language: { name: string };
}

/** The slice of a PokeAPI /item/{slug} response the policy reads. */
export interface ItemSeoInput {
  name: string;
  category?: { name: string } | null;
  names?: ItemNameEntry[];
  flavor_text_entries?: { text?: string; flavor_text?: string; language: { name: string }; version_group?: { name: string } }[];
  effect_entries?: { effect?: string; short_effect?: string; language: { name: string } }[];
  sprites?: { default?: string | null } | null;
  attributes?: { name: string }[];
  machines?: unknown[];
  held_by_pokemon?: unknown[];
}

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

const PLACEHOLDER_TEXT: RegExp[] = [
  /\[VAR\b/i, // unresolved game-text variable: "[VAR (0000)]"
  /\{\{.*\}\}/, // unresolved template variable
  /^\s*dummy data\.?\s*$/i,
  /^\s*xxx\b/i, // PokeAPI dev stub: "XXX new effect for bike--yellow"
  /^\s*(unknown|unused|none|n\/a|tbd)[\s.]*$/i,
  /^\s*unknown\.\s+currently unused\.?\s*$/i,
  /\?{3,}/,
  /^[\W\d_]*$/, // blank, or only punctuation / digits
];

/** True for text that is a system placeholder / internal data, not a description. */
export function isPlaceholderText(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  return PLACEHOLDER_TEXT.some((re) => re.test(t));
}

/** Internal names such as "★And15" (dynamax crystals): not a human name. */
export function isPlaceholderName(name: string | null | undefined): boolean {
  const t = (name ?? '').trim();
  return t === '' || t.startsWith('★');
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/**
 * Reporting family: machines and the two prefix families PokeAPI does not
 * separate by category, otherwise the PokeAPI item category itself.
 */
export function classifyItemFamily(name: string, category?: string | null): string {
  if (/^tm\d+$/.test(name)) return 'tm';
  if (/^tr\d+$/.test(name)) return 'tr';
  if (/^hm\d+$/.test(name)) return 'hm';
  if (name.startsWith('dynamax-crystal-')) return 'dynamax-crystal';
  if (name.startsWith('data-card-')) return 'data-card';
  return category || 'uncategorized';
}

// ---------------------------------------------------------------------------
// Quality signals + policy
// ---------------------------------------------------------------------------

export interface ItemQualitySignals {
  /** A real (non-placeholder) description in Spanish / English. */
  descriptionEs: boolean;
  descriptionEn: boolean;
  hasRealName: boolean;
  hasSprite: boolean;
  hasAttributes: boolean;
  /** Machine (teaches a move) or held-by-Pokémon relation. */
  hasRelation: boolean;
  /** Placeholder text found in a description field (e.g. "[VAR (0000)]"). */
  placeholderFields: string[];
}

function hasRealDescription(item: ItemSeoInput, lang: 'es' | 'en'): boolean {
  const flavor = (item.flavor_text_entries ?? []).some(
    (e) => e.language.name === lang && !isPlaceholderText(e.text ?? e.flavor_text)
  );
  const effect = (item.effect_entries ?? []).some(
    (e) => e.language.name === lang && !isPlaceholderText(e.short_effect || e.effect)
  );
  return flavor || effect;
}

export function getItemQualitySignals(item: ItemSeoInput): ItemQualitySignals {
  const placeholderFields: string[] = [];
  for (const e of item.flavor_text_entries ?? []) {
    if (isPlaceholderText(e.text ?? e.flavor_text)) placeholderFields.push(`flavor:${e.language.name}`);
  }
  for (const e of item.effect_entries ?? []) {
    if (isPlaceholderText(e.short_effect || e.effect)) placeholderFields.push(`effect:${e.language.name}`);
  }
  for (const n of item.names ?? []) {
    if (isPlaceholderName(n.name)) placeholderFields.push(`name:${n.language.name}`);
  }
  return {
    descriptionEs: hasRealDescription(item, 'es'),
    descriptionEn: hasRealDescription(item, 'en'),
    hasRealName: (item.names ?? []).some((n) => ['es', 'en'].includes(n.language.name) && !isPlaceholderName(n.name)),
    hasSprite: !!item.sprites?.default,
    hasAttributes: (item.attributes ?? []).length > 0,
    hasRelation: (item.machines ?? []).length > 0 || (item.held_by_pokemon ?? []).length > 0,
    placeholderFields: [...new Set(placeholderFields)],
  };
}

export interface ItemSeoPolicy {
  decision: ItemDecision;
  indexable: boolean;
  family: string;
  reason: string;
  signals: ItemQualitySignals;
  /** No real description and too few supporting signals (before family evidence). */
  thin: boolean;
}

/** Supporting signals (besides a description) an entity needs to be more than a name. */
export const MIN_SUPPORTING_SIGNALS = 2;

/** A family is "entirely thin" from this size and share of thin members. */
export const FAMILY_MIN_SIZE = 5;
export const FAMILY_THIN_RATIO = 0.9;

export interface FamilyEvidence {
  size: number;
  thin: number;
}

export function isEntirelyThinFamily(evidence: FamilyEvidence | undefined): boolean {
  return !!evidence && evidence.size >= FAMILY_MIN_SIZE && evidence.thin / evidence.size >= FAMILY_THIN_RATIO;
}

function isThin(signals: ItemQualitySignals): boolean {
  if (signals.descriptionEs || signals.descriptionEn) return false;
  const supporting = [signals.hasSprite, signals.hasAttributes, signals.hasRelation].filter(Boolean).length;
  return supporting < MIN_SUPPORTING_SIGNALS;
}

/** Thin-member counts per family, from a catalog's worth of items. */
export function summarizeFamilies(items: ItemSeoInput[]): Map<string, FamilyEvidence> {
  const families = new Map<string, FamilyEvidence>();
  for (const item of items) {
    const family = classifyItemFamily(item.name, item.category?.name);
    const evidence = families.get(family) ?? { size: 0, thin: 0 };
    evidence.size++;
    if (isThin(getItemQualitySignals(item))) evidence.thin++;
    families.set(family, evidence);
  }
  return families;
}

/**
 * Entity-level decision (identical for the ES and EN URL of an item, so the
 * hreflang pair never disagrees).
 *
 *  - index          real description in both languages;
 *  - index-improve  real description in only one language, or none but at
 *                   least two supporting signals (sprite / attributes /
 *                   machine or held-by relation), or a thin item inside a
 *                   family that is otherwise documented (a PokeAPI data
 *                   gap): the page adds a factual localized fallback;
 *  - noindex        thin item whose whole family is thin (>= 90% of >= 5
 *                   members: no description, no sprite, no relations for
 *                   the family). Stays a 200 page, `noindex,follow`, out of
 *                   the sitemap.
 *
 * Without `family` evidence a thin item is never noindexed (conservative).
 */
export function getItemSeoPolicy(item: ItemSeoInput, family?: FamilyEvidence): ItemSeoPolicy {
  const signals = getItemQualitySignals(item);
  const familyName = classifyItemFamily(item.name, item.category?.name);
  const thin = isThin(signals);
  const withDecision = (decision: ItemDecision, reason: string): ItemSeoPolicy => ({
    decision,
    indexable: decision !== 'noindex',
    family: familyName,
    reason,
    signals,
    thin,
  });

  if (signals.descriptionEs && signals.descriptionEn) return withDecision('index', 'real description in ES and EN');
  if (signals.descriptionEs || signals.descriptionEn) {
    return withDecision('index-improve', `real description only in ${signals.descriptionEs ? 'ES' : 'EN'}`);
  }
  if (!thin) return withDecision('index-improve', 'no description but sprite/attributes/relations: factual page');

  const placeholder = signals.placeholderFields.length > 0 ? ' (placeholder text only)' : '';
  if (isEntirelyThinFamily(family)) {
    return withDecision('noindex', `family "${familyName}" has no descriptive data (${family!.thin}/${family!.size} thin)${placeholder}`);
  }
  return withDecision('index-improve', `thin item in a documented family (data gap): kept indexable${placeholder}`);
}

// ---------------------------------------------------------------------------
// Duplicate-name variants
// ---------------------------------------------------------------------------

export interface ItemNameIdentity {
  name: string;
  names?: ItemNameEntry[];
  /** Data richness (e.g. count of quality signals); the richer variant is kept as primary. */
  quality?: number;
}

function nameKey(item: ItemNameIdentity): string | null {
  const es = item.names?.find((n) => n.language.name === 'es')?.name;
  const en = item.names?.find((n) => n.language.name === 'en')?.name;
  if (!es || !en || isPlaceholderName(es) || isPlaceholderName(en)) return null;
  return `${es.toLowerCase()}\u0000${en.toLowerCase()}`;
}

/**
 * Items that share the exact same ES + EN name are game-specific variants of
 * one item ("Ultra Ball" / laultra-ball, "Bike" / bike--green, the `--held` /
 * `--bag` Z-crystals). One primary per group stays indexable — richest data,
 * then fewest `--` qualifiers, then shortest slug, then alphabetical — the
 * rest are returned with the slug of the primary. Groups of one are never
 * returned.
 */
export function findDuplicateNameVariants(items: ItemNameIdentity[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  const quality = new Map<string, number>();
  for (const item of items) {
    const key = nameKey(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item.name]);
    quality.set(item.name, item.quality ?? 0);
  }
  const variants = new Map<string, string>();
  for (const slugs of groups.values()) {
    if (slugs.length < 2) continue;
    const qualifiers = (s: string) => s.split('--').length - 1;
    const [primary, ...rest] = [...slugs].sort(
      (a, b) =>
        (quality.get(b) ?? 0) - (quality.get(a) ?? 0) ||
        qualifiers(a) - qualifiers(b) ||
        a.length - b.length ||
        a.localeCompare(b)
    );
    for (const slug of rest) variants.set(slug, primary);
  }
  return variants;
}

// ---------------------------------------------------------------------------
// Description selection that never surfaces placeholders
// ---------------------------------------------------------------------------

/** Strip placeholder / blank entries so selection can never return them. */
export function withoutPlaceholderText<T extends { text?: string; flavor_text?: string; effect?: string; short_effect?: string }>(
  entries: T[] | undefined
): T[] {
  return (entries ?? []).filter((e) => !isPlaceholderText(e.text ?? e.flavor_text ?? (e.short_effect || e.effect)));
}

/** Count of real quality signals, used to pick the primary of a duplicate group. */
export function itemQualityScore(item: ItemSeoInput): number {
  const s = getItemQualitySignals(item);
  return [s.descriptionEs, s.descriptionEn, s.hasSprite, s.hasAttributes, s.hasRelation].filter(Boolean).length;
}
