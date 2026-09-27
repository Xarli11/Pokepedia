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

Three different, non-overlapping guarantees, none of which substitutes for
another:

1. **A full `--only=move-learnsets` run validates the actual content** —
   it re-fetches all 1351 `pokemon/{id}` and rebuilds every relation from
   scratch. This is the only one of the three that can catch "a Pokémon's
   learnset itself changed".
2. **Determinism**: run twice back-to-back against live PokeAPI, byte-
   identical output both times (`manifest.json`'s hash unchanged, same 833
   moves / 638,321 relations / 1351 Pokémon).
3. **`npm run data:catalogs:check`** passes clean against the committed
   files — but for learnsets this is a *lightweight, count-only* staleness
   check (committed `learnsets/manifest.json`'s Pokémon-list count vs the
   live `/pokemon` count), never a full re-fetch-and-diff of the 638,321
   relations. It catches "PokeAPI added/removed a Pokémon" staleness, not
   "an existing Pokémon's learnset itself changed" — that needs (1). See
   `check()` in `scripts/generate-catalogs.ts` for the exact comparison.

**Pruning stale files.** A move PokeAPI stops returning any relation for
(rare, but possible — a signature move reassigned, a removed Let's Go-only
move, etc.) previously got a `learnsets/{move}.json` that a subsequent run
would never touch again: the generator only ever wrote/overwrote names it
produced, never diffing against what was already on disk. Since the
runtime discovers files via `import.meta.glob`, a stale file would keep
being served as current data indefinitely, silently. `generate()` now:
snapshots the existing `learnsets/*.json` directory listing *before* the
(slow) fetch, computes the new set fully in memory, and only once
`buildMoveLearnsets()` has *already succeeded* — never before, never on a
failed run — deletes whatever existing name isn't in the new set and drops
its hash from the global `manifest.json` (which otherwise starts from
`{ ...previous.files }` and would keep a deleted file's hash forever). The
diff itself is a pure function,
`src/data/catalogs/learnsetPruning.ts` (`computeStaleLearnsetFiles`,
`pruneManifestHashes`), so it's unit-tested without touching the
filesystem or network; the file's own header explains why deletion safety
is the *caller's* responsibility (call it only after a successful build),
not something the pure diff can enforce by itself. Pruning is scoped
strictly to directory listings of `learnsets/`, so it can't reach any
other generated dataset by construction.

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
  its filter ('all' = no filter). `methodsPresent` orders its result by
  `LEARN_METHOD_ORDER`, never by relation/insertion order — the same
  method set must render in the same order regardless of which context
  produced it, since (see §5) it gets recomputed on every Game Context
  switch.

## 5. The page (`src/pages/[lang]/movimientos/[name].astro`)

Server-renders the default Game Context's relations through
`PokemonRelationList` (ids resolved to real slugs/names via the
already-generated Pokémon catalog, `services/catalogs.ts` — zero extra
requests, same as machines/generation already were in Fase 2C). When a
move has zero relations for the current filter, the page server-renders
the "no results" empty state directly (not just a client-side toggle) — a
crawler or no-JS visitor sees the real state.

Context/method switching happens client-side from one compact JSON
payload (`compactRelations`, index-encoded exactly like the generator's
own files) — no request per switch, the same pattern
`utils/movesPayload.ts` established for a Pokémon's own MovesTable. The
selected Game Context persists via `utils/gameContextStorage.ts` (already
built in Fase 2, reused here rather than a second storage key).

**The method filter is a property of the selected Game Context, not a
fixed, page-wide fact.** A bug found during PR review + live Cloudflare
Preview validation: the `<select>`'s options were originally computed
once, server-side, from the SSR default context's relations only — so a
method that exists in some *other* context (Outrage's Tutor relations:
absent from Scarlet/Violet, present in Platinum) could never be selected
even after switching to that context, because the options themselves were
never rebuilt. Fixed by calling `methodsPresent(relationsForContext(...))`
again — the exact same functions the SSR path already used — every time
the context changes (the context `<select>`'s `change` handler, and the
persisted-context hydration path if `localStorage` restores a context
other than the SSR default), rebuilding the `<option>` list, resetting the
filter to "all" (a method valid in the previous context may not exist, or
mean something else, in the new one), and hiding the whole control when
the new context has one method or fewer. No new state or source of truth:
the client already had every context's relations in the compact payload,
it's the read into `<option>` elements that was static once instead of
reactive.

**"Total histórico" has one fixed meaning, shown or hidden, never
partial.** It is always *distinct Pokémon across every relation this move
has, in any Game Context, computed once* — never scoped to the current
context or the current method filter. The same PR review found it was
originally an SSR-conditional element (`{condition && <span>...}`): once
omitted from the initial HTML because the SSR default context's count
already matched the historical total, no client-side context switch could
ever bring it back, even for a context where the two numbers legitimately
differ. It's now always rendered with a `hidden` class the client toggles,
shown only when (a) no method filter is active and (b) the current
context's unfiltered count is lower than the historical total — condition
(a) exists specifically so the figure is never visible at the same time as
a method-filtered count, which would read as if "Total histórico" meant
"total for this method" when it never does.

## 6. Tests

- `src/utils/moveLearnMethods.test.ts`, `src/utils/moveLearnsetFacts.test.ts`:
  the pure logic, unit-level — including `methodsPresent`'s
  `LEARN_METHOD_ORDER`-based ordering regardless of input order.
- `src/data/catalogs/learnsetPruning.test.ts`: the stale-file diff and
  manifest-hash pruning, pure and filesystem-free.
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
  list (which needed both). `moveAbilityEntities.ssr.test.ts` has the
  Outrage-shaped regression (a method present only in a non-default
  context must still reach the client payload, method wrapper hidden/shown
  by method count, "Total histórico" hidden/shown by context count vs
  historical count). `movement-crawlability.ssr.test.ts` has a
  source-pattern regression (same style as the existing MovesTable check)
  asserting the client script actually rebuilds the method `<select>` and
  toggles "Total histórico" on every context/method change, not just once
  at load — this is what a plain SSR-HTML assertion can't cover, since the
  bug lived entirely inside client-side interaction.
