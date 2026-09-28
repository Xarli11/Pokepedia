import { describe, it, expect } from 'vitest';
import { computeStaleLearnsetFiles, pruneManifestHashes } from './learnsetPruning';

describe('computeStaleLearnsetFiles', () => {
  it('a file that exists on disk but is absent from the new generation is stale', () => {
    const existing = ['learnsets/tackle.json', 'learnsets/foo.json', 'learnsets/manifest.json'];
    const fresh = ['learnsets/tackle.json', 'learnsets/manifest.json'];
    expect(computeStaleLearnsetFiles(existing, fresh)).toEqual(['learnsets/foo.json']);
  });

  it('nothing is stale when every existing file is still produced', () => {
    const names = ['learnsets/tackle.json', 'learnsets/surf.json'];
    expect(computeStaleLearnsetFiles(names, names)).toEqual([]);
  });

  it('a brand-new move (no prior file) is never reported as stale', () => {
    expect(computeStaleLearnsetFiles(['learnsets/tackle.json'], ['learnsets/tackle.json', 'learnsets/new-move.json'])).toEqual([]);
  });

  it('an empty existing directory (first-ever generation) has nothing to prune', () => {
    expect(computeStaleLearnsetFiles([], ['learnsets/tackle.json'])).toEqual([]);
  });
});

describe('pruneManifestHashes', () => {
  it("a pruned file's hash does not survive in the manifest", () => {
    const hashes = { 'learnsets/tackle.json': 'abc123', 'learnsets/foo.json': 'deadbeef', 'moves.es.json': 'xyz' };
    const result = pruneManifestHashes(hashes, ['learnsets/foo.json']);
    expect(result).toEqual({ 'learnsets/tackle.json': 'abc123', 'moves.es.json': 'xyz' });
    expect(result).not.toHaveProperty('learnsets/foo.json');
  });

  it('no stale files -> the hash map is returned unchanged (a copy, not the same reference)', () => {
    const hashes = { 'learnsets/tackle.json': 'abc123' };
    const result = pruneManifestHashes(hashes, []);
    expect(result).toEqual(hashes);
    expect(result).not.toBe(hashes);
  });

  it('pruning a name absent from the hash map is a no-op for that name', () => {
    const hashes = { 'learnsets/tackle.json': 'abc123' };
    expect(pruneManifestHashes(hashes, ['learnsets/never-existed.json'])).toEqual(hashes);
  });
});
