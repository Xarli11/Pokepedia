// src/data/catalogs/searchIndex.ts
//
// Compact per-language index behind the global search (all entity kinds),
// derived offline from the generated catalogs + the static type/generation
// tables. One file per language, loaded lazily by the browser on the first
// search — never one request per keystroke.
//
// Row = [code, slug, name, id, extra, aliases?]
//   code     p pokemon (species or form) · m move · a ability · i item · t type · g generation
//   slug     URL segment (generation: the number)
//   name     name in the index language
//   id       Pokémon: dex number (species) / PokeAPI id >= 10000 (form); generation: number; else 0
//   extra    move: type slug · item: super-category slug · generation: region name · else ''
//   aliases  other names it can be found by (the other language's name), omitted when none

import { GENERATION_ROMAN, GENERATIONS } from '../../services/pokeapi';
import { typeTranslations } from '../../utils/pokemon';
import { normalizeSearchText } from '../../utils/searchText';
import { CODE_TYPE, SEARCH_INDEX_SCHEMA, SEARCH_TYPES, TYPE_CODE, type SearchIndexFile, type SearchRow, type SearchType } from '../../utils/searchTypes';
import {
  CATALOG_LANGS,
  toEntries,
  type AbilityEntry,
  type CatalogFile,
  type CatalogKind,
  type CatalogLang,
  type ItemEntry,
  type MoveEntry,
  type PokemonEntry,
} from './schema';

/** Main region of each generation, per language (PokeAPI region names). */
const REGIONS_EN: Record<string, string> = {
  gen1: 'Kanto', gen2: 'Johto', gen3: 'Hoenn', gen4: 'Sinnoh', gen5: 'Unova', gen6: 'Kalos', gen7: 'Alola', gen8: 'Galar', gen9: 'Paldea',
};
export { SEARCH_INDEX_SCHEMA };
export const generationRegion = (genKey: string, lang: CatalogLang): string =>
  lang === 'en' ? REGIONS_EN[genKey] : GENERATIONS[genKey].region;

type Catalogs = Record<CatalogLang, Record<CatalogKind, CatalogFile>>;

/** Other-language names worth searching by: only when they differ once normalized. */
function aliasesFor(name: string, others: (string | undefined)[]): string[] {
  const own = normalizeSearchText(name);
  const out: string[] = [];
  for (const o of others) {
    if (!o) continue;
    const n = normalizeSearchText(o);
    if (n && n !== own && !out.some((x) => normalizeSearchText(x) === n)) out.push(o);
  }
  return out;
}

const byName = <T extends { slug: string }>(entries: T[]) => new Map(entries.map((e) => [e.slug, e]));

export function buildSearchIndex(lang: CatalogLang, catalogs: Catalogs): SearchIndexFile {
  const other = CATALOG_LANGS.find((l) => l !== lang)!;
  const rows: SearchRow[] = [];
  const push = (code: string, slug: string, name: string, id: number, extra: string, aliases: string[]) =>
    rows.push(aliases.length ? [code, slug, name, id, extra, aliases] : [code, slug, name, id, extra]);

  const pokemon = toEntries(catalogs[lang].pokemon as CatalogFile<'pokemon'>);
  const pokemonOther = byName<PokemonEntry>(toEntries(catalogs[other].pokemon as CatalogFile<'pokemon'>));
  for (const p of pokemon) push('p', p.slug, p.name, p.id, '', aliasesFor(p.name, [pokemonOther.get(p.slug)?.name]));

  const moves = toEntries(catalogs[lang].moves as CatalogFile<'moves'>);
  const movesOther = byName<MoveEntry>(toEntries(catalogs[other].moves as CatalogFile<'moves'>));
  for (const m of moves) push('m', m.slug, m.name, 0, m.type, aliasesFor(m.name, [movesOther.get(m.slug)?.name]));

  const abilities = toEntries(catalogs[lang].abilities as CatalogFile<'abilities'>);
  const abilitiesOther = byName<AbilityEntry>(toEntries(catalogs[other].abilities as CatalogFile<'abilities'>));
  for (const a of abilities) push('a', a.slug, a.name, 0, '', aliasesFor(a.name, [abilitiesOther.get(a.slug)?.name]));

  const items = toEntries(catalogs[lang].items as CatalogFile<'items'>);
  const itemsOther = byName<ItemEntry>(toEntries(catalogs[other].items as CatalogFile<'items'>));
  for (const i of items) push('i', i.slug, i.name, 0, i.superCategory, aliasesFor(i.name, [itemsOther.get(i.slug)?.name]));

  for (const slug of Object.keys(typeTranslations[lang])) {
    push('t', slug, typeTranslations[lang][slug], 0, '', aliasesFor(typeTranslations[lang][slug], [typeTranslations[other][slug]]));
  }

  const genWord = { es: 'Generación', en: 'Generation' } as const;
  for (const [key, roman] of Object.entries(GENERATION_ROMAN)) {
    const n = Number(key.slice(3));
    push('g', String(n), `${genWord[lang]} ${roman}`, n, generationRegion(key, lang), [
      // regions by name, both languages ("sinnoh", "teselia" / "unova"), and "gen 4" / "generación 4" spellings
      ...aliasesFor(generationRegion(key, lang), [generationRegion(key, other)]),
      generationRegion(key, lang),
      `${genWord.es} ${n}`, `${genWord.en} ${n}`, `Gen ${n}`, `Gen${n}`, `${genWord[other]} ${roman}`,
    ].filter((v, i, a) => a.indexOf(v) === i));
  }

  const counts = Object.fromEntries(SEARCH_TYPES.map((t) => [t, rows.filter((r) => r[0] === TYPE_CODE[t]).length])) as Record<SearchType, number>;
  return { schema: SEARCH_INDEX_SCHEMA, lang, counts, rows };
}

export function validateSearchIndex(index: SearchIndexFile): void {
  const problems: string[] = [];
  if (index.schema !== SEARCH_INDEX_SCHEMA) problems.push(`schema ${index.schema}`);
  if (!CATALOG_LANGS.includes(index.lang)) problems.push(`lang ${index.lang}`);
  const seen = new Set<string>();
  const perType = Object.fromEntries(SEARCH_TYPES.map((t) => [t, 0])) as Record<SearchType, number>;
  for (const [i, row] of index.rows.entries()) {
    const type = CODE_TYPE[row[0]];
    if (!type) { problems.push(`row ${i}: unknown code "${row[0]}"`); continue; }
    if (!row[1] || !row[2]?.trim()) problems.push(`row ${i}: empty slug/name`);
    const key = `${row[0]}:${row[1]}`;
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
    perType[type]++;
  }
  for (const t of SEARCH_TYPES) {
    if (perType[t] !== index.counts[t]) problems.push(`counts.${t} = ${index.counts[t]} but ${perType[t]} rows`);
    if (perType[t] === 0) problems.push(`no ${t} entries`);
  }
  if (problems.length) throw new Error(`Invalid search index (${index.lang}):\n - ${problems.slice(0, 20).join('\n - ')}`);
}
