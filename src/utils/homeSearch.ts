// src/utils/homeSearch.ts
//
// The Pokédex home page's big search box is a LOCAL filter over the
// currently rendered grid (the selected generation, or favorites) — never
// global entity search. Global search (Pokémon of any generation, moves,
// abilities, items, types, generations) lives only in the header's search
// modal (Layout.astro), which is unchanged.
//
// This used to be more permissive: a query that matched nothing in the
// grid left the grid untouched, so a separate global-entity dropdown on
// this same input could "own" it instead. That dropdown is gone (Fase 2,
// UX polish: two search surfaces with different semantics on one page was
// confusing — "search Garchomp while viewing Kanto" showed a global
// Garchomp result above a Kanto grid that never changed). Now the query
// always filters the grid, honestly, including down to zero results.

import { normalizeSearchText } from './searchText';

export interface GridCard {
  name: string;
  id: string;
  types: string[];
}

export interface GridVisibility {
  visible: boolean[];
  /** True when there was a query to filter by (whether or not it matched anything). */
  textApplied: boolean;
  /** The grid's empty state should show. */
  showEmpty: boolean;
}

/** "#0445", "445" -> "445"; other text -> normalized text. */
function queryKey(raw: string): { text: string; digits: string | null } {
  const trimmed = raw.trim();
  const digits = /^#?\d+$/.test(trimmed) ? trimmed.replace('#', '').replace(/^0+(?=\d)/, '') : null;
  return { text: normalizeSearchText(trimmed).replace(/^#/, ''), digits };
}

export function cardMatchesText(card: GridCard, raw: string): boolean {
  const { text, digits } = queryKey(raw);
  if (!text) return true;
  if (digits !== null) return String(Number(card.id)) === digits || card.id.includes(digits);
  return normalizeSearchText(card.name).includes(text);
}

export function computeGridVisibility(cards: readonly GridCard[], rawQuery: string, selectedType: string): GridVisibility {
  const hasText = queryKey(rawQuery).text !== '';
  const textMatches = cards.map((c) => cardMatchesText(c, rawQuery));
  const visible = cards.map((c, i) => (!hasText || textMatches[i]) && (selectedType === 'all' || c.types.includes(selectedType)));
  const showEmpty = !visible.some(Boolean);
  return { visible, textApplied: hasText, showEmpty };
}

/** "{query}" / "{region}" substitution for the local-search copy in uiTranslations. Shared by SSR and the client script so the two never drift. */
export function formatTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? '');
}
