import { describe, it, expect } from 'vitest';
import { buildPokeStudioUrl, POKESTUDIO_BASE_URL } from './ecosystem';

describe('PokeStudio integration boundary', () => {
  it('is disabled until a public URL exists: no invented link', () => {
    expect(POKESTUDIO_BASE_URL).toBeNull();
    expect(buildPokeStudioUrl('garchomp')).toBeNull();
  });

  it('builds a deep link once a base URL is configured', () => {
    const url = buildPokeStudioUrl('garchomp', 'https://studio.example/');
    expect(new URL(url!).searchParams.get('p')).toBe('garchomp');
  });
});
