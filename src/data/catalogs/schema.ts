// src/data/catalogs/schema.ts
//
// Shape of the generated, versioned catalogs in src/data/generated/ and the
// pure validation shared by the generator script, the runtime loader and the
// tests. Nothing here does I/O.
//
// A catalog file is a header plus tuple rows (`fields` names the columns).
// Tuples keep the files small (they are bundled into the worker and read on
// every catalog page); `toEntries()` turns them into typed objects.

export const CATALOG_SCHEMA = 1;
export const CATALOG_LANGS = ['es', 'en'] as const;
export type CatalogLang = (typeof CATALOG_LANGS)[number];
export type CatalogKind = 'moves' | 'abilities' | 'items' | 'pokemon';
export const CATALOG_KINDS: readonly CatalogKind[] = ['moves', 'abilities', 'items', 'pokemon'];

/** Text language a description was actually taken from ('' when there is none). */
export type TextLang = CatalogLang | '';

export interface MoveEntry {
  slug: string;
  name: string;
  type: string;
  damageClass: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  generation: number;
}

export interface AbilityEntry {
  slug: string;
  name: string;
  description: string;
  descriptionLang: TextLang;
  generation: number;
  mainSeries: boolean;
}

export interface ItemEntry {
  slug: string;
  name: string;
  category: string;
  superCategory: string;
  hasSprite: boolean;
  description: string;
  descriptionLang: TextLang;
}

export interface PokemonEntry {
  /** URL slug: the species name, or the variety name for a form. */
  slug: string;
  /** National Dex number for a species; the PokeAPI `pokemon` id (>= 10000) for a form. */
  id: number;
  name: string;
  generation: number;
  form: boolean;
}

export interface EntryByKind {
  moves: MoveEntry;
  abilities: AbilityEntry;
  items: ItemEntry;
  pokemon: PokemonEntry;
}

export const CATALOG_FIELDS: { [K in CatalogKind]: readonly (keyof EntryByKind[K])[] } = {
  moves: ['slug', 'name', 'type', 'damageClass', 'power', 'accuracy', 'pp', 'priority', 'generation'],
  abilities: ['slug', 'name', 'description', 'descriptionLang', 'generation', 'mainSeries'],
  items: ['slug', 'name', 'category', 'superCategory', 'hasSprite', 'description', 'descriptionLang'],
  pokemon: ['slug', 'id', 'name', 'generation', 'form'],
};

export interface CatalogMeta {
  /** Where the rows came from (documented in docs/DATA_SOURCES.md). */
  source: string;
  /** `count` PokeAPI reported for the list endpoint the catalog was built from. */
  apiCount: number;
  /** Entries PokeAPI lists twice (same name): kept once. */
  duplicates: number;
  /** Entries deliberately left out (e.g. non-real items, see isRealItem). */
  excluded: number;
}

export interface CatalogFile<K extends CatalogKind = CatalogKind> extends CatalogMeta {
  schema: typeof CATALOG_SCHEMA;
  kind: K;
  lang: CatalogLang;
  count: number;
  fields: readonly string[];
  rows: unknown[][];
}

export class CatalogError extends Error {}

/**
 * Structural + integrity validation. Throws CatalogError with every problem
 * found (not only the first), so a bad regeneration fails loudly and is
 * explained in one run.
 */
export function validateCatalog(file: CatalogFile, expected?: { kind?: CatalogKind; lang?: CatalogLang }): void {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(msg);

  if (file.schema !== CATALOG_SCHEMA) fail(`schema ${file.schema} (expected ${CATALOG_SCHEMA})`);
  if (!CATALOG_KINDS.includes(file.kind)) fail(`unknown kind "${file.kind}"`);
  if (!CATALOG_LANGS.includes(file.lang)) fail(`unknown lang "${file.lang}"`);
  if (expected?.kind && file.kind !== expected.kind) fail(`kind ${file.kind} (expected ${expected.kind})`);
  if (expected?.lang && file.lang !== expected.lang) fail(`lang ${file.lang} (expected ${expected.lang})`);

  const fields = CATALOG_FIELDS[file.kind as CatalogKind];
  if (fields && JSON.stringify(file.fields) !== JSON.stringify(fields)) fail(`fields ${JSON.stringify(file.fields)} do not match schema`);
  if (!Array.isArray(file.rows)) fail('rows is not an array');
  else {
    if (file.count !== file.rows.length) fail(`count ${file.count} but ${file.rows.length} rows`);
    // Truncation: the file must account for every entry PokeAPI reported.
    const accounted = file.rows.length + file.duplicates + file.excluded;
    if (file.kind !== 'pokemon' && accounted !== file.apiCount) {
      fail(`truncated: ${file.rows.length} rows + ${file.duplicates} duplicates + ${file.excluded} excluded != API count ${file.apiCount}`);
    }
    if (file.kind === 'pokemon' && file.rows.length < file.apiCount) {
      fail(`truncated: ${file.rows.length} rows < ${file.apiCount} species`);
    }
    if (file.rows.length === 0) fail('no rows');
    const seen = new Set<string>();
    const slugIdx = fields ? (fields as readonly string[]).indexOf('slug') : 0;
    for (const [i, row] of file.rows.entries()) {
      if (!Array.isArray(row) || row.length !== file.fields.length) {
        fail(`row ${i} has ${Array.isArray(row) ? row.length : 'no'} columns, expected ${file.fields.length}`);
        continue;
      }
      const slug = row[slugIdx];
      if (typeof slug !== 'string' || !slug) fail(`row ${i} has no slug`);
      else if (seen.has(slug)) fail(`duplicate slug "${slug}"`);
      else seen.add(slug);
      const nameIdx = (file.fields as readonly string[]).indexOf('name');
      if (typeof row[nameIdx] !== 'string' || !(row[nameIdx] as string).trim()) fail(`row ${i} ("${slug}") has an empty name`);
    }
  }
  if (problems.length) {
    throw new CatalogError(`Invalid ${file.kind}.${file.lang} catalog:\n - ${problems.slice(0, 20).join('\n - ')}${problems.length > 20 ? `\n - ...and ${problems.length - 20} more` : ''}`);
  }
}

const BOOLEAN_FIELDS = new Set(['hasSprite', 'mainSeries', 'form']);

export function toEntries<K extends CatalogKind>(file: CatalogFile<K>): EntryByKind[K][] {
  const fields = file.fields;
  return file.rows.map(
    (row) => Object.fromEntries(fields.map((f, i) => [f, BOOLEAN_FIELDS.has(f) ? Boolean(row[i]) : row[i]])) as unknown as EntryByKind[K]
  );
}

export function toRows<K extends CatalogKind>(kind: K, entries: readonly EntryByKind[K][]): unknown[][] {
  const fields = CATALOG_FIELDS[kind] as readonly string[];
  return entries.map((e) => fields.map((f) => {
    const value = (e as unknown as Record<string, unknown>)[f];
    // Booleans travel as 0/1: smaller, and stable in diffs.
    return typeof value === 'boolean' ? (value ? 1 : 0) : value;
  }));
}
