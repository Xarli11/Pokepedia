# Home search scope: global vs. local

UX polish phase (`feature/encyclopedia-ux-polish-phase2`), triggered by real
visual feedback, not a planned dataset phase. Fixes two Pokémon-page
readability issues and one confusing search interaction on the Pokédex home
page (`/[lang]/`).

## The decision

> **Header search = global entity search.**
> **Pokédex home search = local filter for the currently selected
> Pokédex/generation (or favorites).**

This is now a fixed product rule, not an implementation detail — write it
down again here rather than re-deriving it if this page changes in the
future.

- **Header search** (`Layout.astro`, `#global-search-modal` /
  `#global-search-input`, opened by the trigger button or the `/` shortcut):
  unchanged. Finds Pokémon of any generation, moves, abilities, items,
  types and generations, from the global search index
  (`utils/searchUi.ts`, `utils/search.ts`, `/search-index/{lang}.json/`).
  This is the only surface on the site that does global entity search.
- **Pokédex home search** (`#pokedex-search` on `/[lang]/`): a plain
  client-side filter over the Pokémon cards already rendered for the
  current generation (or favorites). It never fetches anything, never
  reads the global search index, and never shows a Pokémon that isn't
  already in the grid.

## The problem this fixes

Before this phase, `/[lang]/`'s big search box did **both** jobs on one
input: narrowing the visible grid (a Pokémon that matched, if the grid had
one) *and* showing a multi-entity dropdown built from the global search
index (any Pokémon of any generation, plus moves/abilities/items/types).
Typing "Garchomp" while viewing Kanto showed a dropdown entry for Garchomp
(and its forms) while the grid below stayed on Kanto, unchanged — two
different, disagreeing answers to "did you find it?" on the same page.

## What changed

- `utils/homeSearch.ts`'s `computeGridVisibility()` no longer has an
  escape hatch that leaves the grid untouched when the query matches
  nothing in it (previously deliberate, so the now-removed dropdown could
  "own" that case — see the function's former docstring). The query now
  **always** filters the grid, including down to zero results — a strict
  local filter, matching what "local" is supposed to mean. Matching itself
  (case/accent-insensitive name match, `"25"`/`"#25"`/`"025"` number
  match) is unchanged — it already lived in `cardMatchesText`/`queryKey`
  and already worked exactly as this phase needs.
- The global-entity dropdown (`#search-suggestions`, `#suggestions-list`,
  `handleSearch()`'s debounced `loadSearchIndex()`/`runSearch()` call, the
  Enter-key "navigate to the first suggestion" handler, the
  `global_search`/`home_search` analytics event) is deleted from
  `index.astro`, not just hidden. **This also resolves, by removing the
  mechanism entirely, the Fase 1 debt item about Enter sometimes
  navigating to a stale/hidden suggestion link** — there is no longer a
  suggestion `<a>` on this page for Enter to reach.
- The input is renamed `#global-search` → `#pokedex-search` (it was never
  actually global; the name was misleading even before this phase).
- The empty-state message is now honest and specific instead of a static
  sentence that referenced the now-removed dropdown ("try the
  suggestions..."): *"No results for '{query}' in {region}."* (or "in
  favorites"), only shown when there was a query; a type-only message
  when the type filter alone produced zero results. Text is centralized
  in `uiTranslations` (`search_local_placeholder`,
  `search_favorites_placeholder`, `no_pokemon_found_title`,
  `no_results_query_region`, `no_results_query_favorites`,
  `no_results_type_only`) with `{token}` substitution via the new
  `formatTemplate()` in `homeSearch.ts` — shared by SSR (initial render)
  and the client script (re-rendered on every keystroke), so the two
  copies of this logic can't drift.
- The placeholder names the region: *"Search Pokémon in Kanto..."* /
  *"Buscar Pokémon en Kanto..."*, or *"Search favorites..."* in favorites
  mode.

### Correction (post-review): `GENERATIONS.region` is bilingual, centrally

The first version of this phase gave `GENERATIONS.region` a single
ES/EN-agnostic string (`services/pokeapi.ts`) and patched around it with a
one-off `REGION_EN` table local to `index.astro`, just for the new
placeholder — so the generation-selector pill below it kept showing the
Spanish `"Teselia"` on English pages, a visible inconsistency caught in
review of the preview deploy.

Fixed at the source instead of patched at the call site: `GENERATIONS`
now stores `region: { es: string; en: string }` for every generation, and
`generationRegionLabel(genKey, lang)` (`services/pokeapi.ts`) is the one
function anything should call to read it. `index.astro`'s local
`REGION_EN` table is gone. This also fixed three call sites that were
never part of this phase's original scope but shared the same root cause
and the same bug on English pages: the generation landing page
(`generacion/[gen].astro`, title/description/heading/"other generations"
list), the generations hub (`generaciones/index.astro`), and the
generation OG image (`og/v1/[lang]/generation/[gen].png.ts`). The global
search index's own `generationRegion()` helper
(`data/catalogs/searchIndex.ts`) already had a correct, separate
ES/EN table for this (verified — "Unova" was already right there); it now
delegates to `generationRegionLabel()` instead of keeping its own copy,
per "don't duplicate the dictionary."

Regression coverage: `homeSearchScope.ssr.test.ts` asserts ES shows
"Teselia" (and never "Unova") and EN shows "Unova" (and never "Teselia")
in *both* the placeholder and the pill for gen5, plus a parametrized check
that gen1/gen2/gen3/gen6 show the identical region word in both languages
(the common case, verified so the bilingual table didn't only work for
the one generation that differs).

## What did NOT change

- The global search index (`searchIndex`, `search.ts`, multi-entity
  ranking, recent-search history, `/search-index/{lang}.json/`) — all
  untouched, still exclusively serving the header modal.
- Generation switching: already a full page navigation
  (`window.location.href` on a gen-pill click), so "local semantics"
  fall out for free — a new page load always starts from the SSR grid
  for the newly selected generation, never a stale client-side result
  set from the previous one. No new architecture was needed for this.
- Favorites mode: `loadFavoritesView()` (fetches the person's own
  favorited Pokémon client-side, unrelated to search) is unchanged; it
  already calls `applyFilters()` after populating the grid, so the local
  filter composes with it automatically.

## Two other, unrelated readability fixes in this phase

Both are on the Pokémon page (`pokemon/[name].astro`), from the same
round of visual feedback, bundled into this phase rather than opening a
separate one for two small CSS-and-copy fixes:

- **Regional Pokédex names were visually truncated** ("Sinnoh Ori...",
  "Ciudad L..."). The `<dt>` had `truncate` (CSS ellipsis) inside a
  `flex justify-between` row that squeezed it against the entry number.
  Fixed by dropping `truncate`, letting the label wrap to two lines
  (`leading-snug`, `items-start` instead of the implicit `items-center`
  single-line squeeze), and widening the grid to fewer, wider columns
  (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` instead of
  `grid-cols-2 sm:grid-cols-3`) so a long name has room before it needs
  to wrap at all.
- **"Pokémon Mach" (the `genera` field) had no context.** It's the
  official species category, but a reader has no reason to know that
  term. Now rendered as *"Category: Mach Pokémon"* / *"Categoría: Pokémon
  Mach"*, using the existing `category` translation key (already used
  elsewhere for items — reused, not duplicated) rather than a new
  hardcoded label. Still one line, still SSR, no tooltip needed.

## Performance

- The Pokédex home page no longer imports `searchUi.ts`'s
  `loadSearchIndex`/`runSearch`/`buildEntityRow`, nor `utils/analytics.ts`
  — its client script chunk shrank from 9864 → 8793 bytes raw (−10.9%),
  3948 → 3525 bytes gzip (−10.7%), measured against `develop` in an
  isolated worktree.
- More importantly: typing in the local search box no longer triggers a
  `/search-index/{lang}.json/` fetch at all (previously ~265 KB raw /
  ~73 KB gzip, per `docs/DATA_SOURCES.md`'s Global search index section).
  Verified live: the rendered home page HTML contains zero references to
  `loadSearchIndex`/`search-index`. The header's own search index request
  is unaffected — it still loads (lazily, on opening the modal) exactly
  as before.
- No listener count regression: the removed code included two
  `document`-level listeners (the `/` shortcut and the
  click-outside-closes-dropdown handler) that existed only to serve the
  now-deleted dropdown; both are gone rather than replaced. The header's
  own `/` shortcut (`Layout.astro`) already existed independently and is
  unaffected — it is now the *only* `/` handler on the page instead of
  racing a second one.

## Limitations

No browser/E2E tool was available in this session. Verified via the SSR
integration test suite
(`src/testing/homeSearchScope.ssr.test.ts`,
`src/testing/pokemonEntity.ssr.test.ts`) plus a local `npm run dev` server
against real generation data (Kanto/gen1, Sinnoh/gen4, Unova/gen5,
favorites, ES and EN) and the real Garchomp Pokémon page for the Pokédex-
label and category fixes.
