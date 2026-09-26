// src/services/catalogs.ts
//
// Runtime access to the generated catalogs (src/data/generated/, built by
// scripts/generate-catalogs.ts). Catalog pages read the primary fields of
// every entry from here — one in-memory Map per language — instead of one
// PokeAPI request per row from the browser. Individual entity pages keep
// using PokeAPI for their full data.
//
// The generated files are bundled with the worker and imported lazily per
// kind and language (each becomes its own chunk), then memoized per isolate.

import { toEntries, type CatalogFile, type CatalogKind, type CatalogLang, type EntryByKind } from '../data/catalogs/schema';

type Loader = () => Promise<{ default: unknown }>;

const LOADERS: Record<CatalogKind, Record<CatalogLang, Loader>> = {
  moves: { es: () => import('../data/generated/moves.es.json'), en: () => import('../data/generated/moves.en.json') },
  abilities: { es: () => import('../data/generated/abilities.es.json'), en: () => import('../data/generated/abilities.en.json') },
  items: { es: () => import('../data/generated/items.es.json'), en: () => import('../data/generated/items.en.json') },
  pokemon: { es: () => import('../data/generated/pokemon.es.json'), en: () => import('../data/generated/pokemon.en.json') },
};

const cache = new Map<string, Promise<Map<string, unknown>>>();

const catalogLang = (lang: string): CatalogLang => (lang === 'en' ? 'en' : 'es');

/** Every entry of a catalog keyed by slug (PokeAPI order). Unknown languages use Spanish, like the rest of the site. */
export function getCatalog<K extends CatalogKind>(kind: K, lang: string): Promise<Map<string, EntryByKind[K]>> {
  const l = catalogLang(lang);
  const key = `${kind}.${l}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = LOADERS[kind][l]().then((mod) => new Map(toEntries(mod.default as CatalogFile<K>).map((e) => [e.slug, e as unknown])));
    cache.set(key, hit);
  }
  return hit as Promise<Map<string, EntryByKind[K]>>;
}

export const getMoveCatalog = (lang: string) => getCatalog('moves', lang);
export const getAbilityCatalog = (lang: string) => getCatalog('abilities', lang);
export const getItemCatalog = (lang: string) => getCatalog('items', lang);
