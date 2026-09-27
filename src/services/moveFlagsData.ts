// src/services/moveFlagsData.ts
//
// Runtime access to src/data/generated/move-flags.json (built by
// scripts/generate-catalogs.ts from Showdown's moves.json, matched to
// PokeAPI moves by national move id — the same id Showdown's own `num`
// field uses). One small combined file (not split per-move like
// learnsets/: the whole curated, filtered dataset is a few dozen KB, see
// docs/DATA_SOURCES.md), imported directly rather than through
// import.meta.glob.

import { moveFlagByIndex } from '../utils/moveFlags';

interface MoveFlagsFile {
  schema: number;
  apiCount: number;
  count: number;
  byMove: Record<string, number[]>;
}

let cached: Promise<Map<string, string[]>> | null = null;

function load(): Promise<Map<string, string[]>> {
  if (!cached) {
    cached = import('../data/generated/move-flags.json').then((mod) => {
      const file = mod.default as unknown as MoveFlagsFile;
      return new Map(Object.entries(file.byMove).map(([move, indices]) => [move, indices.map(moveFlagByIndex)]));
    });
  }
  return cached;
}

/** Factual flags for a move (see utils/moveFlags.ts for the curated set). Empty when the move has none, or the dataset hasn't been generated yet — never a fetch, never a thrown error. */
export async function getMoveFlags(moveSlug: string): Promise<string[]> {
  const map = await load();
  return map.get(moveSlug) ?? [];
}
