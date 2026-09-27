// src/services/machines.ts
//
// Runtime access to src/data/generated/machines.json (built by
// scripts/generate-catalogs.ts from PokeAPI's `/machine` resource): which
// TM/HM/TR item taught a move, and in which version group. Language-
// independent (item/version-group slugs only) — labels are joined at
// render time from the items catalog (already generated, already
// localized) and services/versionGroups.ts, so this file duplicates no
// translation.

export interface MachineEntry {
  /** Item slug, e.g. 'tm26'. Look up its localized name in the items catalog. */
  item: string;
  /** PokeAPI version group slug. Look up its label in services/versionGroups.ts. */
  versionGroup: string;
}

interface MachinesFile {
  schema: number;
  apiCount: number;
  count: number;
  byMove: Record<string, [string, string][]>;
}

let cached: Promise<Map<string, MachineEntry[]>> | null = null;

function load(): Promise<Map<string, MachineEntry[]>> {
  if (!cached) {
    cached = import('../data/generated/machines.json').then((mod) => {
      const file = mod.default as unknown as MachinesFile;
      return new Map(
        Object.entries(file.byMove).map(([move, rows]) => [move, rows.map(([item, versionGroup]) => ({ item, versionGroup }))])
      );
    });
  }
  return cached;
}

/** MT/HM/TR entries for a move, oldest→newest is NOT guaranteed here; sort by versionGroupRank at the call site if needed. Empty when the move was never a machine. */
export async function getMachinesForMove(moveSlug: string): Promise<MachineEntry[]> {
  const map = await load();
  return map.get(moveSlug) ?? [];
}
