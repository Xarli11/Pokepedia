import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOVE_FLAG_ORDER } from '../utils/moveFlags';

// Contract test: getMoveFlags() must decode byMove's indices against the
// FILE's own flagOrder, never blindly against the current MOVE_FLAG_ORDER
// constant — a dataset generated under a different order must fail loudly
// rather than silently decode every relation to the wrong flag.

async function loadWithMockedFile(file: unknown) {
  vi.resetModules();
  vi.doMock('../data/generated/move-flags.json', () => ({ default: file }));
  return import('./moveFlagsData');
}

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('../data/generated/move-flags.json');
});

describe('getMoveFlags: dataset/decoder contract', () => {
  it('decodes correctly when the file\'s flagOrder matches the current MOVE_FLAG_ORDER', async () => {
    const { getMoveFlags } = await loadWithMockedFile({
      schema: 1,
      apiCount: 1,
      count: 1,
      flagOrder: MOVE_FLAG_ORDER,
      byMove: { tackle: [0, 1] },
    });
    expect(await getMoveFlags('tackle')).toEqual([MOVE_FLAG_ORDER[0], MOVE_FLAG_ORDER[1]]);
  });

  it('throws instead of silently mis-decoding when the file\'s flagOrder differs from MOVE_FLAG_ORDER (reordered)', async () => {
    const reordered = [...MOVE_FLAG_ORDER].reverse();
    const { getMoveFlags } = await loadWithMockedFile({
      schema: 1,
      apiCount: 1,
      count: 1,
      flagOrder: reordered,
      byMove: { tackle: [0] },
    });
    await expect(getMoveFlags('tackle')).rejects.toThrow(/flagOrder/);
  });

  it('throws when the file\'s flagOrder has a different length (an entry inserted/removed)', async () => {
    const { getMoveFlags } = await loadWithMockedFile({
      schema: 1,
      apiCount: 1,
      count: 1,
      flagOrder: [...MOVE_FLAG_ORDER, 'made-up-flag'],
      byMove: { tackle: [0] },
    });
    await expect(getMoveFlags('tackle')).rejects.toThrow(/flagOrder/);
  });

  it('an out-of-range index is dropped, never rendered as an empty-string flag', async () => {
    const { getMoveFlags } = await loadWithMockedFile({
      schema: 1,
      apiCount: 1,
      count: 1,
      flagOrder: MOVE_FLAG_ORDER,
      byMove: { corrupted: [0, 999, -1] },
    });
    const flags = await getMoveFlags('corrupted');
    expect(flags).toEqual([MOVE_FLAG_ORDER[0]]);
    expect(flags).not.toContain('');
  });

  it('a move absent from byMove returns an empty array, never throws', async () => {
    const { getMoveFlags } = await loadWithMockedFile({
      schema: 1,
      apiCount: 1,
      count: 0,
      flagOrder: MOVE_FLAG_ORDER,
      byMove: {},
    });
    expect(await getMoveFlags('this-move-does-not-exist')).toEqual([]);
  });
});
