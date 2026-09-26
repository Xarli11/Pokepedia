import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fault injection across the whole SSR path (page -> services -> middleware):
// every upstream fault kind x every dependency role. The contract (Phase 2,
// unchanged by Phase 5):
//   required dependency fails (timeout / network / 429 / 5xx / bad JSON)
//     -> 503 + Retry-After + no-store, NEVER a 200 with missing required data;
//   optional enrichment fails -> 200 (degraded), the entity is still there;
//   primary entity does not exist -> 404.

const API = 'https://pokeapi.co/api/v2';
const DEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';
const SETS_URL = 'https://pkmn.github.io/smogon/data/sets/gen9ou.json';

const stats = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } }));
const sprites = { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } };
const mon = (id: number, name: string) => ({
  id, name, is_default: true, height: 10, weight: 100,
  species: { name, url: `${API}/pokemon-species/${id}/` },
  types: [{ slot: 1, type: { name: 'water', url: '' } }], stats,
  abilities: [{ ability: { name: 'torrent', url: `${API}/ability/67/` }, is_hidden: false, slot: 1 }],
  moves: [{ move: { name: 'surf', url: `${API}/move/57/` }, version_group_details: [{ level_learned_at: 0, move_learn_method: { name: 'machine' }, version_group: { name: 'red-blue' } }] }],
  sprites,
});

const OK: Record<string, unknown> = {
  [`${API}/pokemon/feraligatr`]: mon(160, 'feraligatr'),
  [`${API}/pokemon-species/160/`]: {
    name: 'feraligatr', names: [], flavor_text_entries: [{ flavor_text: 'x', language: { name: 'es' } }],
    evolution_chain: { url: `${API}/evolution-chain/74/` }, generation: { name: 'generation-ii', url: `${API}/generation/2/` },
    varieties: [
      { is_default: true, pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } },
      { is_default: false, pokemon: { name: 'feraligatr-mega', url: `${API}/pokemon/10300/` } },
    ],
  },
  [`${API}/evolution-chain/74/`]: { chain: { species: { name: 'totodile', url: '' }, evolution_details: [], evolves_to: [] } },
  [`${API}/ability?limit=100000`]: { count: 1, next: null, results: [{ name: 'torrent', url: `${API}/ability/67/` }] },
  [`${API}/ability/67/`]: { name: 'torrent', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] },
  [`${API}/ability/torrent`]: { name: 'torrent', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] },
  [`${API}/pokemon/10300/`]: { ...mon(10300, 'feraligatr-mega'), is_default: false },
  [`${API}/pokemon-species?limit=100000`]: {
    count: 3, next: null,
    results: [{ name: 'croconaw', url: `${API}/pokemon-species/159/` }, { name: 'feraligatr', url: `${API}/pokemon-species/160/` }, { name: 'sentret', url: `${API}/pokemon-species/161/` }],
  },
  [DEX_URL]: { feraligatr: { tier: 'PU', types: ['Water'], baseStats: { hp: 85, atk: 105, def: 100, spa: 79, spd: 83, spe: 78 }, abilities: { 0: 'Torrent' } } },
  [SETS_URL]: { Feraligatr: { 'Dragon Dance': { moves: ['Waterfall'], ability: 'Sheer Force', item: 'Life Orb', nature: 'Adamant' } } },
  [`${API}/move/surf`]: {
    id: 57, name: 'surf', names: [], type: { name: 'water' }, damage_class: { name: 'special' }, power: 90, accuracy: 100, pp: 15, priority: 0,
    flavor_text_entries: [], learned_by_pokemon: [{ name: 'feraligatr', url: `${API}/pokemon/160/` }],
  },
  [`${API}/pokemon/160/`]: mon(160, 'feraligatr'),
};

type Fault = { name: string; apply: () => Response | Promise<Response> };
const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, headers: new Headers(), json: async () => body }) as unknown as Response;
const FAULTS: Fault[] = [
  { name: 'timeout', apply: () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); } },
  { name: 'network error', apply: () => { throw new TypeError('fetch failed'); } },
  { name: 'HTTP 429', apply: () => res(429) },
  { name: 'HTTP 500', apply: () => res(500) },
  { name: 'HTTP 503', apply: () => res(503) },
  { name: 'invalid JSON', apply: () => ({ ok: true, status: 200, headers: new Headers(), json: async () => { throw new SyntaxError('Unexpected token <'); }, text: async () => '<html>' }) as unknown as Response },
];

let faultOn: ((url: string) => boolean) | null = null;
let fault: Fault | null = null;

function stub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (fault && faultOn?.(url)) return fault.apply();
      const body = OK[url];
      if (body === undefined) return res(404);
      return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
    })
  );
}

async function render(file: string, pattern: string, params: Record<string, string>, path: string) {
  vi.resetModules(); // fresh in-memory caches: each case starts cold
  const Page = (await import(/* @vite-ignore */ file)).default;
  const { renderRoute } = await import('../testing/renderRoute');
  return renderRoute(Page, { routePattern: pattern, params, path });
}
const pokemonPage = () => render('./[lang]/pokemon/[name].astro', '/[lang]/pokemon/[name]', { lang: 'es', name: 'feraligatr' }, '/es/pokemon/feraligatr/');
const movePage = () => render('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');

function expect503(r: Response) {
  expect(r.status).toBe(503);
  expect(r.headers.get('Retry-After')).toBe('60');
  expect(r.headers.get('Cache-Control')).toBe('no-store');
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stub();
});
afterEach(() => {
  fault = null;
  faultOn = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('baseline: every fixture resolves', () => {
  it('Pokémon page 200 with moves, sets and navigation', async () => {
    const r = await pokemonPage();
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('id="movesTableBody"');
    expect(html).toContain('href="/es/pokemon/croconaw/"');
    expect(html).toContain('PU');
  });
});

describe.each(FAULTS)('upstream fault: $name', (f) => {
  beforeEach(() => { fault = f; });

  it('REQUIRED — the primary pokemon/{name}: 503, never a 200 or a 404', async () => {
    faultOn = (u) => u === `${API}/pokemon/feraligatr`;
    expect503(await pokemonPage());
  });

  it('REQUIRED — the species of an existing Pokémon: 503, never a 200 with missing data', async () => {
    faultOn = (u) => u === `${API}/pokemon-species/160/`;
    expect503(await pokemonPage());
  });

  it('REQUIRED — the move page\'s primary move: 503', async () => {
    faultOn = (u) => u === `${API}/move/surf`;
    expect503(await movePage());
  });

  it.each([
    ['Showdown pokedex', DEX_URL],
    ['Smogon sets', SETS_URL],
    ['evolution chain', `${API}/evolution-chain/74/`],
    ['ability detail', `${API}/ability/67/`],
    ['ability catalog', `${API}/ability?limit=100000`],
    ['alternate form', `${API}/pokemon/10300/`],
    ['species list (prev/next)', `${API}/pokemon-species?limit=100000`],
  ])('OPTIONAL — %s: the page still answers 200 (degraded), entity intact', async (_label, url) => {
    faultOn = (u) => u === url;
    const r = await pokemonPage();
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('id="movesTableBody"');
    expect(html).toContain('/es/movimientos/surf/');
  });

  it('OPTIONAL — the learned-by Pokémon of a move: 200, the move page is intact', async () => {
    faultOn = (u) => u === `${API}/pokemon/160/`;
    const r = await movePage();
    expect(r.status).toBe(200);
  });

  it('every optional dependency down at once still yields a 200 entity page', async () => {
    faultOn = (u) => u !== `${API}/pokemon/feraligatr` && u !== `${API}/pokemon-species/160/`;
    const r = await pokemonPage();
    expect(r.status).toBe(200);
  });
});

describe('primary entity that does not exist', () => {
  it('unknown Pokémon slug -> 404 (not 503)', async () => {
    const r = await render('./[lang]/pokemon/[name].astro', '/[lang]/pokemon/[name]', { lang: 'es', name: 'not-a-pokemon' }, '/es/pokemon/not-a-pokemon/');
    expect(r.status).toBe(404);
  });

  it('unknown move slug -> 404 (not 503)', async () => {
    const r = await render('./[lang]/movimientos/[name].astro', '/[lang]/movimientos/[name]', { lang: 'es', name: 'not-a-move' }, '/es/movimientos/not-a-move/');
    expect(r.status).toBe(404);
  });
});

describe('transient faults are retried once (cost of the retry policy)', () => {
  it('a single 503 on the primary Pokémon lookup is absorbed: the page is a 200, not a 503', async () => {
    let failed = false;
    const inner = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input) === `${API}/pokemon/feraligatr` && !failed) { failed = true; return res(503); }
      return inner(input, init);
    }));
    const r = await pokemonPage();
    expect(failed).toBe(true);
    expect(r.status).toBe(200);
  });

  it('a persistent 429 is NOT retried (no multiplying a rate limit): exactly one request, then 503', async () => {
    fault = FAULTS.find((f) => f.name === 'HTTP 429')!;
    faultOn = (u) => u === `${API}/pokemon/feraligatr`;
    const r = await pokemonPage();
    expect503(r);
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c) => String(c[0]) === `${API}/pokemon/feraligatr`);
    expect(calls).toHaveLength(1);
  });
});
