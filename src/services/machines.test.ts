import { describe, it, expect } from 'vitest';
import { getMachinesForMove } from './machines';

describe('getMachinesForMove', () => {
  it('Earthquake is TM26 across many real games (spot-check against the generated dataset)', async () => {
    const entries = await getMachinesForMove('earthquake');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.item === 'tm26' && e.versionGroup === 'red-blue')).toBe(true);
  });

  it('a move that was never a machine returns an empty list, not an error', async () => {
    const entries = await getMachinesForMove('this-move-does-not-exist');
    expect(entries).toEqual([]);
  });
});
