# Game Context

Introduced in Fase 2 (`feature/game-context-phase2`, PokeAPI moves data as
the first real consumer). Builds on `src/services/versionGroups.ts`
(chronology, ES/EN labels, `defaultEligible`), which is unchanged and still
the source of truth for those three facts. Game Context answers a
different, higher-level question: **what does the user mean by "a game"?**

## 1. Game Context vs PokeAPI version group

A PokeAPI `version_group` is a data-revision granularity, not a game a
player would name. Concretely:

- Scarlet/Violet ships as **three** version groups:
  `scarlet-violet`, `the-teal-mask`, `the-indigo-disk`.
- Sword/Shield ships as **three**: `sword-shield`, `the-isle-of-armor`,
  `the-crown-tundra`.
- Legends: Z-A ships as **two**: `legends-za`, `mega-dimension`.

Showing "The Indigo Disk" as a selector option next to "Scarlet / Violet"
would make it look like a different game to someone who has never heard the
term "version group". A **Game Context** (`GameContextDefinition` in
`src/services/gameContext.ts`) is the game family; its `revisions` array
holds the PokeAPI version groups that belong to it, oldest first.
`revisions[0]` is always the base release and is reused as the context's
own `id` (the same string PokeAPI uses for that base version group — no
new id vocabulary was invented).

## 2. Classification

`kind` classifies the *context*, not each revision:

| kind | Meaning | Contexts today |
|---|---|---|
| `main-series` | "The current game" a player would name | everything except the two rows below |
| `spin-off` | Not part of the numbered/lettered series | Colosseum, XD |
| `battle` | Battle-only, not a game a Pokémon is "caught in" | Pokémon Champions |

`defaultEligible` mirrors `isDefaultEligible()` on the context's base
version group (`versionGroups.ts`) **and** requires `kind === 'main-series'`
— a context can never be the initial selection unless both hold.

## 3. Default context resolution

Policy (`defaultGameContextForPokemon`, `src/services/gameContext.ts`):

1. Among the contexts the Pokémon has any data for, prefer the most recent
   one with `defaultEligible: true`. A spin-off or battle-only game never
   displaces it, no matter how new (Champions is the newest PokeAPI group
   overall but is never the default while a main-series context exists).
2. Within the chosen context, use the most recent **revision** the Pokémon
   actually has data for. The context shown to the user does not change
   (still "Scarlet / Violet"), only the underlying data revision does.
3. If the Pokémon has no `defaultEligible` context at all (e.g. only
   Champions, or only Colosseum/XD), fall back to the most recent context
   of any kind — something is always selected.

Verified against `VERSION_GROUPS`' existing test cases and against live
PokeAPI data (see §6): Garchomp/Pikachu/Lucario → Scarlet/Violet (Champions
listed, not default); Genesect/Zeraora (no Scarlet/Violet data) →
Sword/Shield.

## 4. Revisions / DLC — the manually curated table

PokeAPI does not expose "this version group is a DLC of that one" as data.
`REVISION_OF` in `gameContext.ts` is a small, hand-written map, justified by
release history (documented inline, mirrors the non-obvious chronology
notes already in `versionGroups.ts`):

```
the-isle-of-armor  -> sword-shield     (2020 DLC)
the-crown-tundra   -> sword-shield     (2020 DLC)
the-teal-mask      -> scarlet-violet   (2023 DLC)
the-indigo-disk    -> scarlet-violet   (2023 DLC)
mega-dimension     -> legends-za       (DLC)
```

Every other version group becomes a single-revision context of its own
(Red/Blue, X/Y, Legends: Arceus, Colosseum, XD, Champions, …). This is
intentionally not inferred from name patterns ("the-*" is not a rule) — see
`docs/DATA_SOURCES.md`'s "Non-obvious chronology" notes for the same
principle applied to ordering.

### Important finding: DLC revisions carry no moves data today

Before building the selector, live PokeAPI data was checked (2026-09-27),
not assumed:

- `GET /version-group/the-indigo-disk` returns `"move_learn_methods": []`.
- Every Pokémon checked that is exclusive to Scarlet/Violet's DLC (Ogerpon,
  Okidogi, Walking Wake, Ursaluna-Bloodmoon, Iron Crown, Wo-Chien) has
  `scarlet-violet` — and only `scarlet-violet` — in
  `moves[].version_group_details`. `the-teal-mask` / `the-indigo-disk` /
  `the-isle-of-armor` / `the-crown-tundra` / `mega-dimension` do not appear
  in **any** Pokémon's moves data in practice.

**Consequence:** `defaultGameContextForPokemon` folding DLC revisions into
their base context is correct and forward-compatible, but for *moves* it is
currently a no-op — `availableContextsForPokemon` never actually sees a DLC
revision in the version groups moves data supplies, so the "context shows
Scarlet/Violet, revision resolves to Indigo Disk" case has no real Pokémon
to exercise it yet (it is exercised in tests with synthetic data, which is
correct: the policy must be right regardless of whether today's moves data
happens to trigger it). Other data domains PokeAPI *does* key by these DLC
groups (regional Pokédexes: `the-indigo-disk`'s `pokedexes` is `blueberry`)
will exercise it for real once Phase 2B reads them.

## 5. Spin-offs

Colosseum and XD stay visible and selectable — nothing is hidden — but
`defaultEligible: false` keeps them out of the default-resolution race,
same as the `battle` context (Pokémon Champions, §2). A Pokémon whose
*only* data is a spin-off (e.g. `['colosseum', 'xd']`) still needs a
selection, so the fallback in §3 step 3 picks the most recent of those.

## 6. Persistence

`src/utils/gameContextStorage.ts`, same pattern as `favorites.ts` /
`searchHistory.ts`: one `localStorage` key (`pokepedia_game_context`), one
bare context id string, read/written only through this module.

- `readGameContext(storage)` — the stored id, or `null` (missing, empty,
  or storage throws).
- `writeGameContext(storage, id)` — best-effort; never throws.
- `resolveContextForPokemon(stored, availableIds, fallback)` — the stored
  id if the current Pokémon has data for it, otherwise `fallback`
  (typically the page's own server-computed default). A corrupted or
  unrecognized stored value behaves exactly like nothing being stored.

Flow: pick Sword/Shield on Garchomp → open Lucario (also has Sword/Shield)
→ stays on Sword/Shield. Open a Pokémon without Sword/Shield data → falls
back to that Pokémon's own default, and picking a game there does not
retroactively "fix" Sword/Shield for Pokémon that never had it.

## 7. SSR / client resolution

`MovesTable.astro` computes `defaultGameContextForPokemon()` and
`availableContextsForPokemon()` at render time — no client requirement to
show a correct, fully-linked page. The container carries:

- `data-initial-version` / `data-initial-context` — the server's choice.
- `data-context-revisions` — `{contextId: representativeRevision}` for
  every context this Pokémon has, so the client never needs to re-derive
  the DLC-folding table.

On hydration, the client reads the persisted context (`readGameContext`)
and, only if `contextRevisions` contains it, switches the selector and
re-renders from the **already-shipped** compact payload
(`utils/movesPayload.ts`) — no PokeAPI request for the switch itself (the
per-move flavor-text prefetch is pre-existing, unrelated behavior). If the
persisted context is not available for this Pokémon, the SSR default is
left untouched: no flash, no extra render pass.

## 8. UX

The selector (`#versionFilter`, labelled "Juego" / "Game") lists **one
option per Game Context**, not per version group — the same select element
as before Fase 2, now populated from `availableContextsForPokemon()`
instead of the raw version-group list. A context with DLC folded into it
shows one label ("Escarlata / Púrpura"); the revision inside it is never
exposed as a second control, because no real learnset data currently
differs between a base game and its DLC (§4) — reopening that decision
belongs to whichever future phase reads data that does differ per DLC
(locations, regional Pokédexes).

## 9. How to add a future game

1. Add the new version group(s) to `VERSION_GROUPS` in `versionGroups.ts`
   (chronological position, ES/EN label, `defaultEligible`) — unchanged
   process from Fase 1.
2. If it is a base game: nothing else to do — `buildGameContexts()` gives
   it its own single-revision context automatically.
3. If it is a DLC/revision of an existing game: add one entry to
   `REVISION_OF` in `gameContext.ts` pointing at the base context's id, and
   document the release justifying it (mirroring §4's table).
4. If it is a spin-off or battle-only release: add its id to
   `SPIN_OFF_CONTEXTS` or `BATTLE_CONTEXTS` in `gameContext.ts`.
5. Add it to the relevant assertions in `gameContext.test.ts` (uniqueness,
   labels, chronology already run over every known group automatically).

## 10. Doubtful decisions

- Folding DLC into the base context's label, using its *latest* available
  revision for data, was chosen over exposing a second "revision" selector
  because no real moves-data difference between a base game and its DLC
  was found (§4). If a future data domain needs users to pick a revision
  explicitly, that is a new, small UI decision layered on
  `availableRevisions` (already returned by `availableContextsForPokemon`)
  — the model does not need to change.
- Pokémon Champions is currently classified `battle`, not `spin-off`,
  because it is not part of the mainline numbered/lettered series and is
  explicitly a competitive-battle product, matching how `versionGroups.ts`
  already treated it (`defaultEligible: false`, newest group).

## 11. Current limitations

- The DLC-folding table is not exercised by any real Pokémon's **moves**
  data today (§4) — it is correct by construction and tested with
  synthetic data, but has not been observed live for moves specifically.
  Re-verify against PokeAPI whenever a new game's DLC ships, in case that
  changes. (Fase 2E found the first real, live confirmation of the
  underlying model in a different data domain: Pikachu's regional Pokédex
  numbers include a real `isle-of-armor` entry alongside its `galar` one —
  both correctly fold into the single "Sword / Shield" context, §12.)
- Learn methods and machines (MT/HM/TR) consume Game Context since Fase 2D
  (`docs/architecture/move-learnset-relations.md`); the regional Pokédex
  does since Fase 2E (§12). **Availability and locations/encounters remain
  out of scope** — see §12's note on why "this Pokémon has Game Context X
  data" is not the same claim as "this Pokémon is obtainable in game X",
  and `TODO.md` for the future investigation this would need before a
  Fase 2F.
- No indexable URL exists per Game Context. It is UI state only, as
  decided for this phase; see the PR description for the criteria that
  would justify one later.

## 12. Fase 2E: regional Pokédex numbers

The Pokémon page's regional Pokédex section (`buildPokemonFacts`'s
`regionalDex`, previously an unfiltered dump of every dex a species has
ever been numbered in) now shows only the entries relevant to the page's
Game Context, plus any explicitly global ones.

**Metadata** (`src/services/pokedexes.ts`): each `PokedexMeta` gained
`versionGroups` (which PokeAPI version groups a dex's numbers apply to)
and `global` (whether it applies to every context regardless), both
hand-verified live against every `/pokedex/{name}` (2026-09-27) — the same
rigor the rest of that table already had. **Two of the 35 dexes came back
with an empty `version_groups` from PokeAPI itself; each was a distinct,
explicit decision, never an inferred default**:
- `national`: `global: true`. It is the cross-game index by definition —
  the empty array is PokeAPI confirming there is no per-game breakdown,
  not a gap.
- `conquest-gallery`: `global: false`. It is already excluded before
  context-filtering ever runs (`isMainSeriesPokedex`), so nothing in this
  feature depends on what its `versionGroups` would mean if it did.

The other 33 dexes all came back with at least one real version group —
there is no "known main-series dex with genuinely undecided empty data"
case left. An entry this table has no record of at all (`pokedexVersionGroups`
returning `undefined`, not `[]`) is treated as visible for every context —
fail open, matching `pokedexLabel`'s existing fallback for an unrecognized
name — rather than silently hiding real data for a gap in the table.

**Filtering** (`regionalDexEntriesForContext`, `src/utils/pokemonFacts.ts`):
pure, same shape as Fase 2D's `relationsForContext` — a dex entry shows for
a context when it's global, or its `versionGroups` intersect the context's
`revisions` (the whole DLC/base-game span, never just the latest
revision — same policy as everywhere else Game Context is consumed).

**One Game Context computation, not two.** Before this phase, `MovesTable`
was the only page section that derived Game Context, and did so from its
own `moves` prop internally. The Pokémon page now computes
`availableContextsForPokemon` / `defaultGameContextForPokemon` once
(from `versionGroupsFromMoveDetails(detail.moves)`, extracted to
`utils/movesPayload.ts` so both call sites derive the raw version-group
list identically) and passes the result to `MovesTable` as optional props;
`MovesTable` only self-computes them when a caller doesn't provide them
(existing standalone tests still do, unaffected). The regional Pokédex
section reads the same computation's SSR output for its default render.

**Reactivity without a second selector.** `MovesTable`'s own `<select>`
remains the page's only Game Context control. Its client script now
broadcasts `pokepedia:game-context-change` (`{ contextId }`, a plain DOM
`CustomEvent`) every time `currentContext` is resolved: once up front
(covering both the SSR default and any persisted context already restored
from `localStorage` above it in the same function) and again on every
manual selection. The regional Pokédex section's own script listens for
this — but, critically, **does not depend on it for correctness on
load**: module scripts execute in document order, `MovesTable`'s sits
earlier and dispatches synchronously, so a listener registered afterward
would already have missed that first event. Instead, the regional
Pokédex script independently resolves the exact same initial state
(persisted context if this Pokémon has data for it, else the SSR default)
using the identical pure function and storage key
(`resolveContextForPokemon`, `utils/gameContextStorage.ts`) — so both
sections deterministically agree on load regardless of script ordering,
and the event is only ever relied on for a later, live change (always
safe, since both listeners are long registered by the time a person can
interact with the selector).

**"Total histórico"** follows the exact rule Fase 2D established for
learnsets: always rendered (never SSR-omitted, which — as Fase 2D found
the hard way — would make it unable to ever appear again after a context
change), client-toggled, meaning *distinct historical entries across every
Game Context* — never scoped to whatever is currently filtered.

**Game Context ≠ availability/capturability.** `availableContextsForPokemon`
answers "does this Pokémon have *move* data for this context" — it is
reused as-is for the regional Pokédex's revisions, but that is still a
statement about which contexts have data in hand, not a claim that a
Pokémon is obtainable/encounterable in a given game. No "Available in: ..."
section was built from it (that would have been exactly this
conflation); see `TODO.md` for where real availability (encounters/
locations) is tracked as a distinct, unstarted future investigation.

**Explicitly out of scope for Fase 2E** (deferred to a possible future
phase, not started): `/pokemon/{id}/encounters`, location areas and their
translations, encounter methods, a `version -> Game Context` mapping
(encounters are keyed by PokeAPI `version`, not `version_group` — a
different relationship this phase did not need and did not build), and
filtering varieties/forms by game.
