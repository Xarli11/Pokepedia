import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSpeciesNamesById } from './pokeapi';
import { UpstreamError } from './errors';

// Separate file on purpose: fetchWithCache() caches the species list for the
// module's lifetime, and this needs a module that has never loaded it.
afterEach(() => vi.unstubAllGlobals());

describe('getSpeciesNamesById is not best-effort', () => {
  it('propagates a failure instead of returning an empty map (which would emit non-canonical links)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response));
    await expect(getSpeciesNamesById()).rejects.toBeInstanceOf(UpstreamError);
  });
});
