import { describe, it, expect } from 'vitest';
import { GAME_CONTEXT_KEY, readGameContext, writeGameContext, resolveContextForPokemon } from './gameContextStorage';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
  };
}

describe('readGameContext / writeGameContext', () => {
  it('round-trips a written context id', () => {
    const storage = memoryStorage();
    writeGameContext(storage, 'sword-shield');
    expect(readGameContext(storage)).toBe('sword-shield');
    expect(storage.getItem(GAME_CONTEXT_KEY)).toBe('sword-shield');
  });

  it('returns null when nothing is stored', () => {
    expect(readGameContext(memoryStorage())).toBeNull();
  });

  it('returns null instead of throwing when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(readGameContext(broken)).toBeNull();
    expect(() => writeGameContext(broken, 'x-y')).not.toThrow();
  });

  it('treats an empty stored string as "nothing stored"', () => {
    const storage = memoryStorage();
    storage.setItem(GAME_CONTEXT_KEY, '');
    expect(readGameContext(storage)).toBeNull();
  });
});

describe('resolveContextForPokemon', () => {
  it('keeps the stored context when the Pokémon has it available', () => {
    expect(resolveContextForPokemon('scarlet-violet', ['scarlet-violet', 'sword-shield'], 'sword-shield')).toBe('scarlet-violet');
  });

  it('falls back when the Pokémon does not have the stored context', () => {
    expect(resolveContextForPokemon('scarlet-violet', ['sword-shield'], 'sword-shield')).toBe('sword-shield');
  });

  it('falls back when nothing is stored', () => {
    expect(resolveContextForPokemon(null, ['sword-shield'], 'sword-shield')).toBe('sword-shield');
  });

  it('falls back on a corrupted/unrecognized stored value', () => {
    expect(resolveContextForPokemon('not-a-real-context', ['sword-shield'], 'sword-shield')).toBe('sword-shield');
  });
});
