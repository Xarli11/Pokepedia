# Pokémon entity page: factual profile

Fase 2B (`feature/pokemon-entity-phase2b`). Expands
`src/pages/[lang]/pokemon/[name].astro` into a fuller encyclopedic profile
without adding a single new PokeAPI request per page: every new field comes
from the `pokemon` + `pokemon-species` objects the page already fetches.

## 1. Sources

Everything in this phase is PokeAPI's `pokemon-species/{id}` (mostly) and
`pokemon/{id}` (`stats[].effort`, `base_experience`), both already fetched
by `getPokemonByName()` before this phase existed. No new endpoint, no new
request. `src/services/pokeapi.ts`'s `PokemonSpecies`/`PokemonDetail`
interfaces were extended (additive only) to type the fields this phase
reads: `genera`, `capture_rate`, `base_happiness`, `hatch_counter`,
`gender_rate`, `growth_rate`, `egg_groups`, `pokedex_numbers`, `is_baby`,
`is_legendary`, `is_mythical`, `evolves_from_species` (typed, not yet
consumed — see §9), and `stats[].effort` / `base_experience`.

## 2. Audit: what the page had, what was missing

Before this phase, the page already showed: name, National Dex number,
types (linked), height/weight (metric only), base stats (radar + bars),
abilities (linked, normal/hidden via `is_hidden`), evolution chain,
varieties/forms, generation (linked), Smogon tier, moves (Game Context).

Missing, despite being free (already in `species`): base experience,
capture rate, base happiness, growth rate, EV yield, egg groups, gender
ratio, egg cycles, baby/legendary/mythical classification, genus
("Mach Pokémon"), and non-national regional Pokédex numbers.

Nothing required a *new* request — the species object PokeAPI already
returns had always carried these fields; they were simply not read.

## 3. Factual model: `src/utils/pokemonFacts.ts`

`buildPokemonFacts(detail, species)` is pure and language-agnostic: it
takes the already-fetched objects and returns a `PokemonFacts` (training,
breeding, classification, regionalDex). Labels are resolved separately
(`growthRateLabel`, `eggGroupLabel`, `pokedexLabel` in
`src/services/pokedexes.ts`) at render time, for the page's own language —
the facts layer itself carries no ES/EN text, only PokeAPI's raw slugs and
numbers. The Astro template calls `buildPokemonFacts()` once and renders
its output; it does not re-derive any of this from raw `species` fields
itself.

```
PokemonFacts {
  training: { baseExperience, captureRate, baseHappiness, growthRate, evYield[] }
  breeding: { eggGroups[], gender: {genderless, malePercent, femalePercent}, hatchCounter }
  classification: { isBaby, isLegendary, isMythical }
  regionalDex: { pokedex, entryNumber }[]
}
```

### `gender_rate` semantics (verified, not assumed)

PokeAPI's `gender_rate` is **eighths that are female**, not a direct
percentage: `-1` = genderless, `0` = 0/8 female (100% male), `8` = 8/8
female (100% female), `4` = the common 50/50 split, `1` = 1/8 female
(87.5% male / 12.5% female, e.g. several species with a heavy male skew).
`genderInfo()` implements exactly this and degrades to `genderless` (never
`NaN`) if the input is missing or not a number.

### EV yield

`stats[].effort` straight from `pokemon/{id}` — `evYield()` keeps only the
non-zero entries, in the Pokémon's own stat order, so "0 Attack" never
renders and a Pokémon that yields two stats shows both
("3 Speed" / "1 Attack + 2 Speed").

## 4. Training

Shown when present: base experience, capture rate, base happiness (many
Legendaries have `base_happiness: null` in PokeAPI — omitted, not `0` or
`N/A`), growth rate (localized — see §7), EV yield.

## 5. Breeding

Egg groups (localized, PokeAPI does provide real `es`/`en` names for
these — used as-is, not re-invented), gender ratio (§3), egg cycles
(`hatch_counter`, omitted when `null`).

## 6. Classification

Three badges next to the name, each shown only when true:
Baby/Legendary/Mythical. `color`/`shape`/`habitat` (also on `species`)
were deliberately **not** added: they don't have an established ES
translation table in this project and their encyclopedic value on a
Pokémon-focused page was judged low relative to the UI cost of adding a
fourth data domain here — explicitly discarded, not missed.

## 7. Regional Pokédex numbers

`src/services/pokedexes.ts`: a hand-verified table of all 35 PokeAPI
`pokedex` resources (checked live 2026-09-27 — not guessed from names),
carrying real ES/EN names and PokeAPI's own `is_main_series` flag.
`conquest-gallery` (Pokémon Conquest's gallery order) and `champions`
(the Pokémon Champions battle dex — the same game `gameContext.ts`
classifies `battle`) are the only two `is_main_series: false` entries;
`regionalDexEntries()` drops them, so a species' Champions "dex number" (an
arbitrary roster position, not a Pokédex entry a player looks up) never
appears next to real ones. `original-*` and `updated-*` dexes for the same
region (e.g. Johto) are **not** duplicates — they are different real
games' dexes (Gold/Silver/Crystal vs. HeartGold/SoulSilver) — both are
shown, ordered by the table's fixed display order (national first, then
roughly geographic/chronological), never PokeAPI's own array order.

## 8. Game Context

**Correction (2026-09-27, before merge):** an earlier draft of this section
claimed the training/breeding fields are "the same for every game" —
that is not accurate and has been corrected here.

Not reused in this phase. What `PokemonFacts` actually shows is **the
single current value PokeAPI exposes today** for `pokemon`/
`pokemon-species` — a snapshot, not a verified cross-game invariant.
PokeAPI's species/pokemon resources are not version-grouped for most of
these fields (there is one `capture_rate`, one `base_happiness`, one
`growth_rate`, one `egg_groups` list, one set of `stats[].effort` per
species/variety — not one per game), so there is no alternative value in
the API to select between even if Game Context were wired in here. That is
a statement about what PokeAPI's data model gives Pokepedia today, not a
claim that the real games never changed these numbers.

In fact several of these fields **have** changed across real games and
generations — documented, not assumed:

- **Base friendship** (`base_happiness`) changed for a number of species
  starting in Generation VIII.
- **EV yield** has changed for some species across generations (most
  visibly around the Gen VI EV-yield rebalances).
- **Capture rate** has changed for some species between games.
- **Base experience** has also changed historically for a number of
  species.

**Update, Fase 2F (2026-09-28) — audited one field at a time, live, before
assuming any of these could or couldn't be done:**

- **EV yield (and base stats): real history exists.** `pokemon.past_stats`
  is a genuine, generation-scoped field PokeAPI already exposes — the
  same mechanism as moves' `past_values`, just discovered here rather than
  assumed absent. Verified live: Bulbasaur's Gen I entry lists its single
  unified `special` stat (base 65) from before the physical/special
  split, `effort` included. Implemented: `pastStatChanges()`
  (`utils/pokemonFacts.ts`), rendered as a "Cambios históricos" section on
  the Pokémon page, same heading/style as the move page's own historical
  changes. No historical value is invented — the section shows exactly
  what PokeAPI's `past_stats` lists, no more. PokeAPI documents
  `generation` here as the last generation the listed values applied
  through; in every real entry seen so far, `stats` holds only what
  actually differed from the current value, but that's an observation
  about the data, not a documented API contract — `pastStatChanges()`
  passes it through as-is rather than asserting either property itself.
- **Base friendship, capture rate, base experience: confirmed, still no
  historical source.** Re-verified live 2026-09-28 against
  `pokemon-species` (`base_happiness`, `capture_rate` are flat scalars,
  no `past_*` sibling field anywhere in the schema) and `pokemon`
  (`base_experience` likewise — the resource's `past_*` fields are only
  `past_abilities`, `past_stats`, `past_types`). Showdown's own data is
  current-generation only, not a multi-generation history either. These
  three remain **documented current-value-only facts**, not reconstructed
  by rule — this is a real, evidence-based limitation, not a shortcut.

`pokedex_numbers` **is** version-group-adjacent (a Pokédex belongs to a
specific set of games — `isle-of-armor` the dex, not just the item), but
showing it as plain factual data ("appears in the Isle of Armor dex,
#123") needs no context *switch* today: the entry is either present or
absent in PokeAPI's response, unconditionally. Wiring Game Context into
this list (e.g. "hide this dex unless the moves table is on Sword/Shield")
is left for whenever a real product need for it shows up — documented, not
built, per this phase's scope.

### Debt: Game Context — historical Pokémon facts

Not started, not scoped for a specific phase. If historical accuracy for
these fields becomes a real product priority, a future phase would need to
evaluate, per field, whether it is worth building a versioned dataset for
it (candidates, not a commitment that all of them need it):

- Base friendship (confirmed Gen VIII+ changes for some species).
- EV yield (confirmed historical changes for some species).
- Capture rate (confirmed changes for some species across games).
- Base experience (confirmed historical changes for some species).
- Any other field a future audit confirms varies.

Not every candidate necessarily justifies the cost of a generated,
version-aware dataset — that judgment is for whoever scopes that phase,
informed by how much each field's variance actually matters to Pokepedia's
readers vs. the cost of building and maintaining it.

## 9. Forms/varieties, abilities, evolution — reviewed, not rebuilt

- **Varieties**: unchanged, re-audited in Fase 2F (2026-09-28). The earlier
  claim here — "PokeAPI does not cleanly expose [Mega/Gigamax/regional] as
  a field on `varieties`" — was imprecise and is corrected: it isn't on
  `varieties` itself, but the separate `pokemon-form` resource each
  variety points to *does* have real, structured fields for exactly this
  (`is_mega: boolean`, `is_battle_only: boolean`, `form_name: 'gmax'` for
  Gigamax forms — verified live against Venusaur-Gmax and a Sandshrew
  regional form; `form_names` even has real `es` translations, unlike
  location-area/encounter-method, see §Encounters below). Classifying a
  variety this way needs one additional `pokemon-form` fetch per variety
  not currently made (today's suffix-parsed label, e.g. "(Mega)"/
  "(Gigamax)" from the Pokémon's own name string, already covers the
  common cases reasonably well in practice). Still judged out of scope for
  Fase 2F specifically for that reason — a handful of new requests per
  page that has varieties — not because the data doesn't exist; flagged
  as future debt if the name-suffix approach is ever found wrong for a
  real species.
- **Abilities**: unchanged. Already uses `is_hidden` and never labels a
  normal slot "primary" when there are two.
- **Evolution**: unchanged (`EvolutionChain` works and is out of this
  phase's scope). `species.evolves_from_species` was typed but is not
  rendered — the chain component already shows the full lineage; a
  standalone "Evolves from X" line was judged redundant.

## 10. Encounters / locations / real availability — investigated, deferred (Fase 2F)

The single largest remaining factual gap ("where/how can this Pokémon
actually be obtained") was investigated in depth before deciding not to
build it, rather than skipped on assumption. Evidence, all gathered live
2026-09-28:

- **`/pokemon/{id}/encounters` size is wildly variable and can be large**:
  6.5 KB (Bulbasaur) up to 957 KB (Magikarp — fished almost everywhere).
  An offline dataset built the same way as `learnsets/` (Fase 2D) would
  require fetching this for all ~1351 Pokémon — likely tens of MB raw
  before any compaction, an order of magnitude past `learnsets/` itself
  (which was already the most expensive dataset in this project).
- **No Spanish translations exist for the two resources this data is
  built from**: `location-area` (checked 5 samples across the full range,
  1539 total resources) and `encounter-method` (all 66) both came back
  `en`/`de`/`fr` only, zero `es` entries — some `location-area` resources
  have no `names` in any language at all. Building this feature would
  mean either showing raw English location names on the Spanish site
  (violates this project's own "no invented/missing translations" rule)
  or hand-translating over a thousand location names, which is not
  realistic.
- **Different granularity than everything else Game Context touches**:
  encounters are keyed by PokeAPI `version` (e.g. `diamond` and `pearl`
  separately), not `version_group` — a new `version -> version_group`
  mapping would be needed before any of this could plug into the existing
  `services/gameContext.ts` model at all.
- A narrower "real availability" idea (just a games list, no location/
  method detail, sidestepping the translation problem) was considered and
  rejected too: it would still require the same full per-Pokémon
  encounters fetch to derive, for a payoff — a list of games — that
  `MovesTable`'s own Game Context selector already visually conveys via
  its options (the exact duplication Fase 2E's own audit already
  cautioned against for a dedicated "Available in: ..." section).

**Decision: deferred, not built, for a future Fase 2F/2G if ever
prioritized** — not for lack of trying, but because every version of this
(full detail or a stripped-down one) fails on either dataset size,
missing translations, or duplicating an existing UI, and none of that
changes without new data appearing upstream. See `TODO.md`'s "Deferred by
evidence" section for what would need to change before revisiting this.

## 11. Internal linking

Types, abilities, moves (via `MovesTable`), generation and forms/varieties
were already real links before this phase and are unchanged. Egg groups
and growth rate are **not** linked — Pokepedia has no `/grupo-huevo/{x}/`
or `/ritmo-crecimiento/{x}/` page, and inventing one for a handful of
enum values was judged not worth the crawl budget. Regional Pokédex
entries are plain text for the same reason (no per-pokedex page exists).

## 12. SEO

Unchanged: canonical, hreflang, trailing slash, breadcrumbs (`Breadcrumbs`
already emits a valid `BreadcrumbList`), sitemap, slugs. Title/description
were evaluated and **deliberately not changed**: the added facts
(training/breeding/dex numbers) are supplementary depth, not a new primary
search intent — "stats/moves/abilities" already covers what people search
for, evolution was already shown before this phase existed, and changing
an indexed title without a demonstrated uplift case is a real, if small,
regression risk. No new Schema.org type was introduced (no Pokémon-specific
schema.org type exists); the existing `BreadcrumbList` was left as-is
rather than inventing new properties on it.

## 13. Performance

No new request, no new client-side JavaScript, no new dataset shipped to
the browser: the only addition is more server-rendered HTML (the new
`<dl>` sections), from data already in hand. That HTML *does* travel to
the browser — "0 new client bytes" in an earlier draft of this document
overstated it; the precise claim is 0 new requests and 0 new JS/dataset
bytes, not 0 new bytes overall. Measured (local dev server, 2026-09-27):

| Pokémon | Notable for | Raw HTML (before → after) | gzip (before → after) |
|---|---|---|---|
| Garchomp | baseline | 406.6 → 443.8 KB (+9.2%) | 34.0 → 35.8 KB (+5.1%) |
| Pikachu | many Pokédex entries, evolution | 422.7 → 465.4 KB (+10.1%) | 35.5 → 37.2 KB (+4.9%) |
| Eevee | multiple evolutions | 411.0 → 451.2 KB (+9.8%) | 34.5 → 36.3 KB (+5.2%) |
| Wormadam | many varieties/forms | 263.2 → 286.3 KB (+8.8%) | 31.3 → 32.6 KB (+4.3%) |

"Before" is `develop` at the commit this branch forked from (`2423018`,
post-Fase 2A/Game Context, pre-Fase 2B), measured in an isolated git
worktree with the same local dev server; "after" is this branch. The
whole delta is the new Training/Breeding/regional-Pokédex `<dl>` markup —
no other part of the page changed. These numbers include the whole page
(moves table, evolution chain, etc.), not just the new sections. New facts add a few `<dl>` rows of
already-available text — not a meaningfully separable delta.)

## 14. Fallbacks / data gaps

Every optional field is *omitted* when PokeAPI has it as `null`
(`base_happiness`, `hatch_counter` for several Legendaries) — never
rendered as `0` or "N/A". No runtime translation, no AI-generated text: a
field with no usable data simply does not appear. `growthRateLabel` /
`eggGroupLabel` fall back to a formatted slug for a genuinely unknown
value (should PokeAPI ever add one), the same defensive pattern
`versionGroupLabel` already uses.

## 15. How to add a new fact

1. Confirm the field exists on `pokemon`/`pokemon-species` and that
   Pokepedia already fetches that object for this page (check
   `getPokemonByName()` before assuming a new request is needed).
2. Add it to the relevant `Pick<...>` in
   `buildPokemonFacts()`'s signature and to the `PokemonFacts` shape.
3. If it needs a finite, non-English-only vocabulary (a new enum PokeAPI
   doesn't localize to ES), add a small table next to `growthRateLabel` —
   verify live against PokeAPI first (`descriptions`/`names`) before
   hand-writing a translation, and say in a comment when PokeAPI has no ES
   text at all (as `growthRateLabel` does).
4. Render it in the template only if it answers a real encyclopedic
   question (§6's discarded fields are the standard to hold a new one to).
