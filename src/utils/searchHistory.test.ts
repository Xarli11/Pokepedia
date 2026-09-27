import { describe, it, expect } from 'vitest';
import { HISTORY_KEY, HISTORY_MAX, clearHistory, normalizeHistory, pushHistory, readHistory, recordHistory } from './searchHistory';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] };
};

describe('search history', () => {
  it('reads legacy Pokémon-only entries as Pokémon', () => {
    const h = normalizeHistory([{ name: 'garchomp', id: 445, sprite: 'https://x/445.png' }]);
    expect(h).toEqual([{ type: 'pokemon', slug: 'garchomp', name: 'garchomp', id: 445 }]);
  });

  it('stores any entity kind and keeps kinds apart (same slug, different kind)', () => {
    let h = pushHistory([], { type: 'move', slug: 'protect', name: 'Protección', id: 0 });
    h = pushHistory(h, { type: 'ability', slug: 'protect', name: 'Protect', id: 0 });
    h = pushHistory(h, { type: 'pokemon', slug: 'garchomp', name: 'Garchomp', id: 445 });
    expect(h.map((e) => `${e.type}:${e.slug}`)).toEqual(['pokemon:garchomp', 'ability:protect', 'move:protect']);
  });

  it('moves a repeated entry to the front and caps the length', () => {
    let h = [] as ReturnType<typeof normalizeHistory>;
    for (let i = 0; i < HISTORY_MAX + 4; i++) h = pushHistory(h, { type: 'item', slug: `i${i}`, name: `I${i}`, id: 0 });
    expect(h).toHaveLength(HISTORY_MAX);
    h = pushHistory(h, { type: 'item', slug: `i${HISTORY_MAX + 1}`, name: 'again', id: 0 });
    expect(h[0].name).toBe('again');
    expect(h.filter((e) => e.slug === `i${HISTORY_MAX + 1}`)).toHaveLength(1);
  });

  it('drops malformed entries instead of throwing', () => {
    expect(normalizeHistory('nope')).toEqual([]);
    expect(normalizeHistory([null, 3, { type: 'weird', slug: 'x' }, { type: 'move' }, { type: 'move', slug: 'a/b' }])).toEqual([]);
  });

  it('round-trips through storage, tolerates bad JSON and clears', () => {
    const s = memory();
    recordHistory(s, { type: 'type', slug: 'dragon', name: 'Dragón', id: 0 });
    expect(readHistory(s)).toEqual([{ type: 'type', slug: 'dragon', name: 'Dragón', id: 0 }]);
    expect(Object.keys(s.data)).toEqual([HISTORY_KEY]);
    clearHistory(s);
    expect(readHistory(s)).toEqual([]);
    expect(readHistory(memory({ [HISTORY_KEY]: '{not json' }))).toEqual([]);
  });

  it('never stores free text: only slug, display name and id of an opened entity', () => {
    const s = memory();
    recordHistory(s, { type: 'move', slug: 'earthquake', name: 'Terremoto', id: 0 });
    expect(Object.keys(JSON.parse(s.data[HISTORY_KEY])[0]).sort()).toEqual(['id', 'name', 'slug', 'type']);
  });
});
