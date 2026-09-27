// src/data/catalogs/learnsetPruning.ts
//
// Pure diff between the learnset files a fresh `--only=move-learnsets` run
// produces and the ones already committed under
// src/data/generated/learnsets/ — isolated from fs/network so it's unit
// testable without either. A move PokeAPI stops returning relations for
// (or removes outright) must not leave its old learnsets/{move}.json
// behind: services/moveLearnsets.ts discovers files via
// `import.meta.glob`, so a stale file would keep being served as current
// data forever, silently, with no error.
//
// The caller (scripts/generate-catalogs.ts) is responsible for the safety
// property that matters: only ever compute/act on this diff *after* the
// full new dataset has been built successfully in memory. A failed
// generation (a PokeAPI fetch throwing mid-run) must never reach this
// code, so it never deletes anything.

/**
 * Every existing `learnsets/*.json` file name absent from the newly
 * generated set — safe to delete once that new set is about to be
 * written. Both lists use the same `learnsets/{name}.json` form (as a
 * directory listing prefixed with `learnsets/`, matching the keys
 * `buildMoveLearnsets` emits) so callers never need a second mapping.
 */
export function computeStaleLearnsetFiles(existingFileNames: readonly string[], newFileNames: readonly string[]): string[] {
  const keep = new Set(newFileNames);
  return existingFileNames.filter((name) => !keep.has(name));
}

/**
 * The global manifest's `file -> hash` map with any pruned learnset
 * entries removed. Without this, a hash for a file that no longer exists
 * on disk would survive in `manifest.json` (it starts from `{
 * ...previous.files }`), and `--check` — or anyone reading the manifest —
 * would believe a deleted file is still part of the dataset.
 */
export function pruneManifestHashes(hashes: Readonly<Record<string, string>>, staleFileNames: readonly string[]): Record<string, string> {
  if (staleFileNames.length === 0) return { ...hashes };
  const stale = new Set(staleFileNames);
  return Object.fromEntries(Object.entries(hashes).filter(([name]) => !stale.has(name)));
}
