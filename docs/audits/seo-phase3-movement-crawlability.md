# SEO Phase 3 — movement crawlability, entity quality, ability link integrity

Base: `979d828` (v0.11.0). Measured 2026-09-25 against live PokeAPI / Showdown
data, and against the built Cloudflare Worker (`wrangler pages dev dist`).

## Before → after

| Metric | Before | After |
| --- | --- | --- |
| Moves (PokeAPI) | 937 | 937 |
| Move URLs in sitemap (ES / EN / total) | 937 / 937 / 1874 | 937 / 937 / 1874 (unchanged, none removed) |
| Real `<a href>` to moves, `/es/movimientos/` | 0 | 937 (937 unique) |
| Real `<a href>` to moves, `/en/movimientos/` | 0 | 937 (937 unique) |
| Rows navigating only through `onclick` | 937 (1874 `onclick`) | 0 |
| Index SSR fetches | 1 (`/move?limit=1000`) | 1 |
| `/es/movimientos/` HTML (prod build) | 1,442,142 B | 1,378,599 B |
| Pokémon `<tbody>` SSR rows (feraligatr / garchomp / pikachu / charizard / sneasler) | 0 / 0 / 0 / 0 / 0 | 48 / 60 / 30 / 37 / 72 (each a canonical move link) |
| Pokémon page HTML (feraligatr / garchomp / pikachu / charizard / sneasler) | 487,730 / 377,169 / 482,651 / 593,079 / 129,717 B | 549,650 / 454,896 / 521,621 / 641,071 / 224,108 B |
| Move pages with the Layout default meta description | 937 ES + 937 EN | 0 |
| Unique titles per language | 919 (36 pages shared a title) | 937 |
| Unique meta descriptions per language | 1 | 919 (ES) / 919 (EN); max 3 pages share a text |
| ES pages with no real Spanish text | 108 (85 showed English, 23 empty) | 108 → factual Spanish sentence |
| EN pages with no real English text | 23 (empty) | 23 → factual English sentence |
| Empty visible descriptions | 108 ES-incl-English-fallback, 23 EN | 0 / 0 |
| Showdown ability names linking to a 404 | 11 of 321 | 0 (4 resolved by normalization, 4 by variant rule, 3 unlinked: no PokeAPI entity) |

## Ability inventory (Showdown `pokedex.json` vs PokeAPI `/ability`)

321 distinct names; 310 direct; 4 normalized (`Dragon's Maw`, `As One (Glastrier)`,
`As One (Spectrier)`, `Mind's Eye`); 4 variant (`Embody Aspect (Teal|Wellspring|Hearthflame|Cornerstone)`
→ `embody-aspect`); 3 unresolved, left unlinked (`''` for MissingNo, `Persistent`
and `Rebound`, CAP fakemon abilities); 0 normalized-key collisions among the 374 PokeAPI abilities.

## Known limits

- Anchor text in the SSR index and MovesTable is the formatted English slug
  (`Swords Dance`) until client hydration localizes it: localized names need one
  fetch per move, which this phase deliberately does not add.
- Type / category / power / accuracy / PP in the index and category / priority /
  effect in MovesTable still hydrate client-side.
- `shadow`-type moves (18) have no `/tipo/shadow/` page, so their badge is not linked.
- ES flavor text is missing for 108 moves in PokeAPI; those pages use the factual sentence.

## Search Console measurement (do not claim success before this)

Baseline: v0.11.0 in production on 2026-09-25. After this phase reaches
production, compare at +7, +14 and +28 days:

- movement URLs indexed; movement URLs "Crawled — currently not indexed";
- impressions and clicks for `/movimientos/` and `/movimientos/{slug}/`;
- queries by move name, average position;
- time to recrawl.
