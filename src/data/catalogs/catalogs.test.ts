import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  CATALOG_KINDS, CATALOG_LANGS, CatalogError, toEntries, toRows, validateCatalog,
  type CatalogFile, type CatalogKind, type CatalogLang,
} from './schema';
import {
  applyOverrides, buildAbilityEntry, buildItemEntry, buildMoveEntry, buildPokemonEntries,
  generationNumber, pickDescription, resolveName, summarize, DESCRIPTION_MAX,
} from './build';
import { buildSearchIndex, validateSearchIndex } from './searchIndex';

const GENERATED = new URL('../generated/', import.meta.url);
const readText = (name: string) => readFileSync(new URL(name, GENERATED), 'utf8');
const readJson = <T,>(name: string) => JSON.parse(readText(name)) as T;
const catalog = (kind: CatalogKind, lang: CatalogLang) => readJson<CatalogFile>(`${kind}.${lang}.json`);

const name = (n: string, language: string) => ({ name: n, language: { name: language } });

describe('catalog builders (pure)', () => {
  it('generationNumber reads roman numerals', () => {
    expect(generationNumber('generation-i')).toBe(1);
    expect(generationNumber('generation-ix')).toBe(9);
    expect(generationNumber(undefined)).toBe(0);
  });

  it('resolveName: requested language, then English, then a formatted slug', () => {
    expect(resolveName([name('Terremoto', 'es'), name('Earthquake', 'en')], 'es', 'earthquake')).toBe('Terremoto');
    expect(resolveName([name('Dire Claw', 'en')], 'es', 'dire-claw')).toBe('Dire Claw');
    expect(resolveName([], 'en', 'dire-claw')).toBe('Dire Claw');
    expect(resolveName(undefined, 'es', 'x')).toBe('X');
  });

  it('summarize never exceeds the cap, cuts on a word and marks the cut', () => {
    const long = 'Este ataque hace muchísimo daño al rival y además le deja algo debilitado durante varios turnos seguidos sin más';
    const s = summarize(long);
    expect(s.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(s.endsWith('…')).toBe(true);
    expect(long.startsWith(s.slice(0, -1))).toBe(true);
    expect(summarize('  corto \n texto ')).toBe('corto texto');
  });

  it('moves keep the fields the index shows; missing power/accuracy stay null', () => {
    const m = buildMoveEntry({
      name: 'swords-dance', names: [name('Danza Espada', 'es')], type: { name: 'normal' }, damage_class: { name: 'status' },
      power: null, accuracy: null, pp: 20, priority: 0, generation: { name: 'generation-i' },
    }, 'es');
    expect(m).toEqual({ slug: 'swords-dance', name: 'Danza Espada', type: 'normal', damageClass: 'status', power: null, accuracy: null, pp: 20, priority: 0, generation: 1 });
  });

  it('descriptions: requested language first, English fallback is labelled', () => {
    const raw = {
      name: 'x', names: [], generation: { name: 'generation-iii' }, is_main_series: true,
      flavor_text_entries: [{ flavor_text: 'Only in English.', language: { name: 'en' }, version_group: { name: 'sword-shield' } }],
      effect_entries: [],
    };
    expect(buildAbilityEntry(raw, 'es')).toMatchObject({ description: 'Only in English.', descriptionLang: 'en' });
    expect(buildAbilityEntry(raw, 'en')).toMatchObject({ description: 'Only in English.', descriptionLang: 'en' });
    expect(buildAbilityEntry({ ...raw, flavor_text_entries: [], effect_entries: [] }, 'es')).toMatchObject({ description: '', descriptionLang: '' });
  });

  it('descriptions use the newest known version group, whatever the array order', () => {
    const flavor = [
      { flavor_text: 'newest', language: { name: 'en' }, version_group: { name: 'scarlet-violet' } },
      { flavor_text: 'oldest', language: { name: 'en' }, version_group: { name: 'red-blue' } },
      { flavor_text: 'middle', language: { name: 'en' }, version_group: { name: 'x-y' } },
    ];
    expect(pickDescription({ flavor, entityType: 'ability' }, 'en')?.text).toBe('newest');
    expect(pickDescription({ flavor: [...flavor].reverse(), entityType: 'ability' }, 'en')?.text).toBe('newest');
  });

  it('items: the evidence-backed Spanish x-y corruption is never used, placeholders are dropped', () => {
    const item = {
      name: 'assault-vest', names: [name('Chaleco Asalto', 'es')], category: { name: 'held-items' }, sprites: { default: 'https://x/y.png' },
      flavor_text_entries: [
        { text: 'TEXTO DE OTRO OBJETO', language: { name: 'es' }, version_group: { name: 'x-y' } },
        { text: 'Unknown.', language: { name: 'en' }, version_group: { name: 'sword-shield' } },
      ],
      effect_entries: [{ effect: 'Raises Sp. Def.', short_effect: 'Raises Sp. Def.', language: { name: 'en' } }],
    };
    const es = buildItemEntry(item, 'es');
    expect(es.description).toBe('Raises Sp. Def.');
    expect(es.descriptionLang).toBe('en');
    expect(es).toMatchObject({ category: 'held-items', superCategory: 'held-items', hasSprite: true });
    expect(buildItemEntry({ ...item, sprites: { default: null } }, 'es').hasSprite).toBe(false);
  });

  it('Pokémon: species row plus one row per non-default form, named in the page language', () => {
    const rows = buildPokemonEntries({
      id: 6, name: 'charizard', names: [name('Charizard', 'es')], generation: { name: 'generation-i' },
      varieties: [
        { is_default: true, pokemon: { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon/6/' } },
        { is_default: false, pokemon: { name: 'charizard-mega-x', url: 'https://pokeapi.co/api/v2/pokemon/10034/' } },
        { is_default: false, pokemon: { name: 'charizard-gmax', url: 'https://pokeapi.co/api/v2/pokemon/10196/' } },
      ],
    }, 'es');
    expect(rows).toEqual([
      { slug: 'charizard', id: 6, name: 'Charizard', generation: 1, form: false },
      { slug: 'charizard-mega-x', id: 10034, name: 'Charizard (Mega X)', generation: 1, form: true },
      { slug: 'charizard-gmax', id: 10196, name: 'Charizard (Gigamax)', generation: 1, form: true },
    ]);
  });

  it('overrides replace only what they name, and only for that slug', () => {
    const out = applyOverrides([{ slug: 'a', name: 'A' }, { slug: 'b', name: 'B' }], { b: { name: 'Bee' } });
    expect(out).toEqual([{ slug: 'a', name: 'A' }, { slug: 'b', name: 'Bee' }]);
    expect(applyOverrides([{ slug: 'a', name: 'A' }], undefined)).toEqual([{ slug: 'a', name: 'A' }]);
  });

  it('booleans travel as 0/1 and come back as booleans', () => {
    const rows = toRows('pokemon', [{ slug: 'x', id: 1, name: 'X', generation: 1, form: true }]);
    expect(rows).toEqual([['x', 1, 'X', 1, 1]]);
    const file = { schema: 1, kind: 'pokemon', lang: 'es', source: '', apiCount: 1, duplicates: 0, excluded: 0, count: 1, fields: ['slug', 'id', 'name', 'generation', 'form'], rows } as CatalogFile<'pokemon'>;
    expect(toEntries(file)[0].form).toBe(true);
  });
});

describe('validateCatalog fails clearly on bad data', () => {
  const good = (): CatalogFile<'abilities'> => ({
    schema: 1, kind: 'abilities', lang: 'es', source: 's', apiCount: 3, duplicates: 1, excluded: 0, count: 2,
    fields: ['slug', 'name', 'description', 'descriptionLang', 'generation', 'mainSeries'],
    rows: [['a', 'A', 'd', 'es', 1, 1], ['b', 'B', '', '', 1, 1]],
  });

  it('accepts a complete file', () => expect(() => validateCatalog(good(), { kind: 'abilities', lang: 'es' })).not.toThrow());

  it.each([
    ['a truncated list (fewer rows than the API count)', (f: CatalogFile) => { f.rows.pop(); f.count = 1; }, /truncated/],
    ['a count that disagrees with the rows', (f: CatalogFile) => { f.count = 5; }, /count 5 but 2 rows/],
    ['a duplicated slug', (f: CatalogFile) => { f.rows[1][0] = 'a'; }, /duplicate slug "a"/],
    ['an empty name', (f: CatalogFile) => { f.rows[0][1] = '  '; }, /empty name/],
    ['a row with the wrong number of columns', (f: CatalogFile) => { f.rows[0].pop(); }, /columns/],
    ['a different schema version', (f: CatalogFile) => { (f as any).schema = 2; }, /schema 2/],
    ['renamed fields', (f: CatalogFile) => { (f as any).fields = ['slug']; }, /fields/],
    ['no rows at all', (f: CatalogFile) => { f.rows = []; f.count = 0; f.apiCount = 0; f.duplicates = 0; }, /no rows/],
  ])('rejects %s', (_label, mutate, pattern) => {
    const f = good() as CatalogFile;
    mutate(f);
    expect(() => validateCatalog(f)).toThrow(CatalogError);
    expect(() => validateCatalog(f)).toThrow(pattern);
  });

  it('rejects the wrong kind or language for the file slot', () => {
    expect(() => validateCatalog(good(), { lang: 'en' })).toThrow(/lang es \(expected en\)/);
    expect(() => validateCatalog(good(), { kind: 'moves' })).toThrow(/kind abilities/);
  });
});

describe('committed catalogs (src/data/generated)', () => {
  const manifest = readJson<{ counts: Record<string, number>; files: Record<string, string> }>('manifest.json');
  const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

  for (const kind of CATALOG_KINDS) {
    for (const lang of CATALOG_LANGS) {
      it(`${kind}.${lang}.json validates, is complete against its API count, and matches the manifest`, () => {
        const file = catalog(kind, lang);
        validateCatalog(file, { kind, lang });
        expect(file.count).toBe(manifest.counts[kind]);
        expect(sha(readText(`${kind}.${lang}.json`))).toBe(manifest.files[`${kind}.${lang}.json`]);
      });
    }
  }

  it('both languages describe the same entities in the same order', () => {
    for (const kind of CATALOG_KINDS) {
      expect(catalog(kind, 'es').rows.map((r) => r[0])).toEqual(catalog(kind, 'en').rows.map((r) => r[0]));
    }
  });

  it('every entity page can be reached: known entries with real, localized data', () => {
    const moves = toEntries(catalog('moves', 'es') as CatalogFile<'moves'>);
    expect(moves.find((m) => m.slug === 'earthquake')).toMatchObject({ name: 'Terremoto', type: 'ground', damageClass: 'physical', power: 100, accuracy: 100, pp: 10, priority: 0, generation: 1 });
    expect(toEntries(catalog('moves', 'es') as CatalogFile<'moves'>).length).toBeGreaterThan(900);
    const abilities = toEntries(catalog('abilities', 'es') as CatalogFile<'abilities'>);
    expect(abilities.find((a) => a.slug === 'rough-skin')).toMatchObject({ name: 'Piel Tosca', descriptionLang: 'es' });
    const items = toEntries(catalog('items', 'en') as CatalogFile<'items'>);
    expect(items.find((i) => i.slug === 'choice-scarf')).toMatchObject({ name: 'Choice Scarf', superCategory: 'held-items', hasSprite: true });
    expect(items.length).toBeGreaterThan(2000);
    const pokemon = toEntries(catalog('pokemon', 'es') as CatalogFile<'pokemon'>);
    expect(pokemon.find((p) => p.slug === 'garchomp')).toMatchObject({ id: 445, generation: 4, form: false });
    expect(pokemon.filter((p) => !p.form).length).toBeGreaterThanOrEqual(1025);
  });

  it('no description is longer than the cap, and a cut is always marked', () => {
    for (const kind of ['abilities', 'items'] as const) {
      for (const e of toEntries(catalog(kind, 'es') as CatalogFile<'items'>)) {
        expect(e.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(e.description).not.toMatch(/\[VAR|XXX|^Unknown\.$/);
        expect(Boolean(e.description)).toBe(e.descriptionLang !== '');
      }
    }
  });

  for (const lang of CATALOG_LANGS) {
    it(`search-index.${lang}.json is valid, complete for every entity kind and exactly what the catalogs produce`, () => {
      const onDisk = readJson<ReturnType<typeof buildSearchIndex>>(`search-index.${lang}.json`);
      validateSearchIndex(onDisk);
      const catalogs = Object.fromEntries(CATALOG_LANGS.map((l) => [l, Object.fromEntries(CATALOG_KINDS.map((k) => [k, catalog(k, l)]))])) as any;
      expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildSearchIndex(lang, catalogs)))); // nobody hand-edited it
      expect(onDisk.counts.move).toBe(manifest.counts.moves);
      expect(onDisk.counts.ability).toBe(manifest.counts.abilities);
      expect(onDisk.counts.item).toBe(manifest.counts.items);
      expect(onDisk.counts.pokemon).toBe(manifest.counts.pokemon);
      expect(onDisk.counts.type).toBe(18);
      expect(onDisk.counts.generation).toBe(9);
      expect(sha(readText(`search-index.${lang}.json`))).toBe(manifest.files[`search-index.${lang}.json`]);
    });
  }

  it('the index stays compact (bundled, downloaded once per language)', () => {
    for (const lang of CATALOG_LANGS) expect(readText(`search-index.${lang}.json`).length).toBeLessThan(400_000);
  });
});
