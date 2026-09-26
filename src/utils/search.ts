// src/utils/search.ts
//
// Deterministic multi-entity search over the compact per-language index
// (see data/catalogs/searchIndex.ts). Runs in the browser; pure and
// dependency-free so it is unit-tested and stays small in the bundle.
//
// Ranking (highest first, ties broken by entity kind, then id, then name):
//   100 exact name          95 exact dex number (Pokémon species)
//    80 name starts with    70 exact alias      60 alias starts with
//    55 a word of the name starts with          45 dex number starts with
//    40 name / alias / slug contains            30 every query word is present
// No fuzzy matching on purpose: predictable, cheap, and good enough for names.

import { pagePath } from './seo';
import { normalizeSearchText } from './searchText';
import { CODE_TYPE, SEARCH_TYPES, type SearchIndexFile, type SearchRow, type SearchType } from './searchTypes';

export interface PreparedEntry {
  row: SearchRow;
  type: SearchType;
  name: string;
  nameKey: string;
  slugKey: string;
  aliasKeys: string[];
  wordStarts: string[];
  /** Dex number as text for species rows ('' for forms and other kinds). */
  dexKey: string;
}

export interface SearchResult {
  type: SearchType;
  slug: string;
  name: string;
  /** Pokémon: dex number / form id; generation: its number; else 0. */
  id: number;
  extra: string;
  score: number;
  href: string;
}

/** Path segment of each entity's own page (unchanged public URLs). */
export const ENTITY_SECTION: Record<SearchType, string> = {
  pokemon: 'pokemon',
  move: 'movimientos',
  ability: 'habilidades',
  item: 'objetos',
  type: 'tipo',
  generation: 'generacion',
};

export const entityHref = (lang: string, type: SearchType, slug: string): string => pagePath(lang, ENTITY_SECTION[type], slug);

const KIND_ORDER = Object.fromEntries(SEARCH_TYPES.map((t, i) => [t, i])) as Record<SearchType, number>;

export function prepareIndex(index: SearchIndexFile): PreparedEntry[] {
  return index.rows.map((row) => {
    const type = CODE_TYPE[row[0]];
    const nameKey = normalizeSearchText(row[2]);
    return {
      row,
      type,
      name: row[2],
      nameKey,
      slugKey: normalizeSearchText(row[1]),
      aliasKeys: (row[5] ?? []).map(normalizeSearchText),
      wordStarts: nameKey.split(' '),
      dexKey: type === 'pokemon' && row[3] > 0 && row[3] < 10000 ? String(row[3]) : '',
    };
  });
}

function scoreEntry(e: PreparedEntry, q: string, tokens: string[], numeric: string | null): number {
  if (numeric !== null) {
    if (e.dexKey === numeric) return 95;
    if (e.dexKey && e.dexKey.startsWith(numeric) && numeric.length >= 2) return 45;
  }
  if (!q) return 0;
  if (e.nameKey === q) return 100;
  if (e.nameKey.startsWith(q)) return 80;
  if (e.aliasKeys.includes(q)) return 70;
  if (e.aliasKeys.some((a) => a.startsWith(q))) return 60;
  if (e.wordStarts.some((w) => w.startsWith(q))) return 55;
  if (e.nameKey.includes(q) || e.slugKey.includes(q) || e.aliasKeys.some((a) => a.includes(q))) return 40;
  if (tokens.length > 1) {
    const hay = [e.nameKey, e.slugKey, ...e.aliasKeys];
    if (tokens.every((t) => hay.some((h) => h.includes(t)))) return 30;
  }
  return 0;
}

export interface SearchOptions {
  /** Maximum results overall. */
  limit?: number;
  /** Maximum results per entity kind, so one kind cannot crowd out the rest. */
  perType?: number;
}

/** Minimum query length that triggers a search (numbers included: "4" is too ambiguous). */
export const MIN_QUERY_LENGTH = 2;

export function search(prepared: readonly PreparedEntry[], rawQuery: string, lang: string, options: SearchOptions = {}): SearchResult[] {
  const limit = options.limit ?? 12;
  const perType = options.perType ?? 5;
  const trimmed = rawQuery.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  // "#445", "445" and "0445" are all Pokédex number 445.
  const digits = /^#?\d+$/.test(trimmed) ? trimmed.replace('#', '').replace(/^0+(?=\d)/, '') : null;
  const q = normalizeSearchText(trimmed).replace(/^#/, '');
  const tokens = q.split(' ').filter(Boolean);

  const scored: { entry: PreparedEntry; score: number }[] = [];
  for (const entry of prepared) {
    const score = scoreEntry(entry, q, tokens, digits);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) =>
    b.score - a.score
    || KIND_ORDER[a.entry.type] - KIND_ORDER[b.entry.type]
    || a.entry.row[3] - b.entry.row[3]
    || a.entry.nameKey.length - b.entry.nameKey.length
    || (a.entry.row[1] < b.entry.row[1] ? -1 : a.entry.row[1] > b.entry.row[1] ? 1 : 0)
  );

  const taken: Record<SearchType, number> = { pokemon: 0, move: 0, ability: 0, item: 0, type: 0, generation: 0 };
  const out: SearchResult[] = [];
  for (const { entry, score } of scored) {
    if (out.length >= limit) break;
    if (taken[entry.type] >= perType) continue;
    taken[entry.type]++;
    const [, slug, name, id, extra] = entry.row;
    out.push({ type: entry.type, slug, name, id, extra, score, href: entityHref(lang, entry.type, slug) });
  }
  return out;
}
