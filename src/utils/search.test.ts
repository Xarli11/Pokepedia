import { describe, it, expect } from 'vitest';
import esIndex from '../data/generated/search-index.es.json';
import enIndex from '../data/generated/search-index.en.json';
import { entityHref, prepareIndex, search, MIN_QUERY_LENGTH } from './search';
import { normalizeSearchText } from './searchText';
import type { SearchIndexFile } from './searchTypes';

const es = prepareIndex(esIndex as unknown as SearchIndexFile);
const en = prepareIndex(enIndex as unknown as SearchIndexFile);
const top = (p: typeof es, q: string, lang: string) => search(p, q, lang)[0];

describe('normalizeSearchText', () => {
  it('ignores case, accents, hyphens, dots, apostrophes and repeated spaces', () => {
    expect(normalizeSearchText('Piel  Tosca')).toBe('piel tosca');
    expect(normalizeSearchText('piel-tosca')).toBe('piel tosca');
    expect(normalizeSearchText('Dragón')).toBe('dragon');
    expect(normalizeSearchText('Mr. Mime')).toBe('mr mime');
    expect(normalizeSearchText('Farfetch’d')).toBe('farfetchd');
    expect(normalizeSearchText('Nidoran♀')).toBe('nidoran f');
    expect(normalizeSearchText('  Flabébé ')).toBe('flabebe');
  });
});

describe('global search: examples from the product brief (real generated index)', () => {
  it('Pokémon by name and by dex number', () => {
    expect(top(es, 'garchomp', 'es')).toMatchObject({ type: 'pokemon', slug: 'garchomp', name: 'Garchomp', id: 445 });
    for (const q of ['445', '#445', '0445', '#0445']) expect(top(es, q, 'es')).toMatchObject({ type: 'pokemon', slug: 'garchomp' });
  });

  it('moves in both languages', () => {
    expect(top(es, 'terremoto', 'es')).toMatchObject({ type: 'move', slug: 'earthquake', name: 'Terremoto' });
    expect(top(en, 'earthquake', 'en')).toMatchObject({ type: 'move', slug: 'earthquake', name: 'Earthquake' });
  });

  it('abilities in both languages', () => {
    expect(top(es, 'piel tosca', 'es')).toMatchObject({ type: 'ability', slug: 'rough-skin', name: 'Piel Tosca' });
    expect(top(en, 'rough skin', 'en')).toMatchObject({ type: 'ability', slug: 'rough-skin', name: 'Rough Skin' });
  });

  it('items', () => {
    expect(top(en, 'choice scarf', 'en')).toMatchObject({ type: 'item', slug: 'choice-scarf', name: 'Choice Scarf' });
    expect(top(es, 'choice scarf', 'es')).toMatchObject({ type: 'item', slug: 'choice-scarf' }); // English name works as an alias in ES
    expect(top(es, 'pañuelo elección', 'es')).toMatchObject({ type: 'item', slug: 'choice-scarf' });
  });

  it('types, accent-insensitive', () => {
    expect(top(es, 'dragón', 'es')).toMatchObject({ type: 'type', slug: 'dragon', name: 'Dragón' });
    expect(top(es, 'dragon', 'es')).toMatchObject({ type: 'type', slug: 'dragon' });
    expect(top(en, 'dragon', 'en')).toMatchObject({ type: 'type', slug: 'dragon' });
  });

  it('generations by region and by number', () => {
    expect(top(es, 'sinnoh', 'es')).toMatchObject({ type: 'generation', slug: '4', name: 'Generación IV' });
    expect(top(en, 'unova', 'en')).toMatchObject({ type: 'generation', slug: '5', name: 'Generation V' });
    expect(top(es, 'teselia', 'es')).toMatchObject({ type: 'generation', slug: '5' });
    expect(top(es, 'gen 4', 'es')).toMatchObject({ type: 'generation', slug: '4' });
    expect(top(es, 'generación iv', 'es')).toMatchObject({ type: 'generation', slug: '4' });
  });

  it('a mixed query returns several kinds, each labelled by type, one page per kind', () => {
    const kinds = new Set(search(es, 'sand', 'es', { limit: 30 }).map((r) => r.type));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('forms are findable, and word order does not matter', () => {
    expect(search(en, 'mega charizard', 'en').map((r) => r.slug)).toContain('charizard-mega-x');
    expect(search(es, 'charizard mega', 'es').map((r) => r.slug)).toContain('charizard-mega-y');
  });

  it('every result links to the entity\'s canonical page (trailing slash, lang prefix)', () => {
    const hrefs = search(es, 'garchomp', 'es', { limit: 50, perType: 50 }).map((r) => r.href);
    expect(hrefs.length).toBeGreaterThan(1);
    for (const h of hrefs) expect(h).toMatch(/^\/es\/[a-z]+\/[a-z0-9-]+\/$/);
    expect(entityHref('en', 'move', 'earthquake')).toBe('/en/movimientos/earthquake/');
    expect(entityHref('es', 'ability', 'rough-skin')).toBe('/es/habilidades/rough-skin/');
    expect(entityHref('es', 'item', 'choice-scarf')).toBe('/es/objetos/choice-scarf/');
    expect(entityHref('es', 'type', 'dragon')).toBe('/es/tipo/dragon/');
    expect(entityHref('es', 'generation', '4')).toBe('/es/generacion/4/');
    expect(entityHref('en', 'pokemon', 'garchomp')).toBe('/en/pokemon/garchomp/');
  });

  it('is deterministic', () => {
    expect(search(es, 'de', 'es')).toEqual(search(es, 'de', 'es'));
  });
});

// A tiny synthetic index makes each ranking tier explicit.
const row = (code: string, slug: string, name: string, id = 0, extra = '', aliases?: string[]) => (aliases ? [code, slug, name, id, extra, aliases] : [code, slug, name, id, extra]);
const synthetic = prepareIndex({
  schema: 1, lang: 'en', counts: { pokemon: 0, move: 0, ability: 0, item: 0, type: 0, generation: 0 },
  rows: [
    row('m', 'fire-fang-x', 'Fire Fang X'),         // contains "fang"... word-prefix
    row('a', 'fang', 'Fang'),                       // exact
    row('p', 'fangor', 'Fangor', 700),              // prefix
    row('i', 'wolf-tooth', 'Wolf Tooth', 0, '', ['fang stone']), // alias prefix
    row('i', 'oldfang', 'Oldfang'),                 // contains
    row('p', 'sabre', 'Sabre', 44),                 // dex number
    row('p', 'sabre-mega', 'Sabre (Mega)', 10044),  // form: never matched by number
  ],
} as unknown as SearchIndexFile);

describe('ranking tiers', () => {
  it('exact > prefix > alias > word start > contains', () => {
    const r = search(synthetic, 'fang', 'en', { perType: 10 });
    expect(r.map((x) => x.slug)).toEqual(['fang', 'fangor', 'wolf-tooth', 'fire-fang-x', 'oldfang']);
    expect(r.map((x) => x.score)).toEqual([100, 80, 60, 55, 40]);
  });

  it('exact dex number outranks text and only species match by number', () => {
    const r = search(synthetic, '44', 'en');
    expect(r[0]).toMatchObject({ slug: 'sabre', score: 95 });
    expect(r.some((x) => x.slug === 'sabre-mega')).toBe(false);
  });

  it('caps each kind so one kind cannot fill the list', () => {
    const many = prepareIndex({
      schema: 1, lang: 'en', counts: { pokemon: 0, move: 0, ability: 0, item: 0, type: 0, generation: 0 },
      rows: [...Array.from({ length: 20 }, (_, i) => row('i', `ball-${i}`, `Ball ${i}`)), row('m', 'ball-toss', 'Ball Toss')],
    } as unknown as SearchIndexFile);
    const r = search(many, 'ball', 'en', { perType: 5 });
    expect(r.filter((x) => x.type === 'item')).toHaveLength(5);
    expect(r.some((x) => x.type === 'move')).toBe(true);
  });

  it('ignores queries shorter than the minimum', () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(search(es, 'g', 'es')).toEqual([]);
    expect(search(es, '  ', 'es')).toEqual([]);
    expect(search(es, 'zzzzzzzzqq', 'es')).toEqual([]);
  });
});
