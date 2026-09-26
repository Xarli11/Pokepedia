// src/utils/catalogSearch.ts
//
// In-page filter + suggestion dropdown shared by the moves / abilities / items
// indexes. Everything it needs is already in the server-rendered rows (name,
// slug, primary fields), so it never fetches: it reads the DOM once and
// filters it. Matching ignores case and accents (see searchText.ts).

import { normalizeSearchText } from './searchText';

export interface CatalogRowRef {
  el: HTMLElement;
  slug: string;
  /** Displayed (localized) name. */
  name: string;
  /** Normalized name + slug, matched against the query. */
  haystack: string;
  /** One-line summary shown under the name in suggestions. */
  sub: string;
}

export function readRows(rows: Iterable<HTMLElement>, nameOf: (el: HTMLElement) => string, subOf: (el: HTMLElement) => string): CatalogRowRef[] {
  return [...rows].map((el) => {
    const slug = el.dataset.name ?? '';
    const name = nameOf(el);
    return { el, slug, name, haystack: `${normalizeSearchText(name)} ${normalizeSearchText(slug)}`, sub: subOf(el) };
  });
}

export const matchesQuery = (row: CatalogRowRef, query: string): boolean => !query || row.haystack.includes(query);

const SUGGESTION_ROW = 'flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors';

export interface CatalogSearchOptions {
  input: HTMLInputElement;
  suggestions: HTMLElement;
  rows: CatalogRowRef[];
  /** Extra per-row condition (e.g. the type / category select). */
  accept?: (row: CatalogRowRef) => boolean;
  onFilter?: () => void;
}

export function applyCatalogFilter({ input, rows, accept }: Pick<CatalogSearchOptions, 'input' | 'rows' | 'accept'>): void {
  const query = normalizeSearchText(input.value);
  for (const row of rows) row.el.style.display = matchesQuery(row, query) && (!accept || accept(row)) ? '' : 'none';
}

export function showSuggestions({ input, suggestions, rows, accept, onFilter }: CatalogSearchOptions): void {
  const query = normalizeSearchText(input.value);
  suggestions.innerHTML = '';
  if (query.length < 2) { suggestions.classList.add('hidden'); return; }
  const matches = rows.filter((r) => matchesQuery(r, query) && (!accept || accept(r))).slice(0, 6);
  if (matches.length === 0) { suggestions.classList.add('hidden'); return; }
  for (const m of matches) {
    const div = document.createElement('div');
    div.className = SUGGESTION_ROW;
    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'font-bold text-slate-800 dark:text-white';
    name.textContent = m.name;
    text.appendChild(name);
    if (m.sub) {
      const sub = document.createElement('div');
      sub.className = 'text-xs text-slate-400 font-medium truncate max-w-[260px]';
      sub.textContent = m.sub;
      text.appendChild(sub);
    }
    div.appendChild(text);
    div.onclick = () => {
      input.value = m.name;
      suggestions.classList.add('hidden');
      applyCatalogFilter({ input, rows, accept });
      onFilter?.();
    };
    suggestions.appendChild(div);
  }
  suggestions.classList.remove('hidden');
}
