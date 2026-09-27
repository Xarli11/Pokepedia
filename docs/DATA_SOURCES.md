# Data Sources

Internal technical reference for where Pokepedia's data actually comes from,
how it's selected/normalized, and what happens when it's missing or wrong.
This documents the real implementation as of this sprint (`feature/data-trust-observability`) —
it was written by reading the code, not the other way around. If this file
and the code ever disagree, the code is right and this file is stale; fix
whichever one is wrong.

For the user-facing version of this, see `/[lang]/fuentes/` (same slug in
both locales — see that page's header comment for why it isn't
`/es/fuentes/` + `/en/sources/`).

> **Future i18n improvement:** support localized route segments so
> `/en/sources/` can coexist cleanly with `/es/fuentes/`, instead of every
> route sharing one slug across locales. This needs a per-route slug map
> feeding `localizedPath`/`localeAlternates` in `src/utils/seo.ts` (currently
> a same-segment swap with no such concept), not just a change to the
> Sources page. Not started — noted here so it isn't quietly forgotten,
> and so the current symmetric-slug choice isn't mistaken for a permanent
> constraint.

## The rule

> **External API response != trusted application data.**

Nothing from PokeAPI, Showdown, or Smogon is rendered straight from the
fetch response. Every field that reaches a page goes through an explicit
selection/normalization step first — a named function with a defined
precedence, not `entries.find(...)[0]` scattered across page templates.
When that rule was violated in the past (see [Known incidents](#known-incidents-fixed)
below), the result was real, silently-wrong data in production. The
selection layer exists specifically so that can't happen again undetected.

## Sources

| Source | What Pokepedia uses it for | Access |
|---|---|---|
| [PokeAPI](https://pokeapi.co) | Canonical identity for every Pokémon/move/ability/item; base stats/types/abilities; localized names; flavor text; evolution chains; sprites | `src/services/pokeapi.ts` (SSR), a few lazy client `<script>` fetches (see [Client-side fetches](#client-side-fetches)) |
| [Pokémon Showdown](https://pokemonshowdown.com) (`data/pokedex.json`) | "Current" (post official nerf/buff) types, base stats, and legal ability list, when they differ from PokeAPI's static data; competitive tier | `src/services/smogon.ts` (despite the file name — see below) |
| [Smogon](https://www.smogon.com) sets data (`pkmn.github.io/smogon/data/sets/*.json`) | **Not displayed by Pokepedia any more** (sets are PokeStudio's domain, see [Product boundaries](#product-boundaries)). `getSmogonSets()` stays in `smogon.ts` with its tests, unused by any page | `src/services/smogon.ts` |
| Generated catalogs (`src/data/generated/*.json`) | Compact ES/EN catalogs of moves, abilities, items and Pokémon (species + forms) plus the global-search index, built from PokeAPI by a script. Read by the catalog index pages and the search; never by entity pages | `scripts/generate-catalogs.ts`, `src/services/catalogs.ts`, see [Generated catalogs](#generated-catalogs) |
| WikiDex (`wikidex.net`) | Spanish species flavor-text fallback, only when PokeAPI has none in Spanish | `getWikiDexFallback()` in `src/services/pokeapi.ts` |
| Manual patches (`SPANISH_PATCHES` constant) | Hand-written Spanish name/description overrides for a small, fixed list of entries where PokeAPI's Gen 8/9 Spanish data is missing/wrong | `src/services/pokeapi.ts` |
| Local JSON fixtures (`src/utils/__fixtures__/items/*.json`) | Not a runtime source — frozen real PokeAPI item responses used by `localizedText.test.ts` to pin down the x-y corruption fix. Never imported outside tests. | test-only |

`smogon.ts` is misnamed relative to what it does: `getShowdownPokemon` /
`getSmogonDataBatch` / `getPokemonTier` all read Showdown's `pokedex.json`,
while `getSmogonSets` is the only function that reads actual Smogon data.
They live in the same file because both are "competitive-side" sources with
the same fetch/cache/size-guard plumbing, not because they're the same
source. Do not read "Showdown" and "Smogon" as interchangeable.

## Field precedence matrix

| Field | Primary | Fallback | Selection/transform | Cache |
|---|---|---|---|---|
| Species/Pokémon identity, existence | PokeAPI (`pokemon/{name}` then `pokemon-species/{name}`) | — (fails cleanly, see [Forms & names resolution](#forms--names-resolution)) | `getPokemonByName()` | 24h, keyed by URL |
| Types (Pokémon detail page) | Showdown `pokedex.json` | PokeAPI `pokemon.types` if Showdown has no entry | `pokemon/[name].astro` step 1 | 24h |
| Base stats (Pokémon detail page) | Showdown `pokedex.json` | PokeAPI `pokemon.stats` | same | 24h |
| Ability list (Pokémon detail page) | Showdown `pokedex.json` (hidden ability = key `"H"`) | PokeAPI `pokemon.abilities`; if PokeAPI's own list on the requested variety is empty (common on megas), the **default variety's** abilities/moves are fetched as a further fallback | same | 24h |
| Ability/move display name | PokeAPI `names[lang]` | `names['en']`, then a formatted slug | `getLocalizedName()` | 24h |
| Ability/move/item flavor text | PokeAPI `flavor_text_entries`, highest-ranked known version group for the requested language | next language in the ladder (`requestedLang` -> `en`) | `selectLocalizedFlavor()` (see below) | 24h |
| Item technical effect | PokeAPI `effect_entries` | next language in the ladder | `selectLocalizedEffect()` | 24h |
| Species flavor text (Pokémon page) | PokeAPI `flavor_text_entries[lang]` | manual patch (if any) inserted first, then WikiDex if still no Spanish entry exists | `getPokemonByName()` | 24h (WikiDex call itself is not cached — it's a single best-effort request) |
| Smogon tier (secondary, attributed fact) | Showdown `pokedex.json` `.tier` | no tier -> the small tier card is not rendered | `SmogonTier.astro` (SSR only, no client script) | 24h |
| Evolution chain | PokeAPI `evolution-chain/{id}` | `null` | `getEvolutionChain()` | 24h (through `fetchWithCache`) |
| Sitemap Pokémon/move/ability/item lists | PokeAPI list endpoints | none: every family is required — a failing one makes the sitemap a 503 (never a partial 200) | `getAllPokemonBasic/getAllMoves/getAllAbilities/getAllItems` in `sitemap.xml.ts` | 24h |

## Selection layer: `localizedText.ts`

`src/services/localizedText.ts` is the single place that decides, for a
given field/language, *which* PokeAPI entry to trust. It returns a
`ProvenancedText`:

```ts
interface ProvenancedText {
  text: string;
  source: 'effect_entries' | 'flavor_text_entries';
  language: string;
  versionGroup?: string;
  fallbackUsed: boolean;
  fieldType: 'effect' | 'flavor';
}
```

Two rules, both evidence-backed rather than assumed:

1. **Recency is resolved against a fixed, hand-verified chronological table**
   (`versionGroups.ts`), never against array order. PokeAPI doesn't document
   array order as a stable contract.
2. **A small, explicit denylist** (`BLOCKED_COMBINATIONS`) rejects specific
   `(entityType, field, language, versionGroup)` tuples proven to be
   corrupted upstream, and falls through to the next-best version group /
   next language instead of surfacing them. See [Known incidents](#known-incidents-fixed).

`src/utils/items.ts` (`selectItemEffect` / `selectItemFlavor`) is the item
adapter over this engine; item pages use it, not raw `flavor_text_entries`.

## Product boundaries

Pokepedia is the encyclopedia: factual, structured, connected data about
Pokémon, moves, abilities, items, types, forms, evolutions and generations.
The other two products of the ecosystem own the rest, and Pokepedia links to
them instead of duplicating them:

| Product | Owns | In Pokepedia |
|---|---|---|
| **PokeTypes** | weaknesses, resistances, immunities, multipliers, coverage | a deep link (`buildPokeTypesUrl`) from Pokémon pages and the comparator. No inline calculator, no iframe |
| **PokeStudio** | sets, team building, strategy, optimization, damage calculation | nothing yet. `src/utils/ecosystem.ts` holds the single switch (`POKESTUDIO_BASE_URL`, `null`): while there is no public, stable URL no link is rendered; once it is set, the CTA in `SmogonTier.astro` appears |

What stays on a Pokémon page from the competitive side is one attributed
reference fact: the Smogon tier (from Showdown's `pokedex.json`) with its
legend. Sets, ability blurbs for competitive use and "strategy" links were
removed.

## Version groups: chronology, labels and default context

`src/services/versionGroups.ts` (`VERSION_GROUPS`) is the single table: one
entry per group with its chronological position, ES and EN label and a
`defaultEligible` flag. The Pokémon `MovesTable` lists **every** group the
Pokémon has moves in, newest first (it used to sort alphabetically and open on
`x-y`), labelled in the page language (the old table was Spanish-only).

**"Latest available" and "default context" are different questions.**

- *Latest available* (`latestVersionGroup`) is a fact about the data: the
  chronologically newest group with data. Text selection uses it.
- *Default context* (`defaultVersionGroup`) is a product policy: the newest
  group flagged `defaultEligible`, i.e. a main-series game a player calls "the
  current game". Spin-offs (Colosseum, XD, **Champions**) and DLC (Isle of
  Armor, Crown Tundra, Teal Mask, Indigo Disk, Mega Dimension, which share
  their base game's learnsets) stay selectable and visible but never displace
  the latest main game. If a Pokémon has no eligible group, the newest
  available one is used, so something is always selected.

Garchomp has data for Champions (the newest group) and opens on
Scarlet/Violet. To change what counts as a default, flip `defaultEligible`;
do not delete groups from the table (unknown groups rank below every known
one). The initial choice is one value (`initialVersion`) so a future Game
Context can override it with a remembered selection and reuse
`VERSION_GROUPS` as its list of contexts (not built).

Non-obvious chronology:

- `red-green-japan`, `blue-japan`: the Japanese originals, older than red-blue.
- `colosseum`, `xd`: GameCube spin-offs, after firered-leafgreen, before diamond-pearl.
- `the-isle-of-armor`, `the-crown-tundra`: Sword/Shield DLC (2020), before brilliant-diamond-shining-pearl (2021).
- `mega-dimension`: Legends Z-A DLC, after legends-za.
- `champions`: Pokémon Champions (2026), the newest group PokeAPI lists.
- An unknown group ranks below every known one; it is selectable and is the
  default only when it is the only group.

## Generated catalogs

Why: the catalog indexes (`/movimientos/`, `/habilidades/`, `/objetos/`) had
their links in the SSR HTML but every primary field (localized name, type,
category, power, description...) arrived from one browser request to PokeAPI
per row. The catalogs move that work to a reproducible script whose output is
committed, so the fields are in the HTML, the browser makes no PokeAPI
request, and the same data feeds the global search.

- **Source:** PokeAPI v2 REST (`https://pokeapi.co/api/v2`): the `move`,
  `ability`, `item`, `pokemon-species` and `pokemon` lists (verified against
  each list's own `count`) and one detail request per entity.
- **Process:** `npm run data:catalogs` (~4.5k requests at concurrency 12,
  about 40 s from scratch; `-- --cache-dir=<dir>` reuses raw
  responses while iterating; `-- --only=moves,items` limits the kinds).
- **Output** (`src/data/generated/`, never edited by hand):
  `moves|abilities|items|pokemon.{es,en}.json`, `search-index.{es,en}.json`,
  `manifest.json` (counts, per-file content hash, generation date).
  Header + tuple rows: `{schema, kind, lang, source, apiCount, duplicates,
  excluded, count, fields, rows}`. Entries follow PokeAPI id order and carry
  no timestamp, so regenerating against unchanged data rewrites identical
  bytes (verified).
- **Fields:** moves: slug, name, type, damageClass, power, accuracy, pp,
  priority, generation. Abilities: slug, name, description (<= 100 chars, cut
  at a word with an explicit "…"), descriptionLang, generation, mainSeries.
  Items: slug, name, category, superCategory, hasSprite, description,
  descriptionLang. Pokémon: slug, id, name, generation, form (species plus one
  row per non-default form; the default variety is the species page).
  Moves have **no description**: no index page shows one and the per-version
  flavor text is not compact; the move page keeps its own source.
- **Text selection:** descriptions go through `services/localizedText.ts`
  (newest known version group, evidence-backed denylist incl. `item + es +
  x-y`) after item placeholders are dropped; requested language first
  (flavor, then short effect), English only if the requested language has
  neither, and `descriptionLang` says which. Names fall back to English, then
  to the formatted slug. 914 of 2222 items have no usable text in any
  language (PokeAPI has none): they render without a description, never with
  a placeholder.
- **Validation** (`validateCatalog`, run by the script and by tests): schema
  version, field list, `count == rows`, `rows + duplicates + excluded ==
  apiCount` (truncation), unique slugs, non-empty names, column counts. Any
  problem aborts the run before anything is written.
- **Freshness:** `npm run data:catalogs:check` validates the committed files
  and compares them with PokeAPI's live lists (count, missing and removed
  slugs); exit 1 when stale. Not part of `npm test` (network). A move/ability/
  item PokeAPI lists but the catalog lacks still gets its row and link (name
  formatted from the slug, empty cells): stale data degrades, never 503s.
  Re-run when a game adds entities, or when PokeAPI fixes texts.
- **Overrides:** `src/data/catalogOverrides.json` (`kind -> lang -> slug ->
  {name|description}`), applied last by the script. Empty today.
- **Runtime:** `src/services/catalogs.ts` imports each file lazily (own
  chunk) and memoizes a slug-keyed `Map` per isolate. Entity pages still read
  PokeAPI (through the selection layer) for their full data; the catalogs are
  for listings, search and relations.
- **Size:** moves 58 KB, abilities 37 KB, items 260 KB, Pokémon 47 KB per
  language; each search index 273 KB (gzip ≈ 73 KB).

## Global search index

`search-index.{lang}.json` is derived offline from the catalogs plus the
static type and generation tables: one row `[code, slug, name, id, extra,
aliases?]` per Pokémon (species + forms), move, ability, item, type and
generation. Aliases are the other language's name when it differs, so
"earthquake" finds Terremoto on the Spanish site and vice versa; generations
also carry their region ("sinnoh", "teselia"/"unova"), "gen 4" and
"generación 4". The browser fetches `/search-index/{lang}.json/?v=<hash>`
once per language, lazily (on opening the modal or focusing the input), with
`Cache-Control: public, max-age=31536000, immutable` for the versioned URL.

Ranking (`src/utils/search.ts`, deterministic, no fuzzy matching): exact name
(100) > exact Pokédex number (95) > name prefix (80) > exact alias (70) >
alias prefix (60) > a word of the name starts with the query (55) > dex-number
prefix (45) > contains (40) > every query word present (30); ties by entity
kind, id, name; at most 5 results per kind and 12 in total. Text is normalized
(case, accents, hyphens/dots/apostrophes, spaces). Recent history
(`pokepedia_history`, max 8) stores `{type, slug, name, id}` of entities the
person opened, never typed text; legacy Pokémon-only entries are still read.
Analytics only records `results` / `no_results`.

## Future: Game Context and the entity graph (not implemented)

Designed for, not built. `MovesTable`'s single `initialVersion` and the
`{type, slug}` identity used by search rows and history are the two seams. A
Game Context would supply a version group that the learnset, machines,
locations and regional dex read, and relations that depend on a version
(learns, availableIn) must carry it. The catalogs are intentionally
version-independent listings; version-dependent data is not put in them.

## Known incidents (fixed)

### `item + flavor_text + es + x-y`

PokeAPI's Spanish `flavor_text_entries` for the `x-y` version group is
corrupted for a proven set of items — the Spanish text at that version
group belongs to a *different, unrelated* item (e.g. `life-orb`'s `x-y`
Spanish entry is verbatim `choice-scarf`'s real description). Full
investigation, evidence, and the exact denylist entry:
[`docs/audits/item-es-xy-flavor-integrity.md`](./audits/item-es-xy-flavor-integrity.md).

Policy in one line: the `(item, flavor, es, x-y)` combination is
permanently denylisted in `localizedText.ts`; every other combination
(including `es` at other version groups, and `x-y` for abilities/moves,
which were checked and are clean) passes through normally.

### Unsafe base-name fallback in Pokémon resolution

`getPokemonByName()` used to fall back to `name.split('-')[0]` (e.g.
`"porygon-z"` -> `"porygon"`) when the exact `pokemon`/`pokemon-species`
lookups both failed. For any name whose prefix is itself a real species —
`porygon-z`, `deoxys-attack/defense/speed`, `giratina-origin`,
`zygarde-10-percent/complete`, `necrozma-*`, `urshifu-*`,
`kyurem-black/white`, and more — a **transient** failure of the real
lookups (not just a genuinely invalid name) would silently return that
unrelated base species instead of failing. Removed entirely; see the
[Forms & names resolution](#forms--names-resolution) section and
`src/services/pokeapi.test.ts` for the regression coverage.

## Forms & names resolution

`getPokemonByName(name)` resolution order, current and final:

1. **Exact `pokemon/{name}`.** Covers the overwhelming majority of cases,
   including every regional/mega/Gmax/Rotom/Deoxys/Urshifu/Ogerpon/Terapagos
   form checked against live PokeAPI — they're all real `pokemon` resource
   slugs.
2. **Exact `pokemon-species/{name}` -> default variety.** Covers names that
   are a species but not themselves a `pokemon` resource — `basculin`,
   `gourgeist`, `basculegion` (fixed in `a74ce6a`, before this sprint).
3. **Clean failure** (`PokemonNotFoundError`), caught by the page and
   redirected to the locale home. No step 4. No slug truncation, ever.

No alias map exists because none of the growth plan's example names
(`mr-mime`, `mime-jr`, `ho-oh`, `porygon-z`, `type-null`, `jangmo-o`,
`hakamo-o`, `kommo-o`, `farfetchd`/`sirfetchd`, and the regional/mega/
gmax/rotom/deoxys/urshifu/ogerpon/terapagos forms) needed one — PokeAPI
resolves all of them directly at step 1 or 2. If a genuinely irregular
name is ever found that needs a hand-written alias, add it as an explicit,
tested entry — never widen the automatic fallback back out.

## Centralized PokeAPI access

`src/services/pokeapi.ts` is the only place SSR code should call
`fetch('https://pokeapi.co/...')`. It provides:

- `fetchWithCache<T>(url)` — the shared primitive: 24h in-memory cache keyed
  by exact URL (LRU-bounded), 8s timeout, one bounded retry for fast
  transient faults only, in-flight de-duplication, stale-on-error from the
  last valid copy, structured failure logs, throws classified errors on
  failure. Full policy: `docs/audits/seo-phase5-crawl-performance.md`
  (section "Cache and reliability policy"). Provider timeouts live in
  `src/services/upstream.ts`.
- `getCompleteResourceList(resource)` — every list catalog (items, moves,
  abilities, species, pokemon) through ONE request verified against the
  API's own `count`; never a hard-coded `?limit=N`.
- Entity accessors: `getPokemonByName`, `getPokemonDetailByUrl`,
  `getAbilityDetail(ByName)`, `getMoveDetail(ByName)`, `getItemDetail`,
  `getMachineMove`.
- `getPokemonCards(refs, limit)` — caps and resolves a list of Pokémon
  references for the "Pokémon that learn/hold/have this" listings. From the
  cached Showdown pokedex + species list when available (0 requests),
  otherwise one PokeAPI summary per Pokémon; an entry that can't be resolved
  is dropped instead of failing the listing. Some of these lists are large
  (Levitate alone lists 50+ Pokémon) — always cap, never fetch the full list
  unbounded.

As of this sprint, `pokemon/[name].astro`, `objetos/[name].astro`,
`movimientos/[name].astro`, and `habilidades/[name].astro` all route
their PokeAPI access through this layer instead of ad hoc `fetch()` calls
with their own (sometimes absent) timeout/cache/cap policy.

### Client-side fetches

A few `<script>` blocks fetch PokeAPI (or `/api/suggestions`) directly from
the browser: `Layout.astro`'s random-Pokémon button, the home page's "load
favorites" grid (`index.astro`, fetches each favorited Pokémon by name
client-side from `localStorage`), and the comparator's selector
(`/api/suggestions`, Pokémon only). The catalog index pages
(`objetos|movimientos|habilidades/index.astro`) and the global search no
longer fetch PokeAPI at all: see [Generated catalogs](#generated-catalogs).
The remaining ones are intentionally left alone — they run client-side and structurally cannot import a server-only
service module, and each already keeps its own small per-page `Map` cache
(or none, when a single one-off fetch doesn't need one). This is a
different, accepted category from the SSR "fetch sprawl" this sprint
centralized; don't try to unify the two into one cache.

## Localization fallback, in general

Any `dict[lang] || dict.es` / `entries.find(lang) || entries.find('en')`
pattern in this codebase is a **language** fallback (show a different
language if the requested one is missing) — normal and expected, not an
error. It is unrelated to the **source-selection** fallback described
above (which entry, of possibly several in the *same* language, to trust).
`ProvenancedText.fallbackUsed` only reports the language fallback; when
`true`, item pages show a small "shown in the original language" note
(`item_effect_en_fallback`).

## When a data field can't be resolved at all

The failure mode is always "render nothing for this field" or "omit this
section", never a placeholder that looks like real data:

- No reliable flavor/effect text in any language on the ladder ->
  `selectLocalized*` returns `null` -> the page falls back to a generic
  "not available" string (`item_no_effect_available` etc.), never an
  empty string rendered as if it were content.
- No Showdown tier for this Pokémon -> the small "Smogon tier" card
  doesn't render (no skeleton).
- Pokémon can't be resolved at all -> clean redirect to the locale home,
  never a page for the wrong Pokémon.

## Known risks

- `fetchWithCache`'s 24h in-memory cache is per server instance (Cloudflare
  Workers isolate) and is not shared/persisted across deploys or across
  concurrent instances — this is a soft cache for repeat requests within a
  warm instance, not a CDN-level guarantee. (Showdown/Smogon datasets
  additionally use the Cloudflare Cache API where available — see the
  Phase 5 audit.)
- Showdown's `pokedex.json` and Smogon's per-format `sets/*.json` are
  fetched whole (with a 10MB size guard in `smogon.ts`) and have no
  official versioning; a malformed upstream release degrades gracefully
  (competitive sections just don't render) but isn't detected/alerted on.
- WikiDex fallback is unauthenticated, best-effort HTML-extraction of a
  third-party wiki, used only when PokeAPI has zero Spanish species text.
  It is not fact-checked beyond "did the request succeed" — treat it as the
  weakest source in the precedence chain.
