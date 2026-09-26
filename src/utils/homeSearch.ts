// src/utils/homeSearch.ts
//
// How the home search text interacts with the Pokédex grid. The search box is
// Pokepedia's global search (multi-entity dropdown); the grid only shows one
// generation, so the same text is often not a Pokémon of that grid at all
// ("terremoto", "piel tosca", "dragón", or "garchomp" while on Kanto).
//
// Rule: the text narrows the grid only when at least one card of the grid
// matches it. Otherwise the text belongs to the dropdown alone and the grid is
// left as it is (still subject to the type filter), so the page never shows
// "no Pokémon found" beside a correct "Movimiento · Terremoto". The grid's
// empty state is reserved for a type filter that leaves nothing.

import { normalizeSearchText } from './searchText';

export interface GridCard {
  name: string;
  id: string;
  types: string[];
}

export interface GridVisibility {
  visible: boolean[];
  /** True when the text narrowed the grid (some card matched it). */
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
  const textApplied = hasText && textMatches.some(Boolean);
  const visible = cards.map((c, i) => (!textApplied || textMatches[i]) && (selectedType === 'all' || c.types.includes(selectedType)));
  const showEmpty = !visible.some(Boolean) && (selectedType !== 'all' || textApplied);
  return { visible, textApplied, showEmpty };
}
