#!/usr/bin/env tsx
// scripts/generate-catalogs.ts
//
// Builds the compact, versioned catalogs in src/data/generated/ from PokeAPI:
//
//   moves.{es,en}.json  abilities.{es,en}.json  items.{es,en}.json
//   pokemon.{es,en}.json (species + forms, for search)
//   search-index.{es,en}.json (derived from the above, no extra requests)
//   machines.json (move -> [item, version group] pairs, language-independent:
//     labels are joined at runtime from items.{lang}.json / versionGroups.ts)
//   learnsets/{move}.json + learnsets/manifest.json (move -> Pokémon learnset
//     relations, inverted offline from pokemon/{id}.moves — opt-in, see below)
//   manifest.json (counts, content hashes, generation date)
//
//   npm run data:catalogs                  -> fetch everything (except
//                                             move-learnsets, see below) and
//                                             rewrite the files
//   npm run data:catalogs -- --check       -> no writes: validate the committed files
//                                             and compare them with PokeAPI's live lists
//   npm run data:catalogs -- --only=moves,abilities
//   npm run data:catalogs -- --only=move-learnsets   -> NOT in the default set:
//                                             ~1351 full pokemon/{id} fetches,
//                                             much slower than everything else
//                                             here combined. Run explicitly.
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
import { LEARN_METHOD_ORDER, learnMethodIndex } from '../src/utils/moveLearnMethods';
import { VERSION_GROUP_ORDER, versionGroupRank } from '../src/services/versionGroups';

const API = 'https://pokeapi.co/api/v2';
const OUT_DIR = new URL('../src/data/generated/', import.meta.url);
const OVERRIDES = new URL('../src/data/catalogOverrides.json', import.meta.url);
const CONCURRENCY = 12;
const SOURCE = 'PokeAPI v2 REST (https://pokeapi.co/api/v2)';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const CHECK = Boolean(flag('check'));
const CACHE_DIR = flag('cache-dir')?.split('=')[1];
const ONLY = new Set((flag('only')?.split('=')[1] ?? 'moves,abilities,items,pokemon,machines').split(','));

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
  {
    // Lightweight (count only, not a full re-fetch of all 2372 machines):
    // same cost profile as the other lists' checks above.
    const liveMachineCount = (await getJson<{ count: number }>(`${API}/machine?limit=1`)).count;
    const machinesFile = JSON.parse(await readFile(new URL('machines.json', OUT_DIR), 'utf8'));
    if (machinesFile.apiCount !== liveMachineCount) fail(`machines: apiCount ${machinesFile.apiCount} vs live ${liveMachineCount}`);
  }
  if (existsSync(new URL('learnsets/manifest.json', OUT_DIR))) {
    // Lightweight: the pokemon list count only, not a full re-fetch of
    // ~1351 full pokemon/{id} objects (that's what --only=move-learnsets
    // is for). Detects "PokeAPI added/removed a Pokémon" staleness, not
    // "a Pokémon's learnset itself changed" — the latter needs a real run.
    const learnsetManifest = JSON.parse(await readFile(new URL('learnsets/manifest.json', OUT_DIR), 'utf8'));
    if (learnsetManifest.apiCount !== variants.apiCount) fail(`learnsets: apiCount ${learnsetManifest.apiCount} vs live ${variants.apiCount}`);
  }
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

interface MachineRaw {
  move: { url: string };
  item: { url: string };
  version_group: { url: string };
}

/**
 * `move -> [itemSlug, versionGroupSlug][]` (MT/MO/TR availability per game),
 * built from PokeAPI's `/machine` resource — the only place this
 * relationship exists; a move's own `machines` field lists only machine
 * *ids*, not the item/version-group slugs a page can render, so resolving
 * it at request time would mean fetching every one of a move's machines
 * (up to a few dozen) on every page view. Generated once, offline, like
 * every other catalog.
 *
 * `/machine/{id}` responses reference `move`/`item`/`version_group` by
 * numeric-id URL, not by slug: the three `/…?limit=100000` list requests
 * below build id -> slug maps (one request each, reused for every one of
 * the 2372 machine detail requests) rather than guessing a slug from an id.
 */
async function buildMachines(): Promise<{ apiCount: number; count: number; byMove: Record<string, [string, string][]> }> {
  const [moveList, itemList, vgList] = await Promise.all([
    listResource('move'),
    listResource('item'),
    listResource('version-group'),
  ]);
  const slugById = (list: ListResult) => new Map(list.entries.map((e) => [idFromUrl(e.url), e.name]));
  const moveById = slugById(moveList);
  const itemById = slugById(itemList);
  const vgById = slugById(vgList);

  const total = (await getJson<{ count: number }>(`${API}/machine?limit=1`)).count;
  const ids = Array.from({ length: total }, (_, i) => i + 1);
  const raw = await pool(ids, (id) => getJson<MachineRaw>(`${API}/machine/${id}/`));

  const byMove: Record<string, [string, string][]> = {};
  let resolved = 0;
  for (const m of raw) {
    const move = moveById.get(idFromUrl(m.move.url));
    const item = itemById.get(idFromUrl(m.item.url));
    const versionGroup = vgById.get(idFromUrl(m.version_group.url));
    if (!move || !item || !versionGroup) continue; // unresolved id: skip, never guessed
    (byMove[move] ??= []).push([item, versionGroup]);
    resolved++;
  }
  return { apiCount: total, count: resolved, byMove };
}

interface RawPokemonMoves {
  id: number;
  moves: {
    move: { name: string };
    version_group_details: { level_learned_at: number; move_learn_method: { name: string }; version_group: { name: string } }[];
  }[];
}

/** [methodIndex, versionGroupIndex] or [methodIndex, versionGroupIndex, level] (level only for 'level-up' — every other method is always level 0 in PokeAPI, verified live). */
type LearnsetRow = [number, number] | [number, number, number];

/**
 * Move -> Pokémon learnset relations, inverted from PokeAPI's own
 * Pokémon -> moves direction (`pokemon/{id}.moves`) — the only place this
 * data exists; there is no `move/{x}/learned-by-detailed` endpoint. Full
 * detail objects for all ~1351 Pokémon (species + forms) are fetched once
 * here, offline; a move page's runtime cost is a single small JSON import
 * (see services/moveLearnsets.ts), never a fetch fan-out.
 *
 * One file per move (`learnsets/{move}.json`), not one giant file: measured
 * live (2026-09-27) against real data — 638,321 raw relations across 833
 * moves, 5.4 MB raw / ~0.59 MB gzip as a single file vs. 5.4 MB raw /
 * ~0.69 MB gzip summed across 833 per-move files. A single file would be
 * imported (parsed) by every move page for data ~830x pages don't need;
 * per-move files cost a page only its own move — a few KB gzip even for
 * the busiest ones (`rest`: 96 KB raw / 6.9 KB gzip for 1275 Pokémon).
 * Moves nothing learns (some Z-moves/signature moves) get no file.
 */
async function buildMoveLearnsets(): Promise<{ apiCount: number; files: Record<string, unknown>; moveCount: number; relationCount: number }> {
  const list = await listResource('pokemon');
  log(`move-learnsets: fetching ${list.entries.length} pokemon (full detail — this is the slow one)`);
  let done = 0;
  const details = await pool(list.entries, async (e) => {
    const d = await getJson<RawPokemonMoves>(e.url);
    done++;
    if (done % 200 === 0) log(`  ${done}/${list.entries.length}`);
    return d;
  });

  const byMove = new Map<string, Record<string, LearnsetRow[]>>();
  let relationCount = 0;
  for (const p of details) {
    for (const m of p.moves) {
      let rows = byMove.get(m.move.name);
      if (!rows) { rows = {}; byMove.set(m.move.name, rows); }
      const out: LearnsetRow[] = [];
      for (const v of m.version_group_details) {
        const method = v.move_learn_method.name;
        const mi = learnMethodIndex(method);
        const vgi = versionGroupRank(v.version_group.name);
        if (mi < 0) throw new Error(`move-learnsets: unknown learn method "${method}" (${p.id}/${m.move.name}) — add it to LEARN_METHOD_ORDER`);
        if (vgi < 0) throw new Error(`move-learnsets: unknown version group "${v.version_group.name}" (${p.id}/${m.move.name}) — add it to VERSION_GROUP_ORDER`);
        if (method === 'level-up') {
          if (v.level_learned_at < 0) throw new Error(`move-learnsets: negative level (${p.id}/${m.move.name}/${v.version_group.name})`);
          out.push([mi, vgi, v.level_learned_at]);
        } else {
          out.push([mi, vgi]);
        }
        relationCount++;
      }
      rows[String(p.id)] = out;
    }
  }

  const files: Record<string, unknown> = {};
  const moveNames = [...byMove.keys()].sort();
  for (const move of moveNames) {
    files[`learnsets/${move}.json`] = { schema: 1, move, byPokemon: byMove.get(move) };
  }
  files['learnsets/manifest.json'] = {
    schema: 1,
    source: `${SOURCE} (pokemon/{id}.moves, inverted offline)`,
    apiCount: list.apiCount,
    pokemonFetched: details.length,
    moveCount: moveNames.length,
    relationCount,
    methods: LEARN_METHOD_ORDER,
    versionGroups: VERSION_GROUP_ORDER,
    moves: moveNames,
  };
  return { apiCount: list.apiCount, files, moveCount: moveNames.length, relationCount };
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

  if (ONLY.has('machines')) {
    const machines = await buildMachines();
    log(`machines: ${machines.count} of ${machines.apiCount}, ${Object.keys(machines.byMove).length} moves`);
    counts.machines = machines.count;
    // No timestamp in the file itself (only manifest.json carries one) so a
    // re-run against unchanged data rewrites identical bytes, like every
    // other catalog.
    emit('machines.json', {
      schema: 1,
      source: 'PokeAPI v2 (/machine)',
      apiCount: machines.apiCount,
      count: machines.count,
      byMove: machines.byMove,
    });
  }

  // Opt-in only (not in the default ONLY set): ~1351 full pokemon/{id}
  // fetches, much slower than every other kind here. Run explicitly with
  // `--only=move-learnsets`; never implied by a plain `npm run data:catalogs`.
  if (ONLY.has('move-learnsets')) {
    const learnsets = await buildMoveLearnsets();
    log(`move-learnsets: ${learnsets.moveCount} moves, ${learnsets.relationCount} relations, ${learnsets.apiCount} pokemon`);
    counts.learnsetMoves = learnsets.moveCount;
    counts.learnsetRelations = learnsets.relationCount;
    await mkdir(new URL('learnsets/', OUT_DIR), { recursive: true });
    for (const [name, data] of Object.entries(learnsets.files)) emit(name, data);
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
  let learnsetBytes = 0, learnsetFiles = 0;
  for (const [name, text] of Object.entries(files)) {
    await writeFile(new URL(name, OUT_DIR), text);
    if (name.startsWith('learnsets/')) { learnsetBytes += text.length; learnsetFiles++; continue; } // one summary line below instead of 800+
    log(`  ${name}: ${(text.length / 1024).toFixed(1)} KB${changed.includes(name) ? '' : ' (unchanged)'}`);
  }
  if (learnsetFiles) log(`  learnsets/: ${learnsetFiles} files, ${(learnsetBytes / 1024 / 1024).toFixed(2)} MB total`);
  log(`done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

(CHECK ? check() : generate()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
