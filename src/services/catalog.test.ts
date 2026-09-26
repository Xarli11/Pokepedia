import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The catalog helpers cache per module instance, so each test loads a fresh one.
async function freshPokeapi() {
  vi.resetModules();
  return import('./pokeapi');
}

const API = 'https://pokeapi.co/api/v2';
const items = (n: number, dupAt?: number, resource = 'item') =>
  Array.from({ length: n }, (_, i) => ({ name: dupAt === i ? `${resource}-0` : `${resource}-${i}`, url: `${API}/${resource}/${i + 1}/` }));

/** Fake PokeAPI list endpoint: honours ?limit / ?offset, reports the real count. */
function mockList(total: number, opts: { maxPage?: number; dupAt?: number; resource?: string } = {}) {
  const resource = opts.resource ?? 'item';
  const all = items(total, opts.dupAt, resource);
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      calls.push(url.search);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), opts.maxPage ?? Infinity);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const results = all.slice(offset, offset + limit);
      const next = offset + limit < total ? `${API}/${resource}?offset=${offset + limit}&limit=${limit}` : null;
      const body = { count: total, next, results };
      return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
    })
  );
  return calls;
}

describe('complete PokeAPI catalogs', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('loads every item when the catalog is larger than the old 2000 cap (2223)', async () => {
    mockList(2223);
    const { getAllItems } = await freshPokeapi();
    const catalog = await getAllItems();
    expect(catalog).toHaveLength(2223); // catalogLoaded === apiCount
    expect(catalog.at(-1)?.name).toBe('item-2222');
  });

  it('keeps working when the catalog grows again (no magic number)', async () => {
    mockList(5123);
    const { getAllItems } = await freshPokeapi();
    expect(await getAllItems()).toHaveLength(5123);
  });

  it('loads a catalog in ONE request (no head request) and checks it against the API count', async () => {
    const calls = mockList(2223);
    const { getAllItems, LIST_REQUEST_LIMIT } = await freshPokeapi();
    await getAllItems();
    expect(calls).toEqual([`?limit=${LIST_REQUEST_LIMIT}`]);
  });

  it('completes a capped page by following `next`', async () => {
    mockList(700, { maxPage: 300 });
    const { getCompleteResourceList } = await freshPokeapi();
    expect(await getCompleteResourceList('item')).toHaveLength(700);
  });

  it('throws (503 upstream) rather than silently serving a partial catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const body = url.searchParams.get('limit') === '1'
          ? { count: 10, next: null, results: items(1) }
          : { count: 10, next: null, results: items(4) }; // short page, no next
        return { ok: true, status: 200, headers: new Headers(), json: async () => body } as unknown as Response;
      })
    );
    const { getCompleteResourceList } = await freshPokeapi();
    await expect(getCompleteResourceList('item')).rejects.toThrow(/incomplete: 4 of 10/);
  });

  it('a slug listed twice by PokeAPI (roseli-berry) yields one entry', async () => {
    mockList(5, { dupAt: 3 });
    const { getAllItems } = await freshPokeapi();
    const names = (await getAllItems()).map((i) => i.name);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(names.length);
  });

  it('a page shorter than its count that `next` cannot complete rejects, not truncates', async () => {
    mockList(10, { maxPage: 4 });
    // break pagination: pretend there is no next page
    const inner = globalThis.fetch as unknown as (u: string) => Promise<Response>;
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const res = await inner(u);
      const body = await res.json();
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ ...body, next: null }) } as unknown as Response;
    }));
    const { getCompleteResourceList } = await freshPokeapi();
    await expect(getCompleteResourceList('item')).rejects.toThrow(/incomplete: 4 of 10/);
  });

  it('a response without count/results is not a catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ results: [] }) }) as unknown as Response));
    const { getCompleteResourceList } = await freshPokeapi();
    await expect(getCompleteResourceList('move')).rejects.toThrow(/malformed/);
  });

  it('an upstream 5xx while loading the catalog is an UpstreamError (503), nothing partial', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, headers: new Headers(), json: async () => ({}) }) as unknown as Response));
    const { getAllMoves } = await freshPokeapi();
    const { UpstreamError } = await import('./errors');
    await expect(getAllMoves()).rejects.toBeInstanceOf(UpstreamError);
  });

  // Same latent truncation risk the item catalog had: getAllMoves() used
  // ?limit=1000 (937 moves today) and getAllAbilities() ?limit=500 (374).
  it.each([
    ['move', 'getAllMoves', 937],
    ['move', 'getAllMoves', 1203], // catalog grew past the old 1000 cap
    ['ability', 'getAllAbilities', 374],
    ['ability', 'getAllAbilities', 612], // grew past the old 500 cap
    ['pokemon-species', 'getAllPokemonBasic', 1025],
    ['pokemon-species', 'getAllPokemonBasic', 1300],
  ] as const)('%s catalog via %s loads all %i entries (API count == loaded)', async (resource, fn, total) => {
    mockList(total, { resource });
    const mod = await freshPokeapi();
    const list = await mod[fn]();
    expect(list).toHaveLength(total);
  });

  it('a duplicated move/ability name yields one entry', async () => {
    mockList(6, { resource: 'move', dupAt: 4 });
    const { getAllMoves } = await freshPokeapi();
    const names = (await getAllMoves()).map((m) => m.name);
    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
  });
});
