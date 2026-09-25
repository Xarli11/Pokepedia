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
//    and a "★And15"-style internal name, no sprite/attributes/relations:
//    system data, not entities;
//  - 5 bag-UI pockets in PokeAPI's "unused" category (Battle Pocket, Candy
//    Jar...) have blank / dash-only text and no sprite;
//  - 69 items are game-specific variants (`--held`/`--bag`, `--letsgo`, `la*`)
//    of another item with the exact same ES+EN name.
// Deliberately NOT noindex, whatever PokeAPI holds for them: TMs, TRs, HMs, data
// cards, and the name-only families tm-materials (222), picnic (81),
// sandwich-ingredients (59) and tera-shard (18). Each is a real game entity
// with a distinct, specific ES+EN name (222/222, 81/81, 59/59, 18/18 unique) and
// game indices; "PokeAPI has few fields" is a data debt, not evidence that the
// entity has no value. They are index + improve.

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
  /** No real description and too few supporting signals. */
  thin: boolean;
}

/** Supporting signals (besides a description) an entity needs to be more than a name. */
export const MIN_SUPPORTING_SIGNALS = 2;

/**
 * PokeAPI item categories that only hold game-internal entries. A thin item
 * there is data, not an entity; a documented one (real flavor text, sprite:
 * Rule Book, Bike, Rotom Powers...) is a legitimate key item and stays.
 */
export const GAME_INTERNAL_CATEGORIES: readonly string[] = ['unused'];

function isThin(signals: ItemQualitySignals): boolean {
  if (signals.descriptionEs || signals.descriptionEn) return false;
  const supporting = [signals.hasSprite, signals.hasAttributes, signals.hasRelation].filter(Boolean).length;
  return supporting < MIN_SUPPORTING_SIGNALS;
}

/**
 * Entity-level decision (identical for the ES and EN URL of an item, so the
 * hreflang pair never disagrees). Placeholder text ("XXX new effect…",
 * "Unknown.", "[VAR (0000)]") never counts as a description or a signal.
 *
 *  - index          real description in ES and EN;
 *  - index-improve  a description in only one language, or none but enough
 *                   supporting signals, or a thin but real entity (name only:
 *                   a data debt): the page adds a factual localized sentence;
 *  - noindex        only two cases, both item-level:
 *                     1. system data: internal "★" name AND placeholder text
 *                        AND nothing else (dynamax crystals);
 *                     2. thin item in a game-internal category ("unused":
 *                        bag-UI pockets).
 *                   Stays a 200 page, `noindex,follow`, out of the sitemap.
 *
 * Being poorly documented is never a reason to noindex an entity.
 */
export function getItemSeoPolicy(item: ItemSeoInput): ItemSeoPolicy {
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

  const hasPlaceholderName = signals.placeholderFields.some((f) => f.startsWith('name:'));
  const hasPlaceholderText = signals.placeholderFields.some((f) => !f.startsWith('name:'));
  if (hasPlaceholderName && hasPlaceholderText) {
    return withDecision('noindex', 'system data: internal name and placeholder text only');
  }
  if (GAME_INTERNAL_CATEGORIES.includes(item.category?.name ?? '')) {
    return withDecision('noindex', `game-internal category "${item.category?.name}" with no descriptive data`);
  }
  return withDecision('index-improve', 'thin but real entity (name and category only): data debt, kept indexable');
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
