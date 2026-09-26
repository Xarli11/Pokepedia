// src/utils/searchUi.ts
//
// Browser side of the global search, shared by the header modal and the home
// page search: lazy-loads the language's compact index once, and builds result
// rows with DOM APIs only (no innerHTML with data). Ranking lives in search.ts,
// history storage in searchHistory.ts.

import { entityHref, prepareIndex, search, type PreparedEntry, type SearchResult } from './search';
import { recordHistory, type HistoryEntry } from './searchHistory';
import type { SearchIndexFile, SearchType } from './searchTypes';

export const ENTITY_LABELS: Record<'es' | 'en', Record<SearchType, string>> = {
  es: { pokemon: 'Pokémon', move: 'Movimiento', ability: 'Habilidad', item: 'Objeto', type: 'Tipo', generation: 'Generación' },
  en: { pokemon: 'Pokémon', move: 'Move', ability: 'Ability', item: 'Item', type: 'Type', generation: 'Generation' },
};

const SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const FALLBACK_SPRITE = '/pokeball.png';
const ROW_CLASS = 'flex items-center gap-5 px-6 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-l-4 border-transparent transition-all group';
const GLYPH: Record<SearchType, string> = { pokemon: '', move: 'M', ability: 'H', item: 'O', type: 'T', generation: 'G' };

export interface PreparedSearch {
  entries: PreparedEntry[];
  /** type slug -> localized name, from the index's own type rows. */
  typeNames: Map<string, string>;
}

const loaded = new Map<string, Promise<PreparedSearch>>();

/** Fetches and prepares the index once per language (a failed load can be retried). */
export function loadSearchIndex(lang: string, version = ''): Promise<PreparedSearch> {
  const key = `${lang}:${version}`;
  let hit = loaded.get(key);
  if (!hit) {
    hit = fetch(`/search-index/${lang}.json/${version ? `?v=${encodeURIComponent(version)}` : ''}`)
      .then((res) => {
        if (!res.ok) throw new Error(`search index ${res.status}`);
        return res.json() as Promise<SearchIndexFile>;
      })
      .then((file) => {
        const entries = prepareIndex(file);
        const typeNames = new Map(entries.filter((e) => e.type === 'type').map((e) => [e.row[1], e.name]));
        return { entries, typeNames };
      });
    hit.catch(() => loaded.delete(key));
    loaded.set(key, hit);
  }
  return hit;
}

export function runSearch(prepared: PreparedSearch, query: string, lang: string): SearchResult[] {
  return search(prepared.entries, query, lang);
}

export interface RowContext {
  lang: string;
  typeColors?: Record<string, string>;
  typeNames?: Map<string, string>;
  /** Extra caption on the right ("Ver →", "Reciente"). */
  caption?: string;
  onNavigate?: (entry: HistoryEntry) => void;
}

const el = (tag: string, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function secondary(type: SearchType, id: number, extra: string, ctx: RowContext): string {
  const es = ctx.lang !== 'en';
  if (type === 'pokemon') return id >= 10000 ? (es ? 'Forma especial' : 'Special form') : `#${String(id).padStart(4, '0')}`;
  if (type === 'move') return ctx.typeNames?.get(extra) ?? '';
  if (type === 'generation') return extra;
  return '';
}

/** One result/history row: an anchor (real link: works with middle-click, keyboard and the Enter handler). */
export function buildEntityRow(
  entry: { type: SearchType; slug: string; name: string; id: number; extra?: string },
  ctx: RowContext
): HTMLAnchorElement {
  const lang = ctx.lang === 'en' ? 'en' : 'es';
  const a = document.createElement('a');
  a.href = entityHref(ctx.lang, entry.type, entry.slug);
  a.className = ROW_CLASS;
  a.dataset.searchType = entry.type;
  a.dataset.searchSlug = entry.slug;

  const icon = el('div', 'w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center p-1 border border-slate-100 dark:border-slate-800 shrink-0');
  if (entry.type === 'pokemon' && entry.id > 0) {
    const img = document.createElement('img');
    img.src = `${SPRITE}/${entry.id}.png`;
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'w-full h-full object-contain drop-shadow-md';
    img.onerror = () => { img.src = FALLBACK_SPRITE; img.classList.add('opacity-20'); };
    icon.appendChild(img);
  } else {
    const color = entry.type === 'type' ? ctx.typeColors?.[entry.slug] : entry.type === 'move' ? ctx.typeColors?.[entry.extra ?? ''] : undefined;
    const glyph = el('span', 'text-sm font-black ' + (color ? 'text-white' : 'text-slate-400 dark:text-slate-500'), GLYPH[entry.type] || '·');
    glyph.setAttribute('aria-hidden', 'true');
    if (color) { icon.style.backgroundColor = color; }
    icon.appendChild(glyph);
  }

  const text = el('div', 'flex flex-col min-w-0');
  text.appendChild(el('span', 'text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest', ENTITY_LABELS[lang][entry.type]));
  const line = el('span', 'text-slate-700 dark:text-slate-200 font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate', entry.name);
  const meta = secondary(entry.type, entry.id, entry.extra ?? '', ctx);
  if (meta) line.appendChild(el('span', 'ml-2 font-black text-slate-300 dark:text-slate-600 text-xs', `· ${meta}`));
  text.appendChild(line);

  a.appendChild(icon);
  a.appendChild(text);
  if (ctx.caption) a.appendChild(el('span', 'ml-auto text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest', ctx.caption));
  a.addEventListener('click', () => {
    const stored: HistoryEntry = { type: entry.type, slug: entry.slug, name: entry.name, id: entry.id };
    try { recordHistory(localStorage, stored); } catch { /* ignore */ }
    ctx.onNavigate?.(stored);
  });
  return a;
}
