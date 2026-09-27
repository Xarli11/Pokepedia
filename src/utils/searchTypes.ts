// Shared, dependency-free types for the search index (used by the build-time
// generator and by the browser bundle, which must stay light).
import type { CatalogLang } from '../data/catalogs/schema';

export const SEARCH_INDEX_SCHEMA = 1;

export type SearchType = 'pokemon' | 'move' | 'ability' | 'item' | 'type' | 'generation';
export const SEARCH_TYPES: readonly SearchType[] = ['pokemon', 'move', 'ability', 'item', 'type', 'generation'];
export const TYPE_CODE: Record<SearchType, string> = { pokemon: 'p', move: 'm', ability: 'a', item: 'i', type: 't', generation: 'g' };
export const CODE_TYPE: Record<string, SearchType> = Object.fromEntries(SEARCH_TYPES.map((t) => [TYPE_CODE[t], t]));

export type SearchRow = [code: string, slug: string, name: string, id: number, extra: string, aliases?: string[]];

export interface SearchIndexFile {
  schema: typeof SEARCH_INDEX_SCHEMA;
  lang: CatalogLang;
  counts: Record<SearchType, number>;
  rows: SearchRow[];
}

