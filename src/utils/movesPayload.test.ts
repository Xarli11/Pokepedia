import { describe, it, expect } from 'vitest';
import { compactMoves, expandMoves, formatMoveName, jsonForScript, moveApiUrl, resourceRef, type RawMoveEntry } from './movesPayload';

const labels = { method: (m: string) => ({ 'level-up': 'Nivel', machine: 'MT/MO' }[m] ?? m), version: (v: string) => v.toUpperCase() };

function raw(slug: string, ref: string | number, level: number, method: string, version: string): RawMoveEntry {
  return { slug, ref, level, method, version };
}

describe('moves payload', () => {
  const byVersion = {
    'red-blue': [raw('surf', 57, 0, 'machine', 'red-blue'), raw('tackle', 33, 1, 'level-up', 'red-blue')],
    gold: [raw('surf', 57, 0, 'machine', 'gold'), raw('protect', 182, 5, 'level-up', 'gold'), raw('surf', 57, 30, 'level-up', 'gold')],
  };

  it('round-trips (move, level, method) and rebuilds names, URLs and labels', () => {
    const c = compactMoves(byVersion, labels);
    expect(expandMoves(c, 'gold')).toEqual([
      { slug: 'surf', name: 'Surf', url: 'https://pokeapi.co/api/v2/move/57/', level: 0, method: 'machine', methodLabel: 'MT/MO', version: 'gold', versionLabel: 'GOLD' },
      { slug: 'protect', name: 'Protect', url: 'https://pokeapi.co/api/v2/move/182/', level: 5, method: 'level-up', methodLabel: 'Nivel', version: 'gold', versionLabel: 'GOLD' },
      { slug: 'surf', name: 'Surf', url: 'https://pokeapi.co/api/v2/move/57/', level: 30, method: 'level-up', methodLabel: 'Nivel', version: 'gold', versionLabel: 'GOLD' },
    ]);
    expect(expandMoves(c, 'red-blue').map((r) => r.slug)).toEqual(['surf', 'tackle']);
    expect(expandMoves(c, 'unknown-version')).toEqual([]);
  });

  it('stores each move and method once, however many versions use them', () => {
    const c = compactMoves(byVersion, labels);
    expect(c.m).toEqual([['surf', 57], ['tackle', 33], ['protect', 182]]);
    expect(c.k).toEqual(['machine', 'level-up']);
  });

  it('keeps slug-form refs (non-numeric URL tails) working', () => {
    expect(resourceRef('https://pokeapi.co/api/v2/move/57/')).toBe(57);
    expect(resourceRef('https://pokeapi.co/api/v2/move/surf/')).toBe('surf');
    expect(moveApiUrl('surf')).toBe('https://pokeapi.co/api/v2/move/surf/');
  });

  it('formats names exactly like formatName()', () => {
    expect(formatMoveName('brutal-swing')).toBe('Brutal Swing');
  });

  it('is at least 5x smaller than the legacy processed-row payload for a realistic list', () => {
    const versions = ['red-blue', 'yellow', 'gold-silver', 'crystal', 'ruby-sapphire', 'emerald', 'x-y', 'sun-moon', 'sword-shield', 'scarlet-violet'];
    const big: Record<string, RawMoveEntry[]> = {};
    for (const v of versions) {
      big[v] = Array.from({ length: 110 }, (_, i) => raw(`some-move-${i}`, 100 + i, i % 40, i % 3 ? 'machine' : 'level-up', v));
    }
    const legacy = JSON.stringify(
      Object.fromEntries(
        Object.entries(big).map(([v, list]) => [
          v,
          list.map((e) => ({ name: formatMoveName(e.slug), slug: e.slug, url: moveApiUrl(e.ref), level: e.level, method: e.method, methodLabel: labels.method(e.method), version: v, versionLabel: v.toUpperCase() })),
        ])
      )
    );
    const compact = jsonForScript(compactMoves(big, labels));
    expect(compact.length * 5).toBeLessThan(legacy.length);
  });

  it('jsonForScript can never terminate its <script> element or contain HTML entities', () => {
    const out = jsonForScript({ a: '</script><!-- x -->', b: 'ok "quoted"' });
    expect(out).not.toContain('</script');
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ a: '</script><!-- x -->', b: 'ok "quoted"' });
  });
});
