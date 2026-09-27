// src/data/catalogs/build.ts
//
// Pure builders: raw PokeAPI payloads -> catalog rows. No I/O, no clock, no
// randomness, so the same payloads always produce byte-identical files.
// The generator (scripts/generate-catalogs.ts) only fetches and writes.
//
// Text is never taken raw from the API: descriptions go through the same
// selection layer the entity pages use (services/localizedText.ts — version
// group ranking + the evidence-backed corruption denylist), and item
// placeholders ("[VAR (0000)]", "Unknown.") are dropped first.

import {
  selectLocalizedEffect,
  selectLocalizedFlavor,
  type EffectEntry,
  type FlavorEntry,
} from '../../services/localizedText';
import { withoutPlaceholderText } from '../../utils/itemSeo';
import { formatName, formatPokemonName, getItemSuperCategory } from '../../utils/pokemon';
import type { AbilityEntry, CatalogLang, ItemEntry, MoveEntry, PokemonEntry, TextLang } from './schema';

interface NameEntry {
  name: string;
  language: { name: string };
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** 'generation-iv' -> 4 (0 when unrecognized: validated by the caller). */
export function generationNumber(name: string | undefined): number {
  return ROMAN[(name ?? '').replace(/^generation-/, '')] ?? 0;
}

/** Trailing numeric path segment of a PokeAPI resource URL. */
export function idFromUrl(url: string): number {
  const segment = url.split('/').filter(Boolean).pop();
  return segment ? parseInt(segment, 10) : NaN;
}

/** Localized name; falls back to English, then to the formatted slug. */
export function resolveName(names: NameEntry[] | undefined, lang: CatalogLang, slug: string): string {
  const list = names ?? [];
  return list.find((n) => n.language.name === lang)?.name?.trim()
    || list.find((n) => n.language.name === 'en')?.name?.trim()
    || formatName(slug);
}

/** Longest stored description: what the index pages already showed (100 chars). */
export const DESCRIPTION_MAX = 100;

/** Whitespace-normalized; cut at a word boundary with an explicit ellipsis when too long. */
export function summarize(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

interface DescriptionInput {
  flavor?: FlavorEntry[];
  effect?: EffectEntry[];
  entityType: 'ability' | 'item';
}

/**
 * Requested language first (in-game flavor text, then short effect), English
 * only when the requested language has neither. Returns the language the text
 * really is in, so the UI never has to guess.
 */
export function pickDescription(input: DescriptionInput, lang: CatalogLang): { text: string; lang: CatalogLang } | null {
  const items = input.entityType === 'item';
  const flavor = items ? withoutPlaceholderText(input.flavor) : (input.flavor ?? []);
  const effect = items ? withoutPlaceholderText(input.effect) : (input.effect ?? []);
  const ladder: CatalogLang[] = lang === 'en' ? ['en'] : [lang, 'en'];
  for (const l of ladder) {
    const opts = { entityType: input.entityType, requestedLang: l, fallbackLangs: [] as string[] };
    const chosen = selectLocalizedFlavor(flavor, opts) ?? selectLocalizedEffect(effect, opts);
    if (chosen?.text) return { text: summarize(chosen.text), lang: l };
  }
  return null;
}

// --- raw payload subsets (only what is read) ---

export interface RawMove {
  name: string;
  names?: NameEntry[];
  type?: { name: string };
  damage_class?: { name: string };
  power?: number | null;
  accuracy?: number | null;
  pp?: number | null;
  priority?: number | null;
  generation?: { name: string };
}

export interface RawAbility {
  name: string;
  names?: NameEntry[];
  is_main_series?: boolean;
  generation?: { name: string };
  flavor_text_entries?: FlavorEntry[];
  effect_entries?: EffectEntry[];
}

export interface RawItem {
  name: string;
  names?: NameEntry[];
  category?: { name: string };
  sprites?: { default?: string | null };
  flavor_text_entries?: FlavorEntry[];
  effect_entries?: EffectEntry[];
}

export interface RawSpecies {
  id: number;
  name: string;
  names?: NameEntry[];
  generation?: { name: string };
  varieties?: { is_default: boolean; pokemon: { name: string; url: string } }[];
}

export function buildMoveEntry(raw: RawMove, lang: CatalogLang): MoveEntry {
  return {
    slug: raw.name,
    name: resolveName(raw.names, lang, raw.name),
    type: raw.type?.name ?? '',
    damageClass: raw.damage_class?.name ?? 'status',
    power: raw.power ?? null,
    accuracy: raw.accuracy ?? null,
    pp: raw.pp ?? 0,
    priority: raw.priority ?? 0,
    generation: generationNumber(raw.generation?.name),
  };
}

export function buildAbilityEntry(raw: RawAbility, lang: CatalogLang): AbilityEntry {
  const description = pickDescription({ flavor: raw.flavor_text_entries, effect: raw.effect_entries, entityType: 'ability' }, lang);
  return {
    slug: raw.name,
    name: resolveName(raw.names, lang, raw.name),
    description: description?.text ?? '',
    descriptionLang: (description?.lang ?? '') as TextLang,
    generation: generationNumber(raw.generation?.name),
    mainSeries: raw.is_main_series ?? true,
  };
}

export function buildItemEntry(raw: RawItem, lang: CatalogLang): ItemEntry {
  const category = raw.category?.name ?? 'other';
  const description = pickDescription({ flavor: raw.flavor_text_entries, effect: raw.effect_entries, entityType: 'item' }, lang);
  return {
    slug: raw.name,
    name: resolveName(raw.names, lang, raw.name),
    category,
    superCategory: getItemSuperCategory(category),
    hasSprite: Boolean(raw.sprites?.default),
    description: description?.text ?? '',
    descriptionLang: (description?.lang ?? '') as TextLang,
  };
}

/**
 * One row for the species plus one per non-default variety (mega, gmax,
 * regional and alternate forms). A species' default variety is the species
 * page itself, so it gets no row of its own (see canonicalPokemonSlug).
 */
export function buildPokemonEntries(raw: RawSpecies, lang: CatalogLang): PokemonEntry[] {
  const speciesName = resolveName(raw.names, lang, raw.name);
  const generation = generationNumber(raw.generation?.name);
  const out: PokemonEntry[] = [{ slug: raw.name, id: raw.id, name: speciesName, generation, form: false }];
  for (const v of raw.varieties ?? []) {
    if (v.is_default) continue;
    const formLabel = formatPokemonName(v.pokemon.name, raw.name, lang);
    const base = formatName(raw.name);
    out.push({
      slug: v.pokemon.name,
      id: idFromUrl(v.pokemon.url),
      // "Charizard (Mega X)" with the species part in the page language.
      name: formLabel.startsWith(base) ? `${speciesName}${formLabel.slice(base.length)}` : formLabel,
      generation,
      form: true,
    });
  }
  return out;
}

// --- overrides: hand-written, clearly separated, applied last ---

export interface CatalogOverrides {
  moves?: Partial<Record<CatalogLang, Record<string, Partial<Pick<MoveEntry, 'name'>>>>>;
  abilities?: Partial<Record<CatalogLang, Record<string, Partial<Pick<AbilityEntry, 'name' | 'description'>>>>>;
  items?: Partial<Record<CatalogLang, Record<string, Partial<Pick<ItemEntry, 'name' | 'description'>>>>>;
}

export function applyOverrides<T extends { slug: string }, O extends Partial<T>>(
  entries: T[],
  overrides: Record<string, O> | undefined
): T[] {
  if (!overrides) return entries;
  return entries.map((e) => (overrides[e.slug] ? { ...e, ...overrides[e.slug] } : e));
}
