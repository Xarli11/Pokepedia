// src/services/moveLearnsets.ts
//
// Runtime access to src/data/generated/learnsets/{move}.json (built offline
// by scripts/generate-catalogs.ts --only=move-learnsets, inverted from
// PokeAPI's pokemon/{id}.moves — see that script's header for the full
// rationale and the size measurements behind "one file per move"). A move
// page imports exactly its own move's file — never the other ~832 — and
// makes zero PokeAPI requests for this data.
//
// `import.meta.glob` (not a hand-written per-move loader map, unlike
// catalogs.ts's small, fixed per-kind/lang LOADERS): there are 833+ moves,
// not 4 kinds x 2 languages, so Vite's own glob-based code-splitting is the
// right tool — each matched file still becomes its own lazily-imported
// chunk, exactly like the hand-written map does for the smaller catalogs.

import { VERSION_GROUP_ORDER } from './versionGroups';
import { LEARN_METHOD_ORDER } from '../utils/moveLearnMethods';

export interface LearnsetRelation {
  pokemonId: number;
  method: string;
  versionGroup: string;
  /** Only meaningful for 'level-up' (see the generator); 0 for every other method. */
  level: number;
}

type LearnsetRow = [number, number] | [number, number, number];
interface LearnsetFile {
  schema: number;
  move: string;
  byPokemon: Record<string, LearnsetRow[]>;
}

const loaders = import.meta.glob<{ default: LearnsetFile }>('../data/generated/learnsets/*.json');

function pathFor(moveSlug: string): string | undefined {
  const target = `../data/generated/learnsets/${moveSlug}.json`;
  return target in loaders ? target : undefined;
}

/**
 * Every Pokémon relation for a move, decoded to plain fields. Empty when
 * the move has no file (nothing learns it — some Z-moves/signature moves)
 * or an unrecognized slug; never throws for a missing move.
 */
export async function getMoveLearnsetRelations(moveSlug: string): Promise<LearnsetRelation[]> {
  const path = pathFor(moveSlug);
  if (!path) return [];
  const mod = await loaders[path]();
  const file = mod.default;
  const relations: LearnsetRelation[] = [];
  for (const [idStr, rows] of Object.entries(file.byPokemon)) {
    const pokemonId = Number(idStr);
    for (const row of rows) {
      const [methodIdx, vgIdx, level] = row;
      relations.push({
        pokemonId,
        method: LEARN_METHOD_ORDER[methodIdx] ?? 'level-up',
        versionGroup: VERSION_GROUP_ORDER[vgIdx] ?? '',
        level: level ?? 0,
      });
    }
  }
  return relations;
}
