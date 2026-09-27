# Move learnset relations: per-Pokémon method/level/game on the move page

Fase 2D (`feature/move-learnset-relations-phase2d`), following Move and
ability entities (Fase 2C, `docs/architecture/move-ability-entities.md`),
which shipped the move page's `PokemonRelationList` but left it without
per-Pokémon detail — the very limitation Fase 2C's own TODO called out:
"Relación Pokémon → movimiento con método/nivel" not built because it would
need a dataset an order of magnitude larger than `machines.json`. This
phase closes it, and adds a Game Context switch
(`docs/architecture/game-context.md`) so the list is honest about *which
game* a method/level applies to.

## 1. The problem

PokeAPI's move detail (`move/{x}`) only has `learned_by_pokemon`: a bare
list of names, no method, no level, no game. That detail lives on the
*Pokémon's* side — `pokemon/{id}.moves[].version_group_details` — the
exact inverse of what a move page needs. There is no
`move/{x}/learned-by-detailed` endpoint; PokeAPI was never going to add
one just for this.

The only way to get "which Pokémon learn Surf, how, and in which game" is
to fetch **every** Pokémon's full move list and invert it offline. That's
1351 `pokemon/{id}` requests (species + forms) — far more than every other
catalog combined — so it can't happen at request time, and it can't happen
as part of the default `npm run data:catalogs` either (it would make every
contributor's routine catalog refresh ~1351 requests slower for a dataset
most of them don't touch). It is opt-in:
`npm run data:catalogs -- --only=move-learnsets`, documented in
`scripts/generate-catalogs.ts`'s own header.

## 2. Generator (`scripts/generate-catalogs.ts`, move-learnsets branch)

Fetches every `pokemon/{id}` (1351 of them), and for each `moves[]` entry
inverts `move -> pokemon` instead of the API's native `pokemon -> move`.
Per relation, only `[methodIndex, versionGroupIndex, level]` is kept —
never the method/version-group **strings** themselves, which is what
`utils/moveLearnMethods.ts` (`LEARN_METHOD_ORDER`) and
`services/versionGroups.ts` (`VERSION_GROUP_ORDER`) are for: shared index
tables the generator encodes against and the runtime decodes with, so the
two can never drift apart. `level` is only meaningful for `level-up` — every
other method is always level 0 in PokeAPI, verified against live data. An
unrecognized method or version group throws immediately (fail the
generator run, not the page) — see those modules' comments for why the
list of methods is a curated, append-only enumeration rather than
whatever PokeAPI happens to return.

**One file per move** (`learnsets/{move}.json`), not one combined file:
measured against real data generated in this environment (2026-09-27) —
**638,321 relations across 833 moves** (from 1351 Pokémon), **7.6 MB raw /
~0.71 MB gzip total**, but a single combined file would cost every move
page the parse weight of all 833 moves' data; per-move files cost a page
only its own move (Surf: 22.6 KB raw / 1.6 KB gzip; Tackle: 35.3 KB raw /
2.4 KB gzip; Earthquake: 35.5 KB raw / 3.6 KB gzip). A move nothing learns
(some Z-moves/signature moves) gets no file at all. `learnsets/manifest.json`
(the 834th file) records counts and the same index tables for `--check`
staleness detection.

Verified deterministic: run twice back-to-back against live PokeAPI, byte-
identical output both times (`manifest.json`'s hash unchanged, same 833
moves / 638,321 relations / 1351 Pokémon), and `npm run data:catalogs:check`
passes clean against the committed files.

## 3. Runtime: `services/moveLearnsets.ts`

`getMoveLearnsetRelations(move)` reads `learnsets/{move}.json` and expands
it back into `{ pokemonId, method, versionGroup, level }[]`
(`LearnsetRelation`). Per-move files can't be a fixed, enumerable `Record`
of imports the way `services/catalogs.ts` does it (there are up to 833,
and the set isn't known statically) —
`import.meta.glob('../data/generated/learnsets/*.json')` is Vite's
mechanism for exactly this: one lazy dynamic import per matched file,
wired up at build time, with **zero bundler error** for a move that has no
file (glob just doesn't match it). A move with no file resolves to `[]`,
never a fetch, never a thrown error — an empty learnset degrades the page
gracefully instead of breaking it.

## 4. Pure transforms: `utils/moveLearnsetFacts.ts`

- `availableGameContextsForMove` / `defaultGameContextForMove`: the move's
  relations reduced to their version groups and handed to
  `services/gameContext.ts`'s existing `availableContextsForPokemon` /
  `defaultGameContextForPokemon` — that logic only ever cared about "which
  version groups does this thing have data in", true whether "this thing"
  is a Pokémon's own moves or a move's learners, so Fase 2D reuses it
  rather than re-deriving the DLC-folding/default-eligibility policy in a
  second place.
- `relationsForContext(relations, revisions)`: one entry per Pokémon that
  has a relation in any of a context's revisions (base game + its DLC —
  see `game-context.md` on why the whole span matters, not just the latest
  revision), with every distinct `(method, level)` pair it uses there. A
  Pokémon is never listed twice for having multiple raw
  `version_group_details` rows within the same context.
- `methodsPresent` / `filterByMethod`: the method dropdown's options and
  its filter ('all' = no filter).

## 5. The page (`src/pages/[lang]/movimientos/[name].astro`)

Server-renders the default Game Context's relations through
`PokemonRelationList` (ids resolved to real slugs/names via the
already-generated Pokémon catalog, `services/catalogs.ts` — zero extra
requests, same as machines/generation already were in Fase 2C). The
counter shows the current context's count, plus a "Total historical"
figure only when it's actually larger (distinct Pokémon across every
relation, any game) — same honest-disclosure principle Fase 2C fixed for
the ability page, extended to "which game" rather than just "how many
rendered". When a move has zero relations for the current filter, the
page server-renders the "no results" empty state directly (not just a
client-side toggle) — a crawler or no-JS visitor sees the real state.

Context/method switching happens client-side from one compact JSON
payload (`compactRelations`, index-encoded exactly like the generator's
own files) — no request per switch, the same pattern
`utils/movesPayload.ts` established for a Pokémon's own MovesTable. The
selected Game Context persists via `utils/gameContextStorage.ts` (already
built in Fase 2, reused here rather than a second storage key).

## 6. Tests

- `src/utils/moveLearnMethods.test.ts`, `src/utils/moveLearnsetFacts.test.ts`:
  the pure logic, unit-level.
- `src/services/moveLearnsets.test.ts`: runs against the real generated
  dataset (Earthquake, Wish, an unknown move), not a mock — this is the one
  suite that depends on `src/data/generated/learnsets/` actually existing.
- `src/pages/movement-crawlability.ssr.test.ts`, `src/pages/fetch-budget.ssr.test.ts`,
  `src/testing/moveAbilityEntities.ssr.test.ts`: page-level, with
  `services/moveLearnsets` mocked to supply fixture relations, independent
  of whether the generated dataset exists in a given test run.
  `fetch-budget` locks in the fetch-count win: 0 `pokemon/{id}` requests
  and 0 Showdown requests for the move page's learner list, warm or cold
  isolate alike, replacing the old `learned_by_pokemon` + `getPokemonCards`
  list (which needed both).
