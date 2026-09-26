// src/utils/searchHistory.ts
//
// Recent-search history for the global search, stored in localStorage under
// the same key as before (`pokepedia_history`) but now able to hold any entity
// kind. Legacy entries — { name, id, sprite } written for Pokémon only — are
// read as Pokémon, so nobody's history disappears on upgrade.
//
// Privacy: entries are entities the person opened (a public slug and its
// name), never the free text they typed, and nothing here is sent to
// analytics (see utils/analytics.ts).

import { SEARCH_TYPES, type SearchType } from './searchTypes';

export const HISTORY_KEY = 'pokepedia_history';
export const HISTORY_MAX = 8;

export interface HistoryEntry {
  type: SearchType;
  slug: string;
  /** Display name at the time it was stored (may be in the other language). */
  name: string;
  id: number;
}

/** Accepts current and legacy shapes; drops anything malformed. */
export function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const type = (SEARCH_TYPES as readonly string[]).includes(r.type as string) ? (r.type as SearchType) : r.type === undefined ? 'pokemon' : null;
    const slug = typeof r.slug === 'string' ? r.slug : typeof r.name === 'string' && type === 'pokemon' && r.type === undefined ? r.name : '';
    if (!type || !slug || slug.includes('/')) continue;
    const key = `${type}:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      type,
      slug,
      name: typeof r.displayName === 'string' ? r.displayName : typeof r.label === 'string' ? r.label : typeof r.name === 'string' && r.type !== undefined ? r.name : slug,
      id: typeof r.id === 'number' ? r.id : 0,
    });
  }
  return out.slice(0, HISTORY_MAX);
}

export function pushHistory(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history.filter((h) => !(h.type === entry.type && h.slug === entry.slug))].slice(0, HISTORY_MAX);
}

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export function readHistory(storage: StorageLike): HistoryEntry[] {
  try {
    return normalizeHistory(JSON.parse(storage.getItem(HISTORY_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function recordHistory(storage: StorageLike, entry: HistoryEntry): void {
  try {
    storage.setItem(HISTORY_KEY, JSON.stringify(pushHistory(readHistory(storage), entry)));
  } catch { /* storage unavailable: history is a convenience */ }
}

export function clearHistory(storage: StorageLike): void {
  try { storage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}
