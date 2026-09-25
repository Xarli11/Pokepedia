import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Showdown / Smogon dataset cache: in-memory + Cloudflare Cache API layer.

const POKEDEX_URL = 'https://play.pokemonshowdown.com/data/pokedex.json';
const DEX = { garchomp: { tier: 'OU', types: ['Dragon', 'Ground'], baseStats: { hp: 108 } } };

async function fresh() {
  vi.resetModules();
  return import('./smogon');
}

/** Minimal Cache API double shared across "isolates" (module resets). */
function fakeEdge(preset?: { url: string; body: string; cachedAt: number }) {
  const store = new Map<string, { body: string; headers: Record<string, string> }>();
  if (preset) store.set(preset.url, { body: preset.body, headers: { 'x-pokepedia-cached-at': String(preset.cachedAt) } });
  const put = vi.fn(async (req: Request, res: Response) => {
    store.set(req.url, { body: await res.text(), headers: Object.fromEntries(res.headers.entries()) });
  });
  const match = vi.fn(async (req: Request) => {
    const hit = store.get(req.url);
    return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
  });
  vi.stubGlobal('caches', { default: { match, put } });
  return { store, put, match };
}

function net(handler: (url: string) => { status: number; body: string } | Error) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const out = handler(url);
      if (out instanceof Error) throw out;
      return new Response(out.body, { status: out.status });
    })
  );
  return calls;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Showdown dataset caching', () => {
  it('writes a validated dataset to the edge cache; a new isolate reuses it without touching Showdown', async () => {
    const edge = fakeEdge();
    const calls = net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const a = await fresh();
    expect((await a.getShowdownPokemon('Garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1);
    expect(edge.put).toHaveBeenCalledTimes(1);

    // Second isolate: empty memory, same edge cache.
    const b = await fresh();
    expect((await b.getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1);
  });

  it('memory cache: many lookups in one isolate are one network fetch', async () => {
    fakeEdge();
    const calls = net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon, getSmogonDataBatch } = await fresh();
    await Promise.all([getShowdownPokemon('garchomp'), getShowdownPokemon('garchomp'), getSmogonDataBatch(['garchomp'])]);
    await getShowdownPokemon('garchomp');
    expect(calls).toHaveLength(1);
  });

  it('never caches a bad body: 503, a JSON error object, or non-JSON', async () => {
    for (const bad of [{ status: 503, body: 'down' }, { status: 200, body: '{"error":"rate limited"}' }, { status: 200, body: '<html>oops</html>' }]) {
      const edge = fakeEdge();
      net(() => bad);
      const { getShowdownPokemon } = await fresh();
      expect(await getShowdownPokemon('garchomp')).toBeNull();
      expect(edge.put).not.toHaveBeenCalled();
    }
  });

  it('a network failure is not remembered: the next call fetches again', async () => {
    fakeEdge();
    let n = 0;
    const calls = net(() => (n++ === 0 ? new TypeError('fetch failed') : { status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon } = await fresh();
    expect(await getShowdownPokemon('garchomp')).toBeNull();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(2);
  });

  it('serves the previous VALID edge copy when Showdown is down after the fresh window (stale-on-error)', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 7 * 60 * 60 * 1000 });
    const calls = net(() => ({ status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1); // it did try to revalidate
  });

  it('a stale edge copy is refreshed when Showdown is healthy', async () => {
    const edge = fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 7 * 60 * 60 * 1000 });
    const newer = { garchomp: { tier: 'Uber', baseStats: { hp: 108 } } };
    net(() => ({ status: 200, body: JSON.stringify(newer) }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('Uber');
    expect(edge.put).toHaveBeenCalledTimes(1);
  });

  it('a corrupt edge entry is ignored, not served', async () => {
    fakeEdge({ url: POKEDEX_URL, body: '{"error":"x"}', cachedAt: Date.now() });
    const calls = net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1);
  });

  it('works where there is no Cache API (Node, tests): memory only', async () => {
    vi.stubGlobal('caches', undefined);
    const calls = net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1);
  });

  it('a Cache API failure never breaks the page', async () => {
    vi.stubGlobal('caches', { default: { match: async () => { throw new Error('boom'); }, put: async () => { throw new Error('boom'); } } });
    net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
  });

  it('the dataset is keyed by URL only: Smogon sets and the pokedex never share an entry', async () => {
    const edge = fakeEdge();
    net((url) => ({ status: 200, body: JSON.stringify(url.includes('sets') ? { Garchomp: { 'Swords Dance': { moves: ['Earthquake'] } } } : DEX) }));
    const { getShowdownPokemon, getSmogonSets } = await fresh();
    await getShowdownPokemon('garchomp');
    const sets = await getSmogonSets('garchomp', 'OU');
    expect(sets?.[0].moves).toEqual(['Earthquake']);
    expect([...edge.store.keys()].sort()).toEqual([POKEDEX_URL, 'https://pkmn.github.io/smogon/data/sets/gen9ou.json'].sort());
  });
});
