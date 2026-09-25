import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The catalog helpers cache per module instance, so each test loads a fresh one.
async function freshPokeapi() {
  vi.resetModules();
  return import('./pokeapi');
}

const API = 'https://pokeapi.co/api/v2';
const items = (n: number, dupAt?: number) =>
  Array.from({ length: n }, (_, i) => ({ name: dupAt === i ? 'item-0' : `item-${i}`, url: `${API}/item/${i + 1}/` }));

/** Fake PokeAPI list endpoint: honours ?limit / ?offset, reports the real count. */
function mockList(total: number, opts: { maxPage?: number; dupAt?: number } = {}) {
  const all = items(total, opts.dupAt);
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      calls.push(url.search);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), opts.maxPage ?? Infinity);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const results = all.slice(offset, offset + limit);
      const next = offset + limit < total ? `${API}/item?offset=${offset + limit}&limit=${limit}` : null;
      const body = { count: total, next, results };
      return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
    })
  );
  return calls;
}

describe('complete PokeAPI item catalog', () => {
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

  it('asks the API for its own count instead of a fixed limit', async () => {
    const calls = mockList(2223);
    const { getAllItems } = await freshPokeapi();
    await getAllItems();
    expect(calls).toEqual(['?limit=1', '?limit=2223']);
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
});
