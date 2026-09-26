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

// --- Absolute dataset age: origin -> edge -> memory never rejuvenates a copy ---
describe('absolute age of a dataset (max 7 days, from its real origin time)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('A: a dataset fetched from the origin now is served from memory without new requests', async () => {
    fakeEdge();
    const calls = net(() => ({ status: 200, body: JSON.stringify(DEX) }));
    const { getShowdownPokemon } = await fresh();
    await getShowdownPokemon('garchomp');
    await getShowdownPokemon('garchomp');
    expect(calls).toHaveLength(1);
  });

  it('B: an edge copy younger than 6 h is fresh: no origin request', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 5 * HOUR });
    const calls = net(() => ({ status: 200, body: '{}' }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(0);
  });

  it('C: an edge copy between 6 h and 7 days is served stale when the origin fails', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 3 * DAY });
    const calls = net(() => ({ status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('OU');
    expect(calls).toHaveLength(1);
  });

  it('D (critical): a copy promoted edge -> memory at 6d23h is NOT served once 7 days of REAL age pass', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - (7 * DAY - HOUR) });
    net(() => ({ status: 503, body: '' }));
    const { getCachedSmogonDataBatch, getShowdownPokemon } = await fresh();
    // promotion by the cards path
    expect((await getCachedSmogonDataBatch(['garchomp'])).garchomp?.types).toEqual(['dragon', 'ground']);
    // still inside the limit: memory serves it
    expect((await getCachedSmogonDataBatch(['garchomp'])).garchomp).toBeDefined();
    // 2 hours later the copy is 7d1h old — promotion must not have renewed it
    vi.setSystemTime(Date.now() + 2 * HOUR);
    expect(await getCachedSmogonDataBatch(['garchomp'])).toEqual({});
    // and the origin failing does not resurrect it through the stale fallback either
    expect(await getShowdownPokemon('garchomp')).toBeNull();
  });

  it('D2: same through the page path (fetchDataset): promotion of a fresh-ish edge copy keeps its real age', async () => {
    const edge = fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 5 * HOUR });
    const calls = net(() => ({ status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    await getShowdownPokemon('garchomp'); // edge fresh -> memory with cachedAt = 5 h ago
    vi.setSystemTime(Date.now() + 20 * HOUR); // real age 25 h > memory TTL 24 h
    await getShowdownPokemon('garchomp');
    // memory copy is past its TTL (age counted from the real origin time), so the origin is tried
    expect(calls).toHaveLength(1);
    expect(edge.put).not.toHaveBeenCalled();
  });

  it('E: a copy older than 7 days is never served, in memory or edge, when the origin fails', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: Date.now() - 8 * DAY });
    const calls = net(() => ({ status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    expect(await getShowdownPokemon('garchomp')).toBeNull(); // unavailable -> the page degrades, no 503
    expect(calls).toHaveLength(1);
  });

  it('E2: an edge entry with no valid cached-at header is not served', async () => {
    fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: 0 });
    net(() => ({ status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    expect(await getShowdownPokemon('garchomp')).toBeNull();
  });

  it('E3: a memory copy past 7 days is not served as stale', async () => {
    fakeEdge();
    let up = true;
    const calls = net(() => (up ? { status: 200, body: JSON.stringify(DEX) } : { status: 503, body: '' }));
    const { getShowdownPokemon } = await fresh();
    await getShowdownPokemon('garchomp');
    up = false;
    vi.setSystemTime(Date.now() + 8 * DAY);
    expect(await getShowdownPokemon('garchomp')).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('F: when the origin recovers a new copy is stored with a new REAL cachedAt', async () => {
    const t0 = Date.now();
    const edge = fakeEdge({ url: POKEDEX_URL, body: JSON.stringify(DEX), cachedAt: t0 - 3 * DAY });
    net(() => ({ status: 200, body: JSON.stringify({ garchomp: { tier: 'Uber', baseStats: { hp: 1 } } }) }));
    const { getShowdownPokemon } = await fresh();
    expect((await getShowdownPokemon('garchomp'))?.tier).toBe('Uber');
    const written = Number(edge.store.get(POKEDEX_URL)!.headers['x-pokepedia-cached-at']);
    expect(written).toBe(t0);
    expect(written).toBeGreaterThan(t0 - 3 * DAY);
  });
});
