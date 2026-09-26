#!/usr/bin/env tsx
// scripts/generate-catalogs.ts
//
// Builds the compact, versioned catalogs in src/data/generated/ from PokeAPI:
//
//   moves.{es,en}.json  abilities.{es,en}.json  items.{es,en}.json
//   pokemon.{es,en}.json (species + forms, for search)
//   search-index.{es,en}.json (derived from the above, no extra requests)
//   manifest.json (counts, content hashes, generation date)
//
//   npm run data:catalogs                  -> fetch everything and rewrite the files
//   npm run data:catalogs -- --check       -> no writes: validate the committed files
//                                             and compare them with PokeAPI's live lists
//   npm run data:catalogs -- --only=moves,abilities
//   npm run data:catalogs -- --cache-dir=.cache/pokeapi   (reuse raw responses)
//
// Runs on demand, never at request time: ~4.5k requests (one per entity) at a
// bounded concurrency, a few minutes. Deterministic: entries are ordered by
// PokeAPI id and files carry no timestamp (only manifest.json does), so a
// second run against unchanged data rewrites identical bytes. It fails
// (exit 1, nothing written) if a list is truncated against its own `count`,
// a payload is unreadable, or a validation rule is broken.
// Source and process: docs/DATA_SOURCES.md ("Generated catalogs").

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  CATALOG_LANGS,
  CATALOG_SCHEMA,
  toRows,
  validateCatalog,
  CATALOG_FIELDS,
  type CatalogFile,
  type CatalogKind,
  type CatalogLang,
} from '../src/data/catalogs/schema';
import {
  applyOverrides,
  buildAbilityEntry,
  buildItemEntry,
  buildMoveEntry,
  buildPokemonEntries,
  idFromUrl,
  type CatalogOverrides,
  type RawAbility,
  type RawItem,
  type RawMove,
  type RawSpecies,
} from '../src/data/catalogs/build';
import { buildSearchIndex, validateSearchIndex } from '../src/data/catalogs/searchIndex';
import { isRealItem } from '../src/utils/pokemon';

const API = 'https://pokeapi.co/api/v2';
const OUT_DIR = new URL('../src/data/generated/', import.meta.url);
const OVERRIDES = new URL('../src/data/catalogOverrides.json', import.meta.url);
const CONCURRENCY = 12;
const SOURCE = 'PokeAPI v2 REST (https://pokeapi.co/api/v2)';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const CHECK = Boolean(flag('check'));
const CACHE_DIR = flag('cache-dir')?.split('=')[1];
const ONLY = new Set((flag('only')?.split('=')[1] ?? 'moves,abilities,items,pokemon').split(','));

const log = (msg: string) => console.log(msg);

async function getJson<T>(url: string): Promise<T> {
  const cachePath = CACHE_DIR ? `${CACHE_DIR}/${createHash('sha1').update(url).digest('hex')}.json` : null;
  if (cachePath && existsSync(cachePath)) return JSON.parse(await readFile(cachePath, 'utf8')) as T;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text) as T; // truncated / invalid JSON throws here and is retried
        if (cachePath) {
          await mkdir(CACHE_DIR!, { recursive: true });
          await writeFile(cachePath, text);
        }
        return data;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw new Error(`could not fetch ${url}: ${lastError}`);
}

async function pool<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

interface ListResult { apiCount: number; entries: { name: string; url: string }[]; duplicates: number }

/** Whole list in one request, verified against the API's own `count`, deduplicated, ordered by id. */
async function listResource(resource: string): Promise<ListResult> {
  const page = await getJson<{ count: number; next: string | null; results: { name: string; url: string }[] }>(`${API}/${resource}?limit=100000`);
  if (typeof page.count !== 'number' || !Array.isArray(page.results)) throw new Error(`${resource}: malformed list`);
  if (page.results.length < page.count) throw new Error(`${resource}: truncated list, ${page.results.length} of ${page.count}`);
  const seen = new Set<string>();
  const entries = page.results.filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)));
  entries.sort((a, b) => idFromUrl(a.url) - idFromUrl(b.url));
  return { apiCount: page.count, entries, duplicates: page.results.length - entries.length };
}

function makeFile<K extends CatalogKind>(kind: K, lang: CatalogLang, list: ListResult, excluded: number, entries: any[]): CatalogFile<K> {
  const file: CatalogFile<K> = {
    schema: CATALOG_SCHEMA,
    kind,
    lang,
    source: SOURCE,
    apiCount: list.apiCount,
    duplicates: list.duplicates,
    excluded,
    count: entries.length,
    fields: CATALOG_FIELDS[kind] as readonly string[],
    rows: toRows(kind, entries),
  };
  validateCatalog(file as CatalogFile);
  return file;
}

const serialize = (value: unknown) => JSON.stringify(value) + '\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

async function readCommitted(name: string): Promise<CatalogFile> {
  return JSON.parse(await readFile(new URL(name, OUT_DIR), 'utf8')) as CatalogFile;
}

async function check() {
  let stale = false;
  const fail = (msg: string) => { stale = true; console.error(`STALE: ${msg}`); };
  const lists: Record<string, ListResult> = {
    moves: await listResource('move'),
    abilities: await listResource('ability'),
    items: await listResource('item'),
    pokemon: await listResource('pokemon-species'),
  };
  const variants = await listResource('pokemon');
  for (const kind of ['moves', 'abilities', 'items', 'pokemon'] as const) {
    for (const lang of CATALOG_LANGS) {
      const file = await readCommitted(`${kind}.${lang}.json`);
      validateCatalog(file, { kind, lang }); // throws on a corrupt committed file
      const live = lists[kind];
      const liveNames = new Set(live.entries.filter((e) => kind !== 'items' || isRealItem(e.name)).map((e) => e.name));
      const have = new Set(file.rows.map((r) => r[0] as string));
      const missing = [...liveNames].filter((n) => !have.has(n));
      const gone = kind === 'pokemon' ? [] : [...have].filter((n) => !liveNames.has(n));
      if (file.apiCount !== live.apiCount) fail(`${kind}.${lang}: apiCount ${file.apiCount} vs live ${live.apiCount}`);
      if (missing.length) fail(`${kind}.${lang}: ${missing.length} missing (e.g. ${missing.slice(0, 3).join(', ')})`);
      if (gone.length) fail(`${kind}.${lang}: ${gone.length} no longer in PokeAPI (e.g. ${gone.slice(0, 3).join(', ')})`);
    }
  }
  const manifest = JSON.parse(await readFile(new URL('manifest.json', OUT_DIR), 'utf8'));
  if (manifest.counts.variantsApiCount !== variants.apiCount) fail(`pokemon list: ${manifest.counts.variantsApiCount} vs live ${variants.apiCount}`);
  for (const lang of CATALOG_LANGS) {
    const text = await readFile(new URL(`search-index.${lang}.json`, OUT_DIR), 'utf8');
    validateSearchIndex(JSON.parse(text));
    if (manifest.files[`search-index.${lang}.json`] !== sha(text)) fail(`search-index.${lang}.json does not match manifest hash`);
  }
  if (stale) {
    console.error('Run `npm run data:catalogs` to regenerate.');
    process.exit(1);
  }
  log('Catalogs are valid and match PokeAPI.');
}

async function generate() {
  const started = Date.now();
  const overrides = JSON.parse(await readFile(OVERRIDES, 'utf8')) as CatalogOverrides;
  const files: Record<string, string> = {};
  const counts: Record<string, number> = {};
  const load = async (name: string): Promise<CatalogFile> => JSON.parse(files[name] ?? (await readFile(new URL(name, OUT_DIR), 'utf8')));
  const emit = (name: string, file: unknown) => { files[name] = serialize(file); };

  if (ONLY.has('moves')) {
    const list = await listResource('move');
    log(`moves: ${list.entries.length} (API count ${list.apiCount})`);
    const raw = await pool(list.entries, (e) => getJson<RawMove>(e.url));
    for (const lang of CATALOG_LANGS) {
      emit(`moves.${lang}.json`, makeFile('moves', lang, list, 0, applyOverrides(raw.map((r) => buildMoveEntry(r, lang)), overrides.moves?.[lang])));
    }
  }
  if (ONLY.has('abilities')) {
    const list = await listResource('ability');
    log(`abilities: ${list.entries.length} (API count ${list.apiCount})`);
    const raw = await pool(list.entries, (e) => getJson<RawAbility>(e.url));
    for (const lang of CATALOG_LANGS) {
      emit(`abilities.${lang}.json`, makeFile('abilities', lang, list, 0, applyOverrides(raw.map((r) => buildAbilityEntry(r, lang)), overrides.abilities?.[lang])));
    }
  }
  if (ONLY.has('items')) {
    const list = await listResource('item');
    const real = list.entries.filter((e) => isRealItem(e.name));
    log(`items: ${real.length} real of ${list.entries.length} unique (API count ${list.apiCount})`);
    const raw = await pool(real, (e) => getJson<RawItem>(e.url));
    for (const lang of CATALOG_LANGS) {
      emit(`items.${lang}.json`, makeFile('items', lang, list, list.entries.length - real.length, applyOverrides(raw.map((r) => buildItemEntry(r, lang)), overrides.items?.[lang])));
    }
  }
  if (ONLY.has('pokemon')) {
    const list = await listResource('pokemon-species');
    log(`pokemon: ${list.entries.length} species (API count ${list.apiCount})`);
    const raw = await pool(list.entries, (e) => getJson<RawSpecies>(e.url));
    const variants = await listResource('pokemon');
    counts.variantsApiCount = variants.apiCount;
    for (const lang of CATALOG_LANGS) {
      emit(`pokemon.${lang}.json`, makeFile('pokemon', lang, list, 0, raw.flatMap((r) => buildPokemonEntries(r, lang))));
    }
  }

  // Derived, offline: the search index is built only from the catalogs above.
  const catalogs = {} as Record<CatalogLang, Record<CatalogKind, CatalogFile>>;
  for (const lang of CATALOG_LANGS) {
    catalogs[lang] = {} as Record<CatalogKind, CatalogFile>;
    for (const kind of ['moves', 'abilities', 'items', 'pokemon'] as const) catalogs[lang][kind] = await load(`${kind}.${lang}.json`);
  }
  for (const lang of CATALOG_LANGS) {
    const index = buildSearchIndex(lang, catalogs);
    validateSearchIndex(index);
    emit(`search-index.${lang}.json`, index);
  }

  const previous = existsSync(new URL('manifest.json', OUT_DIR)) ? JSON.parse(await readFile(new URL('manifest.json', OUT_DIR), 'utf8')) : { counts: {}, files: {} };
  const hashes: Record<string, string> = { ...previous.files };
  for (const [name, text] of Object.entries(files)) hashes[name] = sha(text);
  const changed = Object.keys(files).filter((n) => previous.files?.[n] !== hashes[n]);
  const manifest = {
    _note: 'Generated by scripts/generate-catalogs.ts. Do not edit by hand.',
    schema: CATALOG_SCHEMA,
    source: SOURCE,
    generatedAt: changed.length ? new Date().toISOString().slice(0, 10) : previous.generatedAt,
    counts: {
      ...previous.counts,
      ...counts,
      ...Object.fromEntries((['moves', 'abilities', 'items', 'pokemon'] as const).map((k) => [k, catalogs.es[k].count])),
    },
    files: Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))),
  };
  emit('manifest.json', manifest);

  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    await writeFile(new URL(name, OUT_DIR), text);
    log(`  ${name}: ${(text.length / 1024).toFixed(1)} KB${changed.includes(name) ? '' : ' (unchanged)'}`);
  }
  log(`done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

(CHECK ? check() : generate()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
