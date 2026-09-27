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

- The DLC-folding table is not exercised by any real Pokémon's moves data
  today (§4) — it is correct by construction and tested with synthetic
  data, but has not been observed live. Re-verify against PokeAPI whenever
  a new game's DLC ships, in case that changes.
- Only moves consume Game Context. Learn methods, machines (MT/TR/MO),
  availability, locations and regional Pokédexes are explicitly out of
  scope for this phase (see the PR description) — they are the intended
  next consumers of `availableContextsForPokemon` /
  `defaultGameContextForPokemon`, not yet wired up.
- No indexable URL exists per Game Context. It is UI state only, as
  decided for this phase; see the PR description for the criteria that
  would justify one later.
