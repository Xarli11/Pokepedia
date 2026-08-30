# Changelog

All notable changes to Pokepedia are documented in this file.

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
