import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fault injection for the PokeAPI fetch layer: what is retried, what is
// cached, what is served stale, and what HTTP answer each failure becomes.

const API = 'https://pokeapi.co/api/v2';

type Step = { status: number; body?: unknown } | { reject: Error } | { invalidJson: true } | { hang: true };

// Modules are re-imported per test (the cache lives in the module), so the
// error classes must come from the SAME registry for instanceof to hold.
let E: typeof import('./errors');
let errorResponse: typeof import('../utils/httpResponses').errorResponse;
async function fresh() {
  vi.resetModules();
  E = await import('./errors');
  errorResponse = (await import('../utils/httpResponses')).errorResponse;
  return import('./pokeapi');
}

function script(steps: Step[]) {
  const calls: { url: string; signal?: AbortSignal | null }[] = [];
  let i = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), signal: init?.signal });
      const step = steps[Math.min(i++, steps.length - 1)];
      if ('reject' in step) throw step.reject;
      if ('hang' in step) return new Promise<Response>(() => {});
      if ('invalidJson' in step) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response;
      }
      return { ok: step.status < 400, status: step.status, headers: new Headers(), json: async () => step.body ?? {} } as unknown as Response;
    })
  );
  return calls;
}

const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
const networkError = () => new TypeError('fetch failed');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('retry policy (GET, one bounded retry)', () => {
  it('retries a fast 5xx once and succeeds', async () => {
    const calls = script([{ status: 503 }, { status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await expect(getMoveDetailByName('surf')).resolves.toMatchObject({ name: 'surf' });
    expect(calls).toHaveLength(2);
  });

  it('retries a network error once', async () => {
    const calls = script([{ reject: networkError() }, { status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await expect(getMoveDetailByName('surf')).resolves.toMatchObject({ name: 'surf' });
    expect(calls).toHaveLength(2);
  });

  it('gives up after ONE retry (no loops): persistent 503 -> UpstreamError -> HTTP 503', async () => {
    const calls = script([{ status: 503 }]);
    const { getMoveDetailByName } = await fresh();
    const error = await getMoveDetailByName('surf').catch((e) => e);
    expect(error).toBeInstanceOf(E.UpstreamError);
    expect(calls).toHaveLength(2);
    const res = errorResponse(error);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('never retries a timeout (it already spent its budget)', async () => {
    const calls = script([{ reject: timeoutError() }]);
    const { getMoveDetailByName } = await fresh();
    const error = await getMoveDetailByName('surf').catch((e) => e);
    expect(error).toBeInstanceOf(E.UpstreamError);
    expect(calls).toHaveLength(1);
    expect(errorResponse(error).status).toBe(503);
  });

  it('never retries 429 (would multiply a rate-limit problem)', async () => {
    const calls = script([{ status: 429 }]);
    const { getMoveDetailByName } = await fresh();
    const error = await getMoveDetailByName('surf').catch((e) => e);
    expect(error).toBeInstanceOf(E.UpstreamError);
    expect(calls).toHaveLength(1);
    expect(errorResponse(error).status).toBe(503);
  });

  it('never retries a 404 entity: it stays a 404', async () => {
    const calls = script([{ status: 404 }]);
    const { getMoveDetailByName } = await fresh();
    const error = await getMoveDetailByName('nope').catch((e) => e);
    expect(error).toBeInstanceOf(E.EntityNotFoundError);
    expect(calls).toHaveLength(1);
    expect(errorResponse(error).status).toBe(404);
  });

  it('never retries invalid JSON', async () => {
    const calls = script([{ invalidJson: true }]);
    const { getMoveDetailByName } = await fresh();
    const error = await getMoveDetailByName('surf').catch((e) => e);
    expect(error).toBeInstanceOf(E.UpstreamError);
    expect(calls).toHaveLength(1);
  });

  it('every attempt carries a timeout signal (nothing can block indefinitely)', async () => {
    const calls = script([{ status: 503 }, { status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await getMoveDetailByName('surf');
    expect(calls.every((c) => c.signal instanceof AbortSignal)).toBe(true);
  });

  it('a required dependency that is missing (not the primary entity) is a 503, never a 404', async () => {
    script([{ status: 404 }]);
    const { getAbilityDetail } = await fresh();
    const error = await getAbilityDetail(`${API}/ability/1/`).catch((e) => e);
    expect(error).toBeInstanceOf(E.NotFoundError);
    expect(error).not.toBeInstanceOf(E.EntityNotFoundError);
    expect(errorResponse(error).status).toBe(503);
  });
});

describe('cache safety', () => {
  it('failures are never cached: a later request re-fetches and succeeds', async () => {
    const calls = script([{ status: 429 }, { status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await expect(getMoveDetailByName('surf')).rejects.toBeInstanceOf(E.UpstreamError);
    await expect(getMoveDetailByName('surf')).resolves.toMatchObject({ name: 'surf' });
    expect(calls).toHaveLength(2);
  });

  it('a 404 is not cached under the entity key either', async () => {
    const calls = script([{ status: 404 }, { status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await expect(getMoveDetailByName('surf')).rejects.toBeInstanceOf(E.EntityNotFoundError);
    await expect(getMoveDetailByName('surf')).resolves.toBeTruthy();
    expect(calls).toHaveLength(2);
  });

  it('a valid response is cached per exact URL: two entities never share a key', async () => {
    const calls = script([{ status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }, { status: 200, body: { name: 'dive', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    expect((await getMoveDetailByName('surf')).name).toBe('surf');
    expect((await getMoveDetailByName('dive')).name).toBe('dive');
    expect((await getMoveDetailByName('surf')).name).toBe('surf');
    expect(calls.map((c) => c.url)).toEqual([`${API}/move/surf`, `${API}/move/dive`]);
  });

  it('concurrent identical requests share ONE upstream fetch (in-flight dedupe)', async () => {
    const calls = script([{ status: 200, body: { name: 'static', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] } }]);
    const { getAbilityDetail } = await fresh();
    const url = `${API}/ability/9/`;
    await Promise.all([getAbilityDetail(url), getAbilityDetail(url), getAbilityDetail(url)]);
    expect(calls).toHaveLength(1);
  });

  it('a failure in flight is shared by concurrent callers but not remembered afterwards', async () => {
    const calls = script([{ status: 429 }, { status: 200, body: { name: 'static', names: [], flavor_text_entries: [], effect_entries: [], pokemon: [] } }]);
    const { getAbilityDetail } = await fresh();
    const url = `${API}/ability/9/`;
    const settled = await Promise.allSettled([getAbilityDetail(url), getAbilityDetail(url)]);
    expect(settled.every((r) => r.status === 'rejected')).toBe(true);
    expect(calls).toHaveLength(1);
    await expect(getAbilityDetail(url)).resolves.toMatchObject({ name: 'static' });
  });
});

describe('stale-on-error (valid previous copy only)', () => {
  const OLD = 25 * 60 * 60 * 1000; // past the 24 h TTL

  it('serves the previous valid copy when PokeAPI is failing after the TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const calls = script([{ status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }, { status: 503 }]);
      const { getMoveDetailByName } = await fresh();
      await getMoveDetailByName('surf');
      vi.setSystemTime(Date.now() + OLD);
      await expect(getMoveDetailByName('surf')).resolves.toMatchObject({ name: 'surf' });
      // and does not hammer the failing upstream on the very next request
      const before = calls.length;
      await getMoveDetailByName('surf');
      expect(calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never serves stale for a 404 (the entity is gone)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      script([{ status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }, { status: 404 }]);
      const { getMoveDetailByName } = await fresh();
      await getMoveDetailByName('surf');
      vi.setSystemTime(Date.now() + OLD);
      await expect(getMoveDetailByName('surf')).rejects.toBeInstanceOf(E.EntityNotFoundError);
    } finally {
      vi.useRealTimers();
    }
  });

  it('with no previous copy the failure propagates untouched (Phase 2 semantics)', async () => {
    script([{ status: 503 }]);
    const { getMoveDetailByName } = await fresh();
    await expect(getMoveDetailByName('surf')).rejects.toBeInstanceOf(E.UpstreamError);
  });

  it('a stale copy does not outlive the 7-day bound', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      script([{ status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }, { status: 503 }]);
      const { getMoveDetailByName } = await fresh();
      await getMoveDetailByName('surf');
      vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
      await expect(getMoveDetailByName('surf')).rejects.toBeInstanceOf(E.UpstreamError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('structured logging', () => {
  it('logs failures as one JSON line with provider, resource, status and error class — no query, no PII', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    script([{ status: 429 }]);
    const { getMoveDetailByName } = await fresh();
    await getMoveDetailByName('surf').catch(() => {});
    const line = JSON.parse(warn.mock.calls[0][0] as string);
    expect(line).toMatchObject({ evt: 'upstream_error', provider: 'pokeapi', resource: 'move/surf', status: 429, error: 'UpstreamError' });
  });

  it('does not log successful requests (no log flooding)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    script([{ status: 200, body: { name: 'surf', names: [], flavor_text_entries: [] } }]);
    const { getMoveDetailByName } = await fresh();
    await getMoveDetailByName('surf');
    expect(warn).not.toHaveBeenCalled();
  });
});
