import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ItemPage from './[lang]/objetos/[name].astro';
import { SITE_URL } from '../utils/seo';
import { renderRoute } from '../testing/renderRoute';

// Phase 4: item pages — robots by policy, canonical, localized factual meta,
// machine -> move (latest version group), placeholders never shown, and the
// items index linking the complete catalog.

const API = 'https://pokeapi.co/api/v2';

function pokemonDetail(id: number, name: string) {
  return {
    id,
    name,
    height: 10,
    weight: 100,
    species: { name, url: `${API}/pokemon-species/${id}/` },
    types: [{ slot: 1, type: { name: 'normal', url: `${API}/type/1/` } }],
    stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } })),
    abilities: [],
    moves: [],
    sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
  };
}

const HOLDERS = Array.from({ length: 20 }, (_, i) => ({ pokemon: { name: `holder${i}`, url: `${API}/pokemon/${800 + i}/` } }));

const es = (name: string) => ({ name, language: { name: 'es' } });
const en = (name: string) => ({ name, language: { name: 'en' } });
const flavor = (lang: string, text: string) => ({ text, language: { name: lang }, version_group: { name: 'sword-shield' } });

function moveFixture(name: string, esName: string, enName: string) {
  return {
    id: 1,
    name,
    names: [{ name: esName, language: { name: 'es' } }, { name: enName, language: { name: 'en' } }],
    type: { name: 'grass' },
    damage_class: { name: 'special' },
    power: 90,
    accuracy: 100,
    pp: 10,
    priority: 0,
    flavor_text_entries: [],
    learned_by_pokemon: [],
  };
}

const item = (over: Record<string, unknown>) => ({
  id: 1,
  category: { name: 'held-items' },
  cost: undefined,
  fling_power: null,
  attributes: [],
  machines: [],
  held_by_pokemon: [],
  effect_entries: [],
  flavor_text_entries: [],
  names: [],
  sprites: { default: 'https://x/item.png' },
  ...over,
});

const FIXTURES: Record<string, unknown> = {
  '/item?limit=1': { count: 5, next: null, results: [{ name: 'leftovers', url: `${API}/item/211/` }] },
  '/item?limit=5': {
    count: 5,
    next: null,
    results: ['leftovers', 'dynamax-crystal-and15', 'tm26', 'oran-en-only', 'psyduck-down'].map((name, i) => ({ name, url: `${API}/item/${i + 1}/` })),
  },
  '/item/leftovers': item({
    name: 'leftovers',
    names: [es('Restos'), en('Leftovers')],
    attributes: [{ name: 'holdable' }],
    fling_power: 10,
    flavor_text_entries: [flavor('es', 'Restaura PS cada turno.'), flavor('en', 'Restores HP every turn.')],
    held_by_pokemon: HOLDERS,
  }),
  '/item/211': 'alias:/item/leftovers',
  // Placeholder text on every field (real PokeAPI shape of the 300 dynamax crystals).
  '/item/dynamax-crystal-and15': item({
    name: 'dynamax-crystal-and15',
    category: { name: 'dynamax-crystals' },
    names: [es('★And15'), en('★And15')],
    sprites: { default: null },
    flavor_text_entries: [flavor('es', 'Posibilita la aparición de [VAR (0000)] en el nido'), flavor('en', 'An item that causes [VAR (0000)] to appear')],
  }),
  // Effect only in English: the Spanish meta must be factual Spanish, not that English text.
  '/item/oran-en-only': item({
    name: 'oran-en-only',
    category: { name: 'medicine' },
    names: [es('Baya Prueba'), en('Test Berry')],
    attributes: [{ name: 'consumable' }],
    effect_entries: [{ effect: 'Restores 10 HP.', short_effect: 'Restores 10 HP.', language: { name: 'en' } }],
  }),
  '/item/psyduck-down': item({
    name: 'psyduck-down',
    category: { name: 'tm-materials' },
    names: [es('Plumón de Psyduck'), en('Psyduck Down')],
    sprites: { default: null },
  }),
  // machines[0] is the OLDEST version group; the latest must win.
  '/item/tm26': item({
    name: 'tm26',
    category: { name: 'all-machines' },
    names: [es('MT26'), en('TM26')],
    flavor_text_entries: [flavor('es', 'Texto de otra generación.')],
    machines: [
      { machine: { url: `${API}/machine/1/` }, version_group: { name: 'red-blue' } },
      { machine: { url: `${API}/machine/3/` }, version_group: { name: 'legends-za' } },
      { machine: { url: `${API}/machine/2/` }, version_group: { name: 'scarlet-violet' } },
    ],
  }),
  '/machine/1': { move: { name: 'karate-chop', url: `${API}/move/karate-chop/` } },
  '/machine/2': { move: { name: 'earthquake', url: `${API}/move/earthquake/` } },
  '/machine/3': { move: { name: 'energy-ball', url: `${API}/move/energy-ball/` } },
  '/move/karate-chop': moveFixture('karate-chop', 'Golpe Kárate', 'Karate Chop'),
  '/move/earthquake': moveFixture('earthquake', 'Terremoto', 'Earthquake'),
  '/move/energy-ball': moveFixture('energy-ball', 'Energibola', 'Energy Ball'),
};
HOLDERS.forEach((_, i) => {
  FIXTURES[`/pokemon/${800 + i}`] = pokemonDetail(800 + i, `holder${i}`);
});

function fixtureFor(url: string): unknown {
  const path = url.replace(API, '').replace(/\/$/, '');
  const hit = FIXTURES[path];
  if (typeof hit === 'string' && hit.startsWith('alias:')) return FIXTURES[hit.slice('alias:'.length)];
  return hit;
}

let fetchCalls: string[] = [];
function mockFetch() {
  fetchCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      fetchCalls.push(url);
      const data = fixtureFor(url);
      if (data === undefined) {
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
    })
  );
}

async function renderItem(lang: string, name: string) {
  return renderRoute(ItemPage, { routePattern: '/[lang]/objetos/[name]', params: { lang, name }, path: `/${lang}/objetos/${name}/` });
}

const meta = (html: string, name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];
const canonicalOf = (html: string) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

describe('item robots policy (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  for (const lang of ['es', 'en']) {
    it(`(${lang}) a noindex-policy item is still a 200 page: robots noindex,follow, self canonical, no placeholder shown`, async () => {
      const response = await renderItem(lang, 'dynamax-crystal-and15');
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(meta(html, 'robots')).toBe('noindex,follow');
      expect(canonicalOf(html)).toBe(`${SITE_URL}/${lang}/objetos/dynamax-crystal-and15/`);
      expect(html).not.toContain('[VAR');
      expect(html).not.toContain('nofollow');
    });

    it(`(${lang}) an indexable item has no robots meta (default index,follow) and a self canonical`, async () => {
      const html = await (await renderItem(lang, 'leftovers')).text();
      expect(meta(html, 'robots')).toBeUndefined();
      expect(canonicalOf(html)).toBe(`${SITE_URL}/${lang}/objetos/leftovers/`);
    });
  }

  it('the name-only family member is noindex too (tm-materials)', async () => {
    const html = await (await renderItem('en', 'psyduck-down')).text();
    expect(meta(html, 'robots')).toBe('noindex,follow');
  });

  it('numeric ids still 301 to the canonical slug (Phase 2 unchanged)', async () => {
    const response = await renderItem('es', '211');
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/es/objetos/leftovers/');
  });

  it('a missing item is a real 404', async () => {
    expect((await renderItem('es', 'does-not-exist')).status).toBe(404);
  });
});

describe('item metadata (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('ES / EN: own title and real localized text led by the item name', async () => {
    const esHtml = await (await renderItem('es', 'leftovers')).text();
    expect(titleOf(esHtml)).toBe('Restos — Objeto Pokémon | Pokepedia.app');
    expect(meta(esHtml, 'description')).toBe('Restos: Restaura PS cada turno.');
    const enHtml = await (await renderItem('en', 'leftovers')).text();
    expect(titleOf(enHtml)).toBe('Leftovers — Pokémon Item | Pokepedia.app');
    expect(meta(enHtml, 'description')).toBe('Leftovers: Restores HP every turn.');
    expect(esHtml).not.toContain('Tu enciclopedia Pokémon técnica y definitiva.');
  });

  it('ES page whose only real text is English: Spanish factual meta + visible sentence, English text kept in the body with its notice', async () => {
    const html = await (await renderItem('es', 'oran-en-only')).text();
    const description = meta(html, 'description')!;
    expect(description).toBe('Baya Prueba es un objeto Pokémon de la categoría Medicina. Propiedades: Consumible.');
    expect(description).not.toContain('Restores');
    // The meta sentence is on the page (no SEO-only content).
    expect(html).toMatch(/data-item-summary[^>]*>\s*Baya Prueba es un objeto Pokémon de la categoría Medicina\./);
    // Real (English) effect is still shown, flagged as such.
    expect(html).toContain('Restores 10 HP.');
    expect(html).toContain('PokeAPI no ofrece este texto en español');
  });

  it('EN page with an English effect uses it', async () => {
    const html = await (await renderItem('en', 'oran-en-only')).text();
    expect(meta(html, 'description')).toBe('Test Berry: Restores 10 HP.');
  });

  it('an item with nothing but a name and category gets a factual sentence, not the "no effect available" box', async () => {
    const html = await (await renderItem('en', 'psyduck-down')).text();
    expect(meta(html, 'description')).toBe('Psyduck Down is a Pokémon item in the TM Materials category.');
    expect(html).not.toContain('No detailed effect available');
  });

  it('held-by counter shows the real total and says how many are shown', async () => {
    const html = await (await renderItem('en', 'leftovers')).text();
    expect(html).toMatch(/>20<\/span>/);
    expect(html).toContain('Showing 15');
  });
});

describe('machine items -> moves (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('teaches the move of the LATEST version group (not machines[0]), with a canonical move link', async () => {
    const es = await (await renderItem('es', 'tm26')).text();
    expect(es).toContain('href="/es/movimientos/energy-ball/"');
    expect(es).not.toContain('/movimientos/karate-chop/');
    expect(es).not.toContain('/movimientos/earthquake/');
    expect(titleOf(es)).toBe('MT26 (Energibola) — Máquina técnica Pokémon | Pokepedia.app');
    expect(meta(es, 'description')).toBe('MT26 es una máquina técnica que enseña Energibola en Leyendas Pokémon: Z-A.');
    // The item's own (other-generation) text is not shown next to the machine fact.
    expect(es).not.toContain('Texto de otra generación.');
    const en = await (await renderItem('en', 'tm26')).text();
    expect(en).toContain('href="/en/movimientos/energy-ball/"');
    expect(meta(en, 'description')).toBe('TM26 is a Technical Machine that teaches Energy Ball in Pokémon Legends: Z-A.');
  });

  it('costs one machine + one move request, as before (bounded)', async () => {
    // pokeapi.ts caches per module instance: load fresh ones so the calls are observable.
    vi.resetModules();
    const Fresh = (await import('./[lang]/objetos/[name].astro')).default;
    const { renderRoute: freshRender } = await import('../testing/renderRoute');
    await freshRender(Fresh, { routePattern: '/[lang]/objetos/[name]', params: { lang: 'es', name: 'tm26' }, path: '/es/objetos/tm26/' });
    const machineCalls = fetchCalls.filter((u) => u.includes('/machine/') || u.includes('/move/'));
    expect(machineCalls).toEqual([`${API}/machine/3/`, `${API}/move/energy-ball/`]);
  });

  it('the linked move page answers 200', async () => {
    const MovePage = (await import('./[lang]/movimientos/[name].astro')).default;
    const response = await renderRoute(MovePage, {
      routePattern: '/[lang]/movimientos/[name]',
      params: { lang: 'es', name: 'energy-ball' },
      path: '/es/movimientos/energy-ball/',
    });
    expect(response.status).toBe(200);
  });
});

describe('items index (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  async function renderIndex(lang: string) {
    vi.resetModules(); // fresh pokeapi.ts cache, so the list requests are observable
    const Index = (await import('./[lang]/objetos/index.astro')).default;
    const container = await AstroContainer.create();
    return container.renderToString(Index, { params: { lang }, request: new Request(`${SITE_URL}/${lang}/objetos/`) });
  }

  for (const lang of ['es', 'en']) {
    it(`(${lang}) links the COMPLETE catalog with real anchors — noindex items included (SEO policy != product visibility) — using one list fetch`, async () => {
      const html = await renderIndex(lang);
      const hrefs = [...html.matchAll(new RegExp(`<a[^>]*href="(/${lang}/objetos/[^"/]+/)"`, 'g'))].map((m) => m[1]);
      expect([...new Set(hrefs)].sort()).toEqual(
        ['leftovers', 'dynamax-crystal-and15', 'tm26', 'oran-en-only', 'psyduck-down'].sort().map((s) => `/${lang}/objetos/${s}/`)
      );
      hrefs.forEach((h) => expect(h).not.toMatch(/\/\d+\/$/));
      // No per-item request at SSR time: only the two catalog list calls.
      expect(fetchCalls.filter((u) => u.includes('/item/'))).toEqual([]);
      expect(fetchCalls.filter((u) => u.includes('/item?'))).toHaveLength(2);
      expect(meta(html, 'description')).toBeTruthy();
      expect(meta(html, 'description')).not.toContain('Tu enciclopedia');
      expect(meta(html, 'robots')).toBeUndefined();
    });
  }
});
