// src/services/moveFlagsData.ts
//
// Runtime access to src/data/generated/move-flags.json (built by
// scripts/generate-catalogs.ts from Showdown's moves.json, matched to
// PokeAPI moves by national move id — the same id Showdown's own `num`
// field uses). One small combined file (not split per-move like
// learnsets/: the whole curated, filtered dataset is a few dozen KB, see
// docs/DATA_SOURCES.md), imported directly rather than through
// import.meta.glob.

import { MOVE_FLAG_ORDER } from '../utils/moveFlags';

interface MoveFlagsFile {
  schema: number;
  apiCount: number;
  count: number;
  /** The index table this exact file was encoded against — see the contract check below. */
  flagOrder: readonly string[];
  byMove: Record<string, number[]>;
}

/**
 * The file's own `flagOrder` is the only correct decode key — `byMove`'s
 * numbers are indices into *whatever order the generator used when it
 * wrote them*, not into whatever `MOVE_FLAG_ORDER` happens to say right
 * now. Decoding against the current constant instead of the file's own
 * table would silently corrupt every relation the moment someone
 * reorders/inserts an entry in `utils/moveFlags.ts` without regenerating
 * the dataset: the same stored index would then decode to a different
 * flag, with no error anywhere. Failing loudly here is the whole point —
 * a stale-but-silently-wrong dataset is worse than a thrown error.
 */
function assertFlagOrderMatches(fileOrder: readonly string[]): void {
  const matches = fileOrder.length === MOVE_FLAG_ORDER.length && fileOrder.every((f, i) => f === MOVE_FLAG_ORDER[i]);
  if (!matches) {
    throw new Error(
      `move-flags.json's flagOrder [${fileOrder.join(', ')}] does not match the current MOVE_FLAG_ORDER ` +
        `[${MOVE_FLAG_ORDER.join(', ')}] — the dataset is stale relative to utils/moveFlags.ts. ` +
        `Regenerate with \`npm run data:catalogs -- --only=move-flags\`.`
    );
  }
}

let cached: Promise<Map<string, string[]>> | null = null;

function load(): Promise<Map<string, string[]>> {
  if (!cached) {
    cached = import('../data/generated/move-flags.json').then((mod) => {
      const file = mod.default as unknown as MoveFlagsFile;
      assertFlagOrderMatches(file.flagOrder);
      // Decoded against the file's own order (identical to MOVE_FLAG_ORDER,
      // just asserted above — never a second, independent decode path).
      // An out-of-range index (corrupted/truncated data) is dropped, never
      // turned into an empty-string "flag" a caller would render as a
      // blank badge.
      return new Map(
        Object.entries(file.byMove).map(([move, indices]) => [move, indices.map((i) => file.flagOrder[i]).filter((f): f is string => Boolean(f))])
      );
    });
  }
  return cached;
}

/**
 * Factual flags for a move (see utils/moveFlags.ts for the curated set).
 * `[]` when the move has none, or the dataset hasn't been generated yet
 * — never a fetch. Does throw (see `assertFlagOrderMatches` above) if the
 * committed dataset's `flagOrder` doesn't match the current
 * `MOVE_FLAG_ORDER`: that specific case is a real data/code mismatch, not
 * something a caller should silently degrade through.
 */
export async function getMoveFlags(moveSlug: string): Promise<string[]> {
  const map = await load();
  return map.get(moveSlug) ?? [];
}
