import { describe, it, expect } from 'vitest';
import manifest from '../data/itemSeoManifest.json';
import { indexableItems, isItemIndexable, itemNoindexReason, itemRobots } from './itemIndexing';
import { buildSitemapXml } from '../pages/sitemap.xml';

const noindex = manifest.noindex as Record<string, string>;
const slugs = Object.keys(noindex);

describe('item indexing manifest (snapshot of scripts/item-seo-manifest.ts)', () => {
  it('is internally consistent', () => {
    expect(manifest.noindexCount).toBe(slugs.length);
    expect(manifest.pokeapiItemCount).toBeGreaterThan(2200);
    for (const reason of Object.values(noindex)) expect(reason.length).toBeGreaterThan(10);
  });

  it('noindexes the 300 dynamax crystals: one identical "[VAR (0000)]" text, "★" internal names, no sprite/relations', () => {
    const dynamax = slugs.filter((s) => s.startsWith('dynamax-crystal-'));
    expect(dynamax).toHaveLength(300);
    expect(noindex['dynamax-crystal-and15']).toMatch(/placeholder text only/);
  });

  it('noindexes the name-only families: tm-materials, picnic, sandwich-ingredients, tera shards', () => {
    expect(itemNoindexReason('psyduck-down')).toMatch(/tm-materials/);
    expect(itemNoindexReason('academy-bottle')).toMatch(/picnic/);
    expect(itemNoindexReason('baguette')).toMatch(/sandwich-ingredients/);
    expect(itemNoindexReason('normal-tera-shard')).toMatch(/tera-shard/);
  });

  it('keeps TMs, TRs, HMs and data cards indexable (historical hypothesis was wrong for them)', () => {
    expect(slugs.filter((s) => /^(tm|tr|hm)\d+$/.test(s) || s.startsWith('data-card-'))).toEqual([]);
    expect(isItemIndexable('tm26')).toBe(true);
    expect(isItemIndexable('tr01')).toBe(true);
    expect(isItemIndexable('data-card-01')).toBe(true);
  });

  it('keeps well-known entities indexable, including thin ones inside documented families', () => {
    for (const slug of ['leftovers', 'choice-scarf', 'master-ball', 'potion', 'rare-candy', 'fire-stone', 'life-orb', 'focus-sash', 'booster-energy', 'ability-shield']) {
      expect(isItemIndexable(slug), slug).toBe(true);
    }
  });

  it('every game-variant duplicate points at a primary that stays indexable', () => {
    const variants = Object.entries(noindex).filter(([, r]) => r.startsWith('duplicate-name-variant of '));
    expect(variants.length).toBeGreaterThan(50);
    for (const [slug, reason] of variants) {
      const primary = reason.replace('duplicate-name-variant of ', '');
      expect(isItemIndexable(primary), `${slug} -> ${primary}`).toBe(true);
    }
    expect(noindex['laultra-ball']).toBe('duplicate-name-variant of ultra-ball');
  });

  it('robots value: noindex,follow only for manifest slugs; nothing (default indexable) otherwise', () => {
    expect(itemRobots('dynamax-crystal-and15')).toBe('noindex,follow');
    expect(itemRobots('leftovers')).toBeUndefined();
  });
});

describe('sitemap item selection', () => {
  it('contains indexable items and excludes noindex ones, in both languages', () => {
    const xml = buildSitemapXml([], [], [], [{ name: 'leftovers' }, { name: 'dynamax-crystal-and15' }, { name: 'tm26' }, { name: 'psyduck-down' }]);
    for (const lang of ['es', 'en']) {
      expect(xml).toContain(`https://pokepedia.app/${lang}/objetos/leftovers/`);
      expect(xml).toContain(`https://pokepedia.app/${lang}/objetos/tm26/`);
      expect(xml).not.toContain(`/${lang}/objetos/dynamax-crystal-and15/`);
      expect(xml).not.toContain(`/${lang}/objetos/psyduck-down/`);
    }
  });

  it('indexableItems never keeps a slug the page would mark noindex', () => {
    const all = [{ name: 'leftovers' }, ...slugs.map((name) => ({ name }))];
    expect(indexableItems(all).map((i) => i.name)).toEqual(['leftovers']);
  });
});
