import { describe, it, expect } from 'vitest';
import { getMoveLearnsetRelations } from './moveLearnsets';

describe('getMoveLearnsetRelations (against the real generated dataset)', () => {
  it('Earthquake: many Pokémon, a real machine relation, decodes to plain fields', async () => {
    const relations = await getMoveLearnsetRelations('earthquake');
    expect(relations.length).toBeGreaterThan(300);
    expect(relations.every((r) => Number.isInteger(r.pokemonId) && r.pokemonId > 0)).toBe(true);
    expect(relations.every((r) => typeof r.method === 'string' && r.method.length > 0)).toBe(true);
    expect(relations.every((r) => typeof r.versionGroup === 'string' && r.versionGroup.length > 0)).toBe(true);
    expect(relations.some((r) => r.method === 'machine')).toBe(true);
  });

  it('a level-up relation has a real positive level; every other method has level 0', async () => {
    const relations = await getMoveLearnsetRelations('earthquake');
    const levelUp = relations.filter((r) => r.method === 'level-up');
    expect(levelUp.length).toBeGreaterThan(0);
    expect(levelUp.some((r) => r.level > 0)).toBe(true);
    expect(relations.filter((r) => r.method !== 'level-up').every((r) => r.level === 0)).toBe(true);
  });

  it('an egg-move-capable move has an "egg" relation', async () => {
    // Verified against real PokeAPI data before writing this test: Eevee
    // learns Wish as an egg move (e.g. in scarlet-violet).
    const relations = await getMoveLearnsetRelations('wish');
    expect(relations.some((r) => r.method === 'egg')).toBe(true);
  });

  it('a move nothing learns, or an unrecognized slug, returns an empty list rather than throwing', async () => {
    expect(await getMoveLearnsetRelations('this-move-does-not-exist')).toEqual([]);
  });
});
