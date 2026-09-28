# Move and ability entities: mechanics, machines, relations

Fase 2C (`feature/move-ability-entities-phase2c`), following Game Context
(Fase 2, `docs/architecture/game-context.md`) and the Pokémon factual
profile (Fase 2B, `docs/architecture/pokemon-entity.md`). Expands
`/movimientos/{slug}/` and `/habilidades/{slug}/` with mechanical facts,
generation links, MT/HM/TR availability, historical changes, and replaces
the Pokémon-relation grids with a lighter, honest-counting component.

## 1. Audit: what the pages had, what was missing

**Move page** had: type, category, power, accuracy, PP, priority, the
best-available description (flavor or a factual sentence), and a
learned-by Pokémon grid capped at 40 with an honest "Showing N" counter.
Missing, all free (already on `move`, no new request): `target`, `meta`
(ailment, drain/healing/crit/flinch, hit/turn counts, stat chance),
`stat_changes`, `generation`, `past_values`. `move.machines` exists but
listing it per-page would mean a request per machine (up to a few dozen —
Earthquake has 25); not fetched before this phase.

**Ability page** had: the best-available description (flavor *or* effect,
mixed with no distinction) and a Pokémon grid whose counter was a real bug:
it showed `pokemonList.length` — the **capped** card count — as if it were
the total, unlike the move page's honest disclosure. Missing: `generation`,
`is_main_series`, `effect_changes`, and any distinction between normal and
hidden ability holders in the list (`is_hidden` was fetched but unused).

**Known issue confirmed, not assumed**: yes, a move like Earthquake lists
hundreds of Pokémon and the page only renders a capped sample — the move
page already disclosed this honestly ("Showing 40 of N") before this
phase; the ability page did not (bug, now fixed, see §6).

## 2. `MoveMechanics` (`src/utils/moveFacts.ts`)

Normalizes `move.target`, `move.meta` and `move.stat_changes` into a
presentation-ready shape. Zero/none/unknown values are treated as "nothing
to report" and omitted — never rendered as "0% recoil" or "1 hit".

```
MoveMechanics {
  target, ailment, ailmentChance,
  drain, recoil,        // meta.drain's sign split into two honest, non-negative facts
  healing, critRate, flinchChance,
  minHits, maxHits, minTurns, maxTurns,
  statChanges[], statChance,
}
```

PokeAPI's single `meta.drain` field is signed: positive means the move
drains HP from the target to heal the user (Giga Drain), negative means
the user takes recoil (Double-Edge). Splitting it into `drain` and
`recoil` — verified against real data (Double-Edge: `drain: -33` → 33%
recoil; Giga Drain: `drain: 50` → 50% drain) — means the template never
has to know the sign convention.

**Contest data**: not read. Low priority, as scoped, and no clear
encyclopedic value beyond what's already shown was found to justify it.

## 3. Move flags (contact, Protect, sound, punch, bite, ...) — built in Fase 2F

Originally investigated and deliberately not built in this phase (see
below for the reasoning at the time); **implemented in Fase 2F**
(2026-09-28) once it was scoped as its own small, offline, generated
dataset rather than a live integration. PokeAPI's `move.meta` still
exposes none of these at all (verified against Earthquake's `meta`
object). Showdown's `moves.json` has a real `flags` object per move (37
distinct flag names total, verified live); a curated factual subset
(contact, protect, sound, powder, punch, bite, pulse, bullet, dance,
slicing, wind — excluding battle-mechanic-interaction flags like mirror/
metronome/snatch/futuremove, which would have turned this into
competitive analysis) is fetched once (single `moves.json` request, not
per-move) by `scripts/generate-catalogs.ts`'s move-flags builder, matched
to PokeAPI moves by id (Showdown's own `num` field equals PokeAPI's move
id — verified live), and written to `src/data/generated/move-flags.json`
(711 of 937 moves have at least one factual flag, 12.8 KB, deterministic).
Runtime: `src/services/moveFlagsData.ts`, zero PokeAPI/Showdown requests.
Labels centralized in `src/utils/moveFlags.ts`. See
`docs/architecture/move-learnset-relations.md`'s §2 for why "one small
combined file" (not per-move files like `learnsets/`) was the right
choice here: the dataset is tiny even before any splitting.

The original blocker (a "new data source... its own fetch/cache
integration") turned out smaller than expected in practice: Showdown's
move data needed exactly the same one-time, offline, generated-dataset
treatment `machines.json` already used for MT/HM/TR — not a live
integration at all.

**These are current properties, not a historical or per-Game-Context
record.** `moves.json` reflects Showdown's latest supported generation;
Showdown itself keeps older generations as separate per-gen data this
project doesn't fetch, so a flag could in principle have differed in an
older game — this dataset makes no claim either way for any specific past
generation. Nothing here is wired to Game Context, and building a
historical version (or a Game-Context-aware selector on top of it) is
explicitly out of scope for now, not attempted, and not assumed easy —
see `src/utils/moveFlags.ts`'s own header.

## 4. `target` labels

16 `move-target` values. PokeAPI has **no** Spanish names for any of them
(verified live: every `names` entry is English-only, and one value,
`fainting-pokemon`, has no name in any language). `targetLabel()` in
`moveFacts.ts` is a hand-written ES/EN table, same pattern as
`versionGroups.ts`'s labels.

## 5. Stat changes / status

`stat_changes` render as `"{stat} {±stage}"` pairs plus their probability
(`meta.stat_chance`) when the move doesn't guarantee them. An ailment
(`meta.ailment`, when not `none`/`unknown`) renders with its chance the
same way. `ailmentLabel()` is a second hand-written ES/EN table (20
values) — PokeAPI's own `move-ailment` resource does have real names, but
fetching them live per ailment would be another live dependency for a
closed, tiny, stable vocabulary, so they were hand-verified once instead
(same reasoning as `versionGroups.ts`/`pokedexes.ts`). Structured facts
only, never text: `effect_entries` (flavor) is used solely for the page's
description, not mixed into the mechanics section, so there's one source
of truth for mechanics (§2) and one for descriptive text (`moveMeta.ts`,
unchanged).

## 6. Ability effect vs. flavor text (`src/utils/abilityFacts.ts`)

`resolveAbilityEffect()` picks, in order: the mechanical effect
(`effect_entries`) in the requested language → the mechanical effect in
English (labelled as effect, not silently swapped for flavor) → flavor
text in the requested language → flavor text in English. The page shows
which kind of text it's displaying ("Efecto" vs. "Descripción de juego")
so flavor text is never presented as if it were an exhaustive mechanical
explanation. Verified live: Rough Skin has no Spanish `effect_entries` at
all — the Spanish page correctly falls back to the English *effect* (not
flavor), labelled "Efecto".

**Fixed bug**: `pokemonList.length` (the capped count) was shown as the
ability's total Pokémon count. Now `abilityData.pokemon.length` is the
displayed total, with the same "Showing N" disclosure the move page
already had, only when the list is actually capped.

## 7. Historical changes

Both entities expose a real change history in PokeAPI, rendered only when
there's data (never an empty section):

- **Moves**: `past_values`. Rendered per PokeAPI's own documented
  semantics — a `past_values` entry's fields are the value that held
  *through* its `version_group`, a `null` field meaning it had already
  reached the current value by then. Shown as *"{game} and earlier:
  {values}"*, literally matching that semantics rather than reversing it.
  Verified against Tackle (accuracy 95/power 35 through Black/White) and
  Bite/Karate Chop (Normal-type through Gold/Silver, before the Gen VI
  retype to Dark/Fighting).
- **Abilities**: `effect_changes`. Same per-language fallback as the
  current effect (§6); verified against Intimidate, which has real
  historical text ("Has no overworld effect." through Emerald, "Does not
  take effect..." through Diamond/Pearl).

## 8. MT / MO / TR (`src/data/generated/machines.json`, `src/services/machines.ts`)

A move's own `machines` field lists only machine *ids* — resolving even
one move's full history (Earthquake: 25 entries) at request time would
mean up to 25 extra PokeAPI requests per page view. Instead, all 2372
`/machine/{id}` resources are fetched **once, offline**, by
`scripts/generate-catalogs.ts` (`--only=machines`), building
`move -> [itemSlug, versionGroupSlug][]` (~63 KB, committed, same
provenance/validation conventions as the other catalogs — see
`docs/DATA_SOURCES.md`). At request time, `getMachinesForMove()` is a
zero-network `Map` lookup; the item's localized label comes from the
already-generated items catalog (`tm26` → "MT26" in `items.es.json`), the
version group's label from the existing `versionGroupLabel()` — no
duplicated translation data. Verified: Earthquake resolves to TM26 in
Red/Blue through modern games, matching the well-known real fact. A move
never listed as a machine (Tackle) simply has no MT/HM/TR section — not
guessed, not shown empty. More than 8 entries collapse into a native
`<details>` (still full SSR HTML, no JavaScript, still crawlable) rather
than truncating them.

## 9. Relations: `PokemonRelationList` (`src/components/PokemonRelationList.astro`)

Replaces `PokemonCard` on both pages: sprite + name + link + one
relation-specific detail (ability page: "Oculta"/"Hidden" when
`is_hidden`; move page: none — no per-Pokémon level/method data is
available without either a large offline learnset dataset or a
per-Pokémon request cascade, see §10). No type pills, no Smogon tier
badge — dropping the tier badge here also removes competitive-tier
content from these factual pages, consistent with Pokepedia's established
product boundary (`docs/DATA_SOURCES.md`'s Product boundaries section).
Real `<a href>`s, server-rendered, crawlable without JS.

The lighter per-row cost let the cap rise from 40 to 60 on both pages
while the pages got **smaller**, not bigger (§12) — `PokemonCard`'s
300px-reserved layout, type pills and tier-badge markup cost far more per
row than the new list.

## 10. Pokémon-that-learn-a-move relation dataset: investigated, not built

The user-facing want ("Garchomp — Level 40" / "Garchomp — TM") needs
*method + level per (Pokémon, move)* pair, which is not on the move
object at all (`move.learned_by_pokemon` is bare `{name, url}`) — it's
only on each Pokémon's own `moves[].version_group_details`. Resolving it
for a move's full learner list would mean fetching every one of those
Pokémon's full `pokemon/{id}` objects (~300 KB each) at request time — the
exact N-request-cascade problem `getPokemonCards`'s Showdown-batch design
was already built to avoid (see `docs/DATA_SOURCES.md`'s Pokémon cards
note) — or building a new, genuinely large offline dataset: every
(Pokémon × move × version group × method) triple across ~1300 Pokémon,
an order of magnitude bigger than the machines dataset (§8) and a
project of its own. Not attempted in this phase; tracked as debt
(TODO.md) rather than forced through fragile or expensive at either
build- or request-time.

## 11. Relation graph (materialized so far)

```
Pokemon --learns--> Move            (existing: MovesTable, Game Context)
Pokemon --hasAbility--> Ability     (existing: Pokémon page)
Move --introducedIn--> Generation   (new, this phase)
Ability --introducedIn--> Generation (new, this phase)
Move --machineIn--> Item+VersionGroup (new, this phase: machines.json)
Ability --relatesTo--> Pokemon (Fase 2C: PokemonRelationList, normal/hidden)
Move --relatesTo--> Pokemon    (Fase 2C: PokemonRelationList, no method/level — §10)
```

No database: every edge here is either a field already on a fetched
PokeAPI object, or one small generated file (`machines.json`), matching
the project's existing generated-catalogs approach.

## 12. Performance

No new PokeAPI requests per page (machines/generation/mechanics/history
all come from data already fetched or a build-time dataset). Measured
(local dev server, `develop` in an isolated worktree vs. this branch,
2026-09-27) — **pages got smaller despite showing more content and more
Pokémon per page**, because the new `PokemonRelationList` costs far less
per row than the `PokemonCard` grid it replaced:

| Page | Raw HTML (before → after) | gzip (before → after) |
|---|---|---|
| Earthquake | 456.6 → 259.6 KB (−43.1%) | 29.5 → 25.7 KB (−12.8%) |
| Tackle | 458.9 → 252.3 KB (−45.0%) | 29.4 → 25.2 KB (−14.3%) |
| Intimidate | 451.4 → 229.4 KB (−49.2%) | 29.1 → 24.9 KB (−14.3%) |
| Levitate | 453.9 → 221.1 KB (−51.3%) | 29.0 → 24.3 KB (−16.2%) |

## 13. SSR / internal linking / SEO

Everything new is server-rendered HTML — mechanics, generation link,
machines, history and the relation list all exist without JavaScript.
Generation links use `pagePath()` (no hardcoded routes), the same pattern
the Pokémon page already established. Egg-group-style "no page exists"
reasoning does not apply here: generation pages already exist and are
linked. No structured-data change: `BreadcrumbList` (already present, both
pages) is left as-is; no Schema.org `DefinedTerm` or similar was added —
judged not clearly justified over the existing valid markup. Titles/
descriptions were not changed automatically — same reasoning as Fase 2B:
new facts are supplementary depth, not a new primary search intent.

## 14. Limitations

- No move-flag data (contact, Protect, sound, punch, ...) — §3.
- No per-Pokémon method/level on the move page's relation list — §10.
- `past_values`/`effect_changes` ES coverage is whatever PokeAPI itself
  has; a change with no text in any language is silently dropped rather
  than shown empty (verified: this does happen for some `effect_changes`
  entries with only e.g. `fr` text, decided not worth a placeholder).
- No browser/E2E tool was available in this session. Verification: real
  PokeAPI data through a local `npm run dev` server (`curl`), covering
  Earthquake, Tackle, Body Slam, Double-Edge, Giga Drain, Fury Swipes,
  Rough Skin, Intimidate and Levitate in ES and EN, plus the full SSR
  integration test suite (`src/testing/moveAbilityEntities.ssr.test.ts`).
