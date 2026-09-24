# Changelog

All notable changes to Pokepedia are documented in this file.

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
