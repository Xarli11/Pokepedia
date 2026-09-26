# Phase 1 — Pokepedia as an entity encyclopedia

Base: `develop` = `d197c1d` (v0.14.0). Branch: `feature/encyclopedia-phase1`.
Method: data → hypothesis → action → measurement. Baseline first (564 tests
passing, `astro check` 0 errors, build OK), measured before/after where it is
reasonable.

## 1. Initial state

Relevant architecture: Astro 5 SSR on Cloudflare (`trailingSlash: 'always'`), PokeAPI
through `services/pokeapi.ts` (cache, upstream layer, count-verified catalogs),
Showdown/Smogon datasets, ES + EN, error semantics in `middleware.ts`, sitemap
guarantees, item indexation policy. `services/versionGroups.ts` already held a
chronological table used for text selection.

Confirmed problems:

| # | Problem | Evidence |
|---|---|---|
| 1 | Moves opened on an old game | `MovesTable`: `[...].sort()` (alphabetical) and `red-blue` if present else the alphabetically last. Garchomp (14 groups, none of them red-blue) opened on `x-y`, the alphabetically last, instead of its newest group. Version labels were Spanish-only, also shown in English |
| 2 | Strategy positioning | home subtitle "Análisis estratégico, calculadora de tipos, tabla de debilidades"; Pokémon title "Stats, Weaknesses & Strategy"; JSON-LD "competitive integration, meta analysis"; `meta keywords` "Type Calculator, Weakness Chart"; OG "Estrategia"/"COMPETITIVE"; full Smogon sets + strategy link on every Pokémon page |
| 3 | Search only knew Pokémon | header modal and home search called `/api/suggestions?q=` on every keystroke: Pokémon names only, English slugs, no moves/abilities/items/types/generations |
| 4 | Index pages filled by the browser | `/movimientos/`, `/habilidades/`, `/objetos/`: links in SSR, but type/category/power/PP/priority, names and descriptions empty (skeletons) until one PokeAPI request **per row** arrived (IntersectionObserver; typing in the item filter forced-loaded cards; the item category filter had to fetch every card first) |

Baseline tests: 46 files / 564 passed, 2 skipped (vitest 9 s).

## 2. Changes

- **Version default** — `services/versionGroups.ts`: added colosseum, xd, the-isle-of-armor,
  the-crown-tundra, champions, red-green-japan, blue-japan to the chronology;
  `sortVersionGroups`, `latestVersionGroup`, `versionGroupLabel(name, lang)` (ES/EN, all 32
  PokeAPI groups). `MovesTable.astro` uses them: newest selected, all listed newest first.
  Tests: `versionGroups.test.ts`, `MovesTable.ssr.test.ts`.
- **Product alignment** — `Layout.astro` (default description per language, no keywords,
  JSON-LD), `utils/seo.ts` (`DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`), `utils/pokemon.ts`
  (home copy, sources copy, `comp_*` keys removed, new tier/CTA keys), `og/templates/*`,
  `pokemon/[name].astro` (title/description, no sets request), `CompetitiveSets.astro` →
  `SmogonTier.astro`, `utils/ecosystem.ts`. Test: `testing/productScope.ssr.test.ts`.
- **Catalogs** — `data/catalogs/{schema,build,searchIndex}.ts`, `scripts/generate-catalogs.ts`,
  `data/generated/*`, `services/catalogs.ts`, `data/catalogOverrides.json`; npm scripts
  `data:catalogs`, `data:catalogs:check`. Tests: `data/catalogs/catalogs.test.ts` (builders,
  validator failure cases, committed files), `services/catalogs.loader.test.ts`.
- **Search** — `utils/{search,searchText,searchTypes,searchHistory,searchUi,catalogSearch}.ts`,
  `pages/search-index/[lang].json.ts`, `Layout.astro` modal, home search. Tests: `search.test.ts`
  (the ten examples of the brief against the real index, each ranking tier, caps, normalization),
  `searchHistory.test.ts`, `searchIndexEndpoint.test.ts`.
- **Catalog SSR** — the three index pages and their scripts. Test:
  `testing/catalogPages.ssr.test.ts`.

## 3. Decisions (and rejected alternatives)

- **Catalog source: PokeAPI REST, not the PokeAPI CSVs / GraphQL.** REST goes through the same
  selection layer (version-group ranking, the `item + es + x-y` denylist, placeholder filter) as the
  entity pages and the same `count` verification; CSVs would need that logic re-implemented, GraphQL
  is a beta endpoint. Cost: ~4.5k requests, 40 s, on demand.
- **Committed generated files, no database.** ~1.3 MB of JSON, reproducible, reviewable in diffs;
  no infrastructure. Lazy per-language chunks keep it out of the hot path.
- **Live list stays the source of *which* entities exist; the catalog only adds fields.** Keeps the
  count-verified completeness guarantee and the 503 semantics of the index pages; a new entity not in
  the catalog yet still gets its link (formatted name, empty cells). Rejected: catalog-only lists
  (would freeze the entity set between regenerations and remove the upstream-failure behaviour tests).
- **Moves have no description** in the catalog: no index shows one, per-version flavor text is not
  compact, and the field asked for was "if reliable and reasonable".
- **Descriptions capped at 100 characters** (what the pages displayed before) with an explicit "…";
  `descriptionLang` records the real language (English fallback is visible in the data).
- **Search index as a lazily fetched static-like JSON, not a server endpoint per query and not inlined
  in the page.** One 73 KB (gzip) download per language, immutable cache by content hash.
  Rejected: shipping it in the Layout bundle (paid by every page view), `/api/suggestions` extension
  (server work per keystroke).
- **Other-language names as aliases** (both directions) so English names work on the Spanish site;
  no fuzzy matching; ranking documented and tested.
- **Forms are search rows** (`Charizard (Mega X)`), as before, named with the existing
  `formatPokemonName` suffix rules; the default variety is the species row.
- **History records opened entities**, not typed text; the Pokémon page keeps recording visits
  (same key, new shape, legacy read).
- **Champions is the newest group** and therefore the default for Pokémon that have it (Garchomp).
  It is a battle game, not core series: documented in `DATA_SOURCES.md` with the one-line way to
  demote it. Rejected: silently excluding it (contradicts "most recent available").
- **Home search converted, comparator selector not.** The comparator needs Pokémon only and keeps
  `/api/suggestions`, which is unchanged.
- **Not done on purpose:** PokeStudio link (no public URL), Game Context, entity graph, per-move
  descriptions, extra pages, dependencies (none added).

## 4. Metrics

| | Before | After |
|---|---|---|
| Tests | 46 files / 564 | 55 files / 657 (+93), 2 skipped as before |
| `astro check` | 0 errors | 0 errors |
| `npm run build` | OK | OK, 2.7 s |
| Catalog generation | n/a | 40 s cold, ~4.5k requests, deterministic (second run: identical bytes) |
| Generated data | n/a | moves 58 KB, abilities 37 KB, items 260 KB, Pokémon 47 KB, search index 273 KB (gzip 73 KB) per language |
| Worker chunks | — | +10 lazy chunks, one per catalog and language (≈1.5 MB raw); worker gzip 2.27 MB total |
| `/movimientos/` HTML (es) | 296.7 KB (gzip 24.5) | 392.8 KB (gzip 33.4): the data is now in it |
| `/habilidades/` HTML | 516.4 KB (gzip 20.0) | 202.6 KB (gzip 23.4) |
| `/objetos/` HTML | 959.7 KB (gzip 63.6) | 942.5 KB (gzip 83.6) |
| Client PokeAPI requests, catalog pages | 1 per row entering the viewport, up to 937 / 374 / 2222 when scrolling or filtering | **0** |
| SSR requests, catalog pages | 1 (list) | 1 (list), unchanged |
| Search request per keystroke | 1 to `/api/suggestions` | 0 (index fetched once per language) |
| Pokémon page, upstream | + Smogon sets request, + up to N move/item name requests in Spanish | both removed; no client fetch from the tier card |
| Skeleton placeholders on the 3 indexes | every row | none |

HTML sizes are from the same Container render with the same 937/374/2222 slugs (dev attributes
stripped), before = `d197c1d` pages, after = this branch.

Live check (dev server against real PokeAPI): `/es/`, the three indexes, `/search-index/es.json/`
and `/es/pokemon/garchomp/` answer 200; Garchomp: `data-initial-version="champions"`, 14 groups
listed newest first, tier card `UUBL`. The browser scripts were exercised in jsdom against the real
server HTML and real index (filters, suggestions, category filter: 46 berries; search rows and
history for garchomp / terremoto / piel tosca / choice scarf / dragón / sinnoh / 445). No real
browser was available in this session.

## 5. SEO

Changed: Pokémon title/description (ES `X: Stats, Movimientos y Habilidades`, EN `X: Stats, Moves &
Abilities`), default title/description (now per language and factual), JSON-LD description and
featureList, OG default/type card text, removal of `<meta name="keywords">` (no code depended on it).
Index pages now carry names/categories/descriptions in HTML.

Unchanged: URLs, `pagePath`, `canonicalUrl`, `localeAlternates`, trailing slash, hreflang, the sitemap
(8436 URLs, 503-on-partial), item noindex policy, canonical Pokémon slugs, breadcrumb JSON-LD, 404/503
semantics, the entity pages' data sources. The new `/search-index/{lang}.json/` is a data asset (not
in the sitemap, not linked, `application/json`).

## 6. Risks / remaining debt

- Catalogs go stale when PokeAPI adds entities or fixes text: `npm run data:catalogs:check` detects
  it (not run in CI; needs network). Stale entries degrade, never break.
- 914 of 2222 items have no description in any language (upstream gap); their cards have none.
- The tier card is the only competitive content left; Smogon/Showdown data has no official
  versioning (pre-existing risk).
- Tests under `src/pages/` are bundled by Astro as routes (pre-existing; a 654 KB `test.*.mjs` chunk).
  New tests were placed elsewhere; moving the old ones is left as a separate change.
- Home grid still filters by text while the dropdown now shows other entity kinds: typing a move name
  leaves the Pokédex grid empty (its own "no results" state) beside a correct dropdown.
- Champions default: see decisions.

## 7. Next phase (recommended, not started)

Game Context (remembered version group → learnsets, machines, locations, regional dex); factual
Pokémon data (training, breeding, egg groups, gender, catch rate, growth, EV yield); richer moves and
abilities; complete, filterable relations between entities carrying the version where it matters.
