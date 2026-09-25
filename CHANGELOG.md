# Changelog

All notable changes to Pokepedia are documented in this file.

## [0.13.0] - 2026-09-25

### Added

- Complete loading of the PokeAPI item catalog (2222 unique slugs), using the API's own `count`.
- Explicit item indexation policy (`src/utils/itemSeo.ts`) with placeholder detection, and a committed manifest of `noindex,follow` items (`npm run data:items-seo`, `-- --check` detects staleness) shared by the item pages and the sitemap.
- Own title, meta description and visible factual sentence for item pages: real text in the page language, else a factual ES/EN fallback built only from explicit fields.
- Item → Move for TM / TR / HM: the move of the most recent game, shown with that game, linking its move page.
- Tera Shard → Type link.
- Tests for the catalog, the policy, placeholders, metadata, machines, the manifest, the sitemap and item pages (297 → 396).

### Fixed

- `getAllItems()` used `limit=2000` and truncated the catalog: 223 items were missing from the sitemap and the items index.
- Spanish item pages no longer use English text as their meta description (950 pages before).
- Placeholder texts (`[VAR (0000)]`, `XXX new effect for …`, `Unknown.`, dash-only) are no longer shown as descriptions or in meta.
- TM / TR / HM pages used the oldest machine (`machines[0]`), which named a different move than the current games for most TMs.
- Machine titles no longer name a move: 160 of 230 TMs teach different moves in different games.
- The held-by counter on item pages shows the real total and how many are displayed.
- A slug listed twice by PokeAPI (`roseli-berry`) no longer yields a duplicated URL.

### Changed

- Sitemap 8740 → 8436 URLs; item URLs 4000 → 3696.
- Indexable items: 2000 → 1848 per language; 374 per language are `noindex,follow` and left out of the sitemap.
- The items index now covers all 2222 unique slugs, with real anchors.

### Noindex policy

`noindex,follow` pages remain accessible in Pokepedia (200, self canonical, linked from the index): noindex is not a removal of the product entity, and robots.txt does not block them.

- 300 `dynamax-crystal-*`: system data (internal `★` names, one identical `[VAR (0000)]` text, no sprite, attributes or relations).
- 6 internal bag-UI pockets of the `unused` category (Battle Pocket, Candy Jar, Medicine Pocket, Catching Pocket, Power-Up Pocket, Pokémon Box): blank or dash-only text, no sprite.
- 68 game-specific variants that share their exact ES+EN name with an indexable primary (`laultra-ball` → `ultra-ball`, `firium-z--held` ↔ `firium-z--bag`…). They keep their own data and are not 1:1 equivalents, so they are not redirected: 200, `noindex,follow`, self canonical.

### Kept indexable / to improve

tm-materials (222), picnic (81), sandwich ingredients (59), Tera Shards (18), Data Cards (27), TMs, TRs and HMs, and the other families, including entities for which PokeAPI has few fields: a real entity with a distinct, specific name is not hidden for lack of data.

### Known limits

- `/objetos/` HTML is about 5.6 MB.
- The manifest is a snapshot of PokeAPI data; regenerate it when the data changes.
- Some indexable items are still very thin (name and category only).
- `getAllMoves` and `getAllAbilities` still use fixed limits; they do not truncate today.
- Search Console has not yet validated any SEO impact; no traffic, indexing or crawled-not-indexed improvement is claimed. Performance and Phase 5 work are not part of this release. See `docs/audits/seo-phase4-item-indexation.md`.

## [0.12.0] - 2026-09-25

### Added

- Real, canonical `<a href>` links in the initial HTML from each moves index (`/es/movimientos/`, `/en/movimientos/`) to all 937 move pages of that language.
- Server-rendered move rows in the Pokémon moves table (initial version: level, method, version, name and link), so the Pokémon → move relation exists without JavaScript.
- Own title, meta description and visible description for every move page.
- Factual ES/EN fallback description, built only from explicit data (type, category, power, accuracy, PP, priority), for moves without real localized text.
- Move → Type relation: the type badge on a move page links to the Pokepedia type page.
- Resolution of Showdown ability names to real PokeAPI slugs (`Mind's Eye` → `minds-eye`).
- Tests for move crawlability, move metadata, ability slug resolution and the ability catalog being unavailable (251 → 297 tests).

### Fixed

- The moves index no longer depends on `onclick` for discovery: the name of every move is a real link.
- Move pages no longer share the generic Layout meta description (937 pages per language did).
- A Spanish move page no longer falls back to English text when it has no Spanish description; it uses the Spanish factual sentence.
- Placeholders such as "Dummy data" and "This move can't be used…" are no longer used as descriptions.
- The learned-by counter on move pages shows the real total instead of the number of capped cards.
- `Mind's Eye` and other Showdown abilities (`Dragon's Maw`, `As One (…)`, `Embody Aspect (…)`) no longer generate internal links that 404 (11 → 0).
- If the PokeAPI ability catalog is unavailable, an ability is shown without a link instead of an invented slug.

### Known limits / not claimed

- Link text in the server-rendered index and moves table is the formatted English slug until client hydration localizes it.
- Pokémon page HTML is 39–94 KB larger because of the server-rendered move rows; not optimized here.
- This release does not address item indexing, global "Crawled — currently not indexed" or "Discovered — currently not indexed", 5xx, performance, hidden JSON, favorite hearts, Gemini, or Search Console recovery. Search Console effects are unmeasured; see `docs/audits/seo-phase3-movement-crawlability.md`.

## [0.11.0] - 2026-09-25

### Added

- Added an explicit error model that distinguishes a missing primary entity, a missing required dependency, a temporary upstream (PokeAPI) failure, and an unexpected internal error.
- Added real 404 and 500 pages: `noindex` and with no external data dependencies.
- Added tests for entity routing, HTTP status codes, canonicalization, and favorites.

### Fixed

- Missing entities now return a real 404 instead of redirecting to the listing page.
- Temporary PokeAPI failures (timeouts, network errors, 5xx) now return 503 with `Retry-After` instead of looking like the page doesn't exist.
- Unexpected internal errors now correctly end in a 500.
- Fixed a case where Astro could turn internal crashes into 404s, because its `/500/` error route matched `/[lang]/`.
- Favorites now work with canonical species slugs such as `basculin`, `deoxys`, and `zygarde`.
- Legacy favorites saved under a default-form slug now resolve and are migrated to the canonical slug.
- Deduplicated legacy and canonical favorite entries during migration so the favorites view renders each Pokémon only once on the first load.

### Changed

- The 37 duplicate default Pokémon forms now 301-redirect to their official species URL, consolidating 74 duplicate ES/EN URLs.
- Numeric entity IDs now redirect to their canonical slugs.
- Case variants now redirect to the lowercase slug.
- Generation parameters are normalized (e.g. `/02/` → `/2/`).
- Internal links now use the canonical species URLs.
- The sitemap now lists species URLs instead of default-form URLs.
- Final HTTP semantics:
  - primary entity missing → 404;
  - required dependency missing → 503;
  - optional enrichment missing → the page returns 200 with only that section degraded;
  - unexpected internal error → 500.

## [0.10.1] - 2026-09-25

### Added

- Added `pagePath()`, a single helper that builds every internal page URL (links, redirects, and client-side navigation).
- Added anti-regression tests that fail if any server-rendered internal link lacks a trailing slash, contains a double slash, or has an unresolved locale.

### Fixed

- Normalized all internal links to the trailing-slash URL convention, removing links that previously required a redirect to reach the page.
- Unsupported locales (e.g. `/xx/`, `/fr/movimientos/`) now return 404 instead of rendering a broken page.

### Changed

- Aligned internal navigation, breadcrumbs, and redirect targets with the existing canonical, hreflang, and sitemap URLs.

## [0.10.0] - 2026-08-30

### Added

- Added dynamic 1200×630 Open Graph social cards for home, Pokémon, type, and generation pages.
- Added localized Spanish and English social cards with self-hosted metadata URLs.
- Added Cloudflare-edge caching and robust artwork/render fallbacks for social previews.

### Fixed

- Replaced incorrect square/default social images and externally hosted Pokémon artwork as final `og:image`.
- Corrected Open Graph image dimensions and added accurate image alt/type metadata.

### Changed

- Versioned social-card URLs under `/og/v1/` for safe long-term immutable caching.
