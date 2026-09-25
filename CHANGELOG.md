# Changelog

All notable changes to Pokepedia are documented in this file.

## [Unreleased]

### Added

- The moves index and the Pokémon moves table now expose real `<a href>` links to every `/{lang}/movimientos/{slug}/` page in the initial HTML.
- The Pokémon moves table server-renders the rows of the initially selected version (level, method, version, name, link) without JavaScript.
- Move pages have their own title, meta description and visible description: real localized text when it exists, otherwise a factual sentence in the page language built only from explicit data.
- The move type badge links to the Pokepedia type page.
- Showdown ability names are resolved against PokeAPI's real ability slugs (`Mind's Eye` → `minds-eye`).

### Fixed

- Move pages no longer share the Spanish default meta description (937 pages per language did); "Dummy data" and "This move can't be used" placeholders are no longer shown as descriptions.
- The learned-by counter on move pages shows the real total instead of the number of capped cards.
- Ability links generated from Showdown names no longer 404 (`Mind's Eye`, `Dragon's Maw`, `As One (…)`, `Embody Aspect (…)`); names with no PokeAPI ability are shown unlinked.

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
