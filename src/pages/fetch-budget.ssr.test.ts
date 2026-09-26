import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Phase 5 fetch budgets: what a page requests from upstream, per render.
// (Measured before, cold: Pokémon 11-28 requests incl. two ~280 KB
// pokemon/{id} for prev/next; move/ability pages 41 requests / 7-12 MB for
// the Pokémon cards; item held-by 16 requests / 4 MB.)

const API = 'https://pokeapi.co/api/v2';
const DEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';

const stats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } }));
const sprites = { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } };
const pokemon = (id: number, name: string) => ({
  id, name, is_default: true, height: 10, weight: 100,
  species: { name, url: `${API}/pokemon-species/${id}/` },
  types: [{ slot: 1, type: { name: 'water', url: '' } }], stats,
  abilities: [], moves: [], sprites,
});

const HOLDERS = Array.from({ length: 30 }, (_, i) => ({ name: `mon${i + 1}`, url: `${API}/pokemon/${i + 1}/` }));
const SPECIES = {
  count: 30,
  next: null,
  results: HOLDERS.map((h, i) => ({ name: h.name, url: `${API}/pokemon-species/${i + 1}/` })),
};
const DEX = Object.fromEntries(HOLDERS.map((h) => [h.name, { types: ['Water'], baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 }, tier: 'OU', abilities: { 0: 'Torrent' } }]));

const ROUTES: Record<string, unknown> = {
  '/pokemon/mon10': pokemon(10, 'mon10'),
  '/pokemon-species/10': {
    name: 'mon10', names: [], flavor_text_entries: [{ flavor_text: 'x', language: { name: 'es' } }],
    evolution_chain: { url: `${API}/evolution-chain/1/` }, generation: { name: 'generation-i', url: `${API}/generation/1/` },
    varieties: [{ is_default: true, pokemon: { name: 'mon10', url: `${API}/pokemon/10/` } }],
  },
  '/evolution-chain/1': { chain: { species: { name: 'mon10', url: `${API}/pokemon-species/10/` }, evolution_details: [], evolves_to: [] } },
  '/ability?limit=100000': { count: 1, next: null, results: [{ name: 'torrent', url: `${API}/ability/67/` }] },
  '/ability/torrent': { name: 'torrent', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] },
  '/pokemon-species?limit=100000': SPECIES,
  '/move/surf': {
    id: 57, name: 'surf', names: [], type: { name: 'water' }, damage_class: { name: 'special' }, power: 90, accuracy: 100, pp: 15, priority: 0,
    flavor_text_entries: [], learned_by_pokemon: HOLDERS,
  },
  '/item/mystic-water': {
    id: 1, name: 'mystic-water', names: [], category: { name: 'held-items' }, attributes: [], machines: [], effect_entries: [], flavor_text_entries: [],
    sprites: { default: 'x' }, held_by_pokemon: HOLDERS.map((h) => ({ pokemon: h })),
  },
  '/ability/torrent-holders': { name: 'torrent-holders', names: [], flavor_text_entries: [], effect_entries: [], pokemon: HOLDERS.map((h) => ({ pokemon: h, is_hidden: false, slot: 1 })) },
};

let calls: string[] = [];
function stub(opts: { dex: boolean } = { dex: true }) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const path = url.replace(API, '').replace(/\/$/, '');
      const body = url === DEX_URL ? (opts.dex ? DEX : undefined) : ROUTES[path];
      if (body === undefined) return { ok: false, status: url === DEX_URL ? 503 : 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
    })
  );
}

const cardFetches = () => calls.filter((u) => /\/pokemon\/\d+\/?$/.test(u));

// `warm`: Showdown's pokedex already cached in the isolate (after any Pokémon /
// type / generation page), which is when the card list can skip PokeAPI.
async function page(file: string, pattern: string, params: Record<string, string>, path: string, warm = false) {
  vi.resetModules();
  if (warm) await (await import('../services/smogon')).getSmogonDataBatch([]);
  const Page = (await import(/* @vite-ignore */ file)).default;
  const { renderRoute: r } = await import('../testing/renderRoute');
  return r(Page, { routePattern: pattern, params, path });
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetch budgets (SSR)', () => {
  it('move page, warm isolate: 30 learned-by cards cost 0 pokemon/{id} requests, and all 30 are linked', async () => {
    stub();
    const res = await page('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/', true);
    expect(res.status).toBe(200);
    expect(cardFetches()).toEqual([]);
    const html = await res.text();
    const links = new Set([...html.matchAll(/href="(\/es\/pokemon\/mon\d+\/)"/g)].map((m) => m[1]));
    expect(links.size).toBe(30);
    expect(calls.filter((u) => !u.includes('/pokemon/'))).toHaveLength(3); // pokedex (warm-up), move, species list
  });

  it('move page, warm isolate: tier badges are server-rendered (no client pokedex download needed)', async () => {
    stub();
    const raw = await (await page('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/', true)).text();
    const html = raw.replace(/ data-astro-source-(?:file|loc)="[^"]*"/g, ''); // dev-only attributes
    expect(html.match(/<div class="tier-badge">\s*<span[^>]*>OU<\/span>/g)).toHaveLength(30);
    expect(html).not.toMatch(/data-tier-for="/); // (the loader script still names the selector)
  });

  it('move page, COLD isolate: tier badges stay client-filled', async () => {
    stub();
    for (const h of HOLDERS) ROUTES[`/pokemon/${h.url.split('/').slice(-2)[0]}`] ??= pokemon(Number(h.url.split('/').slice(-2)[0]), h.name);
    const html = await (await page('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/')).text();
    expect(html.match(/data-tier-for="mon\d+"/g)).toHaveLength(30);
  });

  it('move page, COLD isolate: does not wait on Showdown — same PokeAPI cards as before', async () => {
    stub();
    for (const h of HOLDERS) ROUTES[`/pokemon/${h.url.split('/').slice(-2)[0]}`] ??= pokemon(Number(h.url.split('/').slice(-2)[0]), h.name);
    const res = await page('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');
    expect(res.status).toBe(200);
    expect(calls).not.toContain(DEX_URL);
    expect(cardFetches()).toHaveLength(30);
  });

  it('move page with Showdown DOWN still renders the cards (per-Pokémon fallback, as before)', async () => {
    stub({ dex: false });
    for (const h of HOLDERS) ROUTES[`/pokemon/${h.url.split('/').slice(-2)[0]}`] ??= pokemon(Number(h.url.split('/').slice(-2)[0]), h.name);
    const res = await page('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');
    expect(res.status).toBe(200);
    expect(cardFetches().length).toBe(30);
    expect(new Set([...(await res.text()).matchAll(/href="(\/es\/pokemon\/mon\d+\/)"/g)].map((m) => m[1])).size).toBe(30);
  });

  it('item page, warm isolate: held-by (limit 15) costs 0 pokemon/{id} requests', async () => {
    stub();
    const res = await page('./[lang]/objetos/[name].astro', '/[lang]/objetos/[name]', { lang: 'es', name: 'mystic-water' }, '/es/objetos/mystic-water/', true);
    expect(res.status).toBe(200);
    expect(cardFetches()).toEqual([]);
    const links = new Set([...(await res.text()).matchAll(/href="(\/es\/pokemon\/mon\d+\/)"/g)].map((m) => m[1]));
    expect(links.size).toBe(15);
  });

  it('Pokémon page: prev/next come from the species list (no pokemon/{id} fetch for them), no URL is requested twice', async () => {
    stub();
    const res = await page('./[lang]/pokemon/[name].astro', '/[lang]/pokemon/[name]', { lang: 'es', name: 'mon10' }, '/es/pokemon/mon10/');
    expect(res.status).toBe(200);
    expect(cardFetches()).toEqual([]); // the page itself is fetched by slug, so no numeric pokemon/{id} at all
    expect(calls.filter((u) => u === `${API}/pokemon/9` || u === `${API}/pokemon/11`)).toEqual([]);
    const html = await res.text();
    expect(html).toContain('href="/es/pokemon/mon9/"');
    expect(html).toContain('href="/es/pokemon/mon11/"');
    expect(new Set(calls).size).toBe(calls.length);
  });

  it('Pokémon page: the Showdown dataset is requested once per render', async () => {
    stub();
    await page('./[lang]/pokemon/[name].astro', '/[lang]/pokemon/[name]', { lang: 'es', name: 'mon10' }, '/es/pokemon/mon10/');
    expect(calls.filter((u) => u === DEX_URL)).toHaveLength(1);
  });

  it('Pokémon page: no species list -> no navigation block, still 200 (optional enrichment)', async () => {
    stub();
    const saved = ROUTES['/pokemon-species?limit=100000'];
    delete ROUTES['/pokemon-species?limit=100000'];
    try {
      const res = await page('./[lang]/pokemon/[name].astro', '/[lang]/pokemon/[name]', { lang: 'es', name: 'mon10' }, '/es/pokemon/mon10/');
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain('href="/es/pokemon/mon9/"');
    } finally {
      ROUTES['/pokemon-species?limit=100000'] = saved;
    }
  });
});
