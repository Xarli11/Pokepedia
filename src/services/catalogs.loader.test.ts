import { describe, it, expect } from 'vitest';
import { getAbilityCatalog, getCatalog, getItemCatalog, getMoveCatalog } from './catalogs';

describe('catalog loader', () => {
  it('serves each language as a slug-keyed Map, memoized', async () => {
    const es = await getMoveCatalog('es');
    expect(es.get('earthquake')?.name).toBe('Terremoto');
    expect((await getMoveCatalog('en')).get('earthquake')?.name).toBe('Earthquake');
    expect(await getMoveCatalog('es')).toBe(es);
    expect((await getAbilityCatalog('en')).get('rough-skin')?.name).toBe('Rough Skin');
    expect((await getItemCatalog('es')).get('choice-scarf')?.name).toBe('Pañuelo Elección');
  });

  it('unknown languages use Spanish, like the rest of the site', async () => {
    expect(await getCatalog('moves', 'fr')).toBe(await getCatalog('moves', 'es'));
  });

  it('returns typed booleans', async () => {
    const item = (await getItemCatalog('es')).get('choice-scarf')!;
    expect(item.hasSprite).toBe(true);
    expect((await getAbilityCatalog('es')).get('rough-skin')!.mainSeries).toBe(true);
  });
});
