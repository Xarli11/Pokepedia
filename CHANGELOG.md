# Changelog

All notable changes to Pokepedia are documented in this file.

## [Unreleased]

### Added

- Item quality and indexation policy (`src/utils/itemSeo.ts`) with placeholder detection; `npm run data:items-seo` regenerates the committed manifest of `noindex,follow` items shared by the item pages and the sitemap.
- Own title, meta description and visible factual sentence for item pages: real text in the page language, else a factual ES/EN fallback built only from explicit fields.
- TM / TR / HM pages name the move taught by the most recent game and link its move page.

### Fixed

- The item catalog is loaded completely (2223 items; it stopped at 2000 and dropped 223 items from the sitemap and the items index).
- Placeholder texts (`[VAR (0000)]`, `XXX new effect for …`, `Unknown.`, dashes) are no longer shown as descriptions.
- Spanish item pages no longer use English text as their meta description.

### Changed

- 749 low-value item pages (dynamax crystals, name-only material/picnic/sandwich/tera-shard items, game-variant duplicates) are `noindex,follow` and left out of the sitemap (8740 → 7686 URLs); they remain reachable pages.

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
