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
| [Smogon](https://www.smogon.com) sets data (`pkmn.github.io/smogon/data/sets/*.json`) | Recommended competitive sets (moves/item/ability/nature) per tier/format | `src/services/smogon.ts` |
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
| Competitive tier | Showdown `pokedex.json` `.tier` | `'Untiered'` | `getPokemonTier()` / inline in the Pokémon page | 24h |
| Competitive sets | Smogon `sets/{format}.json`, keyed by tier -> format | `null` (section simply doesn't render) | `getSmogonSets()` | 24h |
| Evolution chain | PokeAPI `evolution-chain/{id}` | `null` | `getEvolutionChain()` | not cached (single fetch, cheap payload) |
| Sitemap Pokémon/move/ability/item lists | PokeAPI list endpoints | that one family is silently omitted if its fetch fails, other families still render | `getAllPokemonBasic/getAllMoves/getAllAbilities/getAllItems` + `Promise.allSettled` in `sitemap.xml.ts` | 24h |

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
  by exact URL, 8s timeout, throws on non-2xx.
- Entity accessors: `getPokemonByName`, `getPokemonDetailByUrl`,
  `getAbilityDetail(ByName)`, `getMoveDetail(ByName)`, `getItemDetail`,
  `getMachineMove`.
- `getPokemonListByUrls(urls, limit)` — caps and resolves a list of Pokémon
  URLs with `Promise.allSettled`, so one bad upstream response drops that
  one Pokémon instead of failing the whole "Pokémon that learn/hold/have
  this" listing. Some of these lists are large (Levitate alone lists 50+
  Pokémon) — always cap, never fetch the full list unbounded.

As of this sprint, `pokemon/[name].astro`, `objetos/[name].astro`,
`movimientos/[name].astro`, and `habilidades/[name].astro` all route
their PokeAPI access through this layer instead of ad hoc `fetch()` calls
with their own (sometimes absent) timeout/cache/cap policy.

### Client-side fetches

A few `<script>` blocks fetch PokeAPI (or `/api/suggestions`) directly from
the browser: `CompetitiveSets.astro`'s lazy ability-name loader,
`Layout.astro`'s random-Pokémon button, the home page's "load favorites"
grid (`index.astro`, fetches each favorited Pokémon by name client-side
from `localStorage`), and the search/filter scripts in
`objetos|movimientos|habilidades/index.astro`. These are intentionally left
alone — they run client-side and structurally cannot import a server-only
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
- No Smogon sets for this Pokémon/tier -> the whole "Competitive Sets"
  block doesn't render.
- Pokémon can't be resolved at all -> clean redirect to the locale home,
  never a page for the wrong Pokémon.

## Known risks

- `fetchWithCache`'s 24h in-memory cache is per server instance (Cloudflare
  Workers isolate) and is not shared/persisted across deploys or across
  concurrent instances — this is a soft cache for repeat requests within a
  warm instance, not a CDN-level guarantee.
- Showdown's `pokedex.json` and Smogon's per-format `sets/*.json` are
  fetched whole (with a 10MB size guard in `smogon.ts`) and have no
  official versioning; a malformed upstream release degrades gracefully
  (competitive sections just don't render) but isn't detected/alerted on.
- WikiDex fallback is unauthenticated, best-effort HTML-extraction of a
  third-party wiki, used only when PokeAPI has zero Spanish species text.
  It is not fact-checked beyond "did the request succeed" — treat it as the
  weakest source in the precedence chain.
