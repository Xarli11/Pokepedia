# SEO Phase 4 — item entity quality and selective indexation

Base: `105be13` (v0.12.0). Measured 2026-09-25 against live PokeAPI data and
the built Cloudflare Worker (`wrangler pages dev dist`). Principle: audit →
classify → decide → implement → validate; noindex only with family-level
evidence, never by name or by suspected low traffic.

## BEFORE

| Metric | Value |
| --- | --- |
| Items in PokeAPI (`/item` count) | 2223 (2222 unique slugs: `roseli-berry` is listed twice, ids 723 and 2279) |
| Loaded by `getAllItems()` | 2000 |
| Missing | 223 (222 unique): picnic 43, all-machines 58, tm-materials 41, mega-stones 45, standard-balls 11, ... |
| Cause | hard-coded `/item?limit=2000`; PokeAPI answered `next: …offset=2000` and it was ignored |
| Item categories / pockets / attributes | 54 / 8 / 8 |
| Pockets (unique items) | misc 1204, key 391, machines 338, medicine 106, berries 73, pokeballs 38, battle 36, mail 36 |
| Sitemap total | 8740 URLs: pokemon 2050, moves 1874, abilities 748, items 4000 (2000 ES + 2000 EN, **45.8 %**), types 36, generations 18, static 14 |
| Catalog items missing from the sitemap | 222 (plus the duplicated slug) |
| Item pages | 2222 ES + 2222 EN, all 200, none with a robots meta |
| Names ES / EN | 2172 / 2175 |
| Flavor text ES / EN | 1553 / 1612 |
| Effect entries ES / EN | **0** / 954 |
| Sprite / attributes / machines / held-by / fling power | 1093 / 248 / 338 / 119 / 671 |
| Cost | **0** items: PokeAPI no longer returns `cost` (the price badge could never render) |
| Unique titles ES / EN | 2148 / 2150 (136 / 132 pages share a title) |
| Unique meta descriptions ES / EN | 1156 / 1155 (1087 pages per language share one) |
| ES pages whose meta description is English | 950 |
| Pages showing "[VAR (0000)]" | 600 (300 per language) |
| Pages showing "XXX new effect for …" | 174 (87 items × 2) |
| Items index HTML (`/es/objetos/`) | 5,050,631 B, 2000 anchors, 1 SSR list fetch |

## Placeholders found (all fields, ES+EN)

| Pattern | Items | Family | Field |
| --- | --- | --- | --- |
| `[VAR (0000)]` | 300 | dynamax-crystal | flavor ES + EN (one identical text) |
| `★And15`-style internal name | 300 | dynamax-crystal | name ES + EN |
| `XXX new effect for <slug>` | 87 | unused (game variants) | effect EN |
| dashes only (`-\n-\n-`) | 28 | unused (UI pockets) and others | flavor |
| whitespace-only | 22 | 9 families | flavor ES |
| `Unknown.` / `Unknown.  Currently unused.` | 2 | unused | effect EN |
| `Unused.` as the long effect | 4+ | unused | effect EN (short_effect is real and is what is shown) |

`Dummy Data`, `debug`, `????` and unresolved template variables other than
`[VAR` were searched for and not found in items.

## Families (all 2222 unique items)

Columns: name ES/EN %, flavor ES/EN %, effect EN %, sprite %, attributes %,
relation (machine or held-by) %, decision as **indexable / noindex**.

| Family | Items | Name | Flavor | Effect | Sprite | Attr | Rel | Indexable / noindex |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dynamax-crystal | 300 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 0 / 300 |
| tm | 230 | 100/100 | 44/44 | 43 | 100 | 0 | 100 | 230 / 0 |
| tm-materials | 222 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 0 / 222 |
| unused | 122 | 99/100 | 95/100 | 88 | 86 | 0 | 0 | 92 / 30 (30 dup) |
| plot-advancement | 101 | 100/100 | 87/99 | 76 | 76 | 0 | 0 | 98 / 3 (3 dup) |
| tr | 100 | 100/100 | 100/100 | 0 | 0 | 0 | 100 | 100 / 0 |
| mega-stones | 92 | 51/51 | 51/51 | 51 | 51 | 0 | 0 | 92 / 0 |
| gameplay | 82 | 99/100 | 82/90 | 78 | 78 | 0 | 0 | 81 / 1 (1 dup) |
| picnic | 81 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 0 / 81 |
| species-candies | 80 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 80 / 0 |
| held-items | 72 | 100/100 | 85/85 | 76 | 76 | 44 | 39 | 72 / 0 |
| sandwich-ingredients | 59 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 0 / 59 |
| vitamins | 48 | 98/100 | 85/85 | 33 | 33 | 19 | 0 | 48 / 0 |
| evolution | 40 | 100/100 | 80/80 | 55 | 53 | 20 | 18 | 40 / 0 |
| loot | 38 | 100/100 | 95/95 | 63 | 63 | 5 | 32 | 37 / 1 (1 dup) |
| all-mail | 36 | 100/100 | 33/100 | 100 | 100 | 0 | 0 | 36 / 0 |
| z-crystals | 29 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 0 / 29 (29 dup) |
| data-card | 27 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 27 / 0 |
| curry-ingredients | 25 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 25 / 0 |
| miracle-shooter | 24 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 24 / 0 |
| event-items | 23 | 100/100 | 43/57 | 57 | 57 | 0 | 0 | 22 / 1 (1 dup) |
| species-specific | 22 | 100/100 | 100/100 | 91 | 91 | 50 | 36 | 22 / 0 |
| type-enhancement | 22 | 100/100 | 100/100 | 100 | 100 | 100 | 77 | 22 / 0 |
| nature-mints | 21 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 21 / 0 |
| plates | 19 | 100/100 | 89/89 | 89 | 89 | 84 | 0 | 19 / 0 |
| standard-balls | 18 | 100/100 | 39/72 | 39 | 100 | 28 | 0 | 14 / 4 (4 dup) |
| type-protection | 18 | 94/94 | 94/94 | 94 | 100 | 94 | 94 | 18 / 0 |
| jewels | 18 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 18 / 0 |
| tera-shard | 18 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 0 / 18 |
| dex-completion | 17 | 100/100 | 100/100 | 76 | 76 | 47 | 6 | 17 / 0 |
| memories | 17 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 17 / 0 |
| status-cures | 14 | 100/100 | 100/100 | 93 | 93 | 64 | 0 | 14 / 0 |
| baking-only | 14 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 14 / 0 |
| special-balls | 13 | 100/100 | 100/100 | 100 | 100 | 85 | 0 | 13 / 0 |
| healing | 13 | 100/100 | 100/100 | 100 | 100 | 92 | 23 | 13 / 0 |
| collectibles | 13 | 100/100 | 100/100 | 54 | 54 | 54 | 38 | 13 / 0 |
| spelunking | 12 | 100/100 | 100/100 | 75 | 75 | 33 | 0 | 12 / 0 |
| medicine | 10 | 100/100 | 100/100 | 100 | 100 | 100 | 100 | 10 / 0 |
| stat-boosts | 9 | 100/100 | 100/100 | 89 | 89 | 89 | 0 | 9 / 0 |
| in-a-pinch | 9 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 9 / 0 |
| mulch | 8 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 8 / 0 |
| training | 8 | 100/100 | 100/100 | 100 | 100 | 100 | 38 | 8 / 0 |
| hm | 8 | 100/100 | 88/100 | 100 | 100 | 0 | 100 | 8 / 0 |
| effort-training | 7 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 7 / 0 |
| apricorn-balls | 7 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 7 / 0 |
| apricorn-box | 7 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 7 / 0 |
| effort-drop | 6 | 100/100 | 100/100 | 100 | 100 | 0 | 0 | 6 / 0 |
| bad-held-items | 6 | 100/100 | 100/100 | 100 | 100 | 100 | 83 | 6 / 0 |
| catching-bonus | 6 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 6 / 0 |
| revival | 5 | 100/100 | 100/100 | 80 | 80 | 80 | 60 | 5 / 0 |
| pp-recovery | 5 | 80/80 | 80/80 | 80 | 80 | 80 | 0 | 5 / 0 |
| picky-healing | 5 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 5 / 0 |
| other | 5 | 100/100 | 100/100 | 100 | 100 | 60 | 0 | 5 / 0 |
| scarves | 5 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 5 / 0 |
| flutes | 3 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 3 / 0 |
| choice | 3 | 100/100 | 100/100 | 100 | 100 | 100 | 0 | 3 / 0 |

(`cost` is 0 % everywhere. TM/TR/HM are split from PokeAPI's `all-machines`;
`data-card` is split from `data-cards`.)

## Criteria

Implemented in `src/utils/itemSeo.ts` (pure, tested); the whole catalog is
evaluated by `scripts/item-seo-manifest.ts` into `src/data/itemSeoManifest.json`.

- **index** — real (non-placeholder) description in ES and EN.
- **index + improve** — description in only one language (the page adds a
  factual fallback in its own language), or none but ≥ 2 supporting signals
  (sprite, attributes, machine/held-by relation), or a *thin* item inside a
  documented family (a PokeAPI data gap).
- **noindex,follow** — only with family-level evidence: ≥ 5 members and ≥ 90 %
  of them thin (no real description and < 2 supporting signals); **or** an item
  sharing its exact ES + EN name with a primary variant (game-specific
  duplicate).
- **consolidate (301)** — none: the only true duplicates are game variants that
  keep their own data, so they stay reachable pages (noindex,follow, self
  canonical) rather than redirecting to a different entity.
- **not found** — none: all 2222 slugs answer 200 (numeric ids and case
  variants already 301 since v0.11.0).

A single thin item is never noindexed alone: Booster Energy, Ability Shield,
Covert Cloak, Clear Amulet (11 of 72 held items) and 45 unnamed Legends Z-A mega
stones are PokeAPI data gaps, so they stay indexable with a factual page
until the data arrives.

## Decisions

| Group | Items | Decision | Evidence |
| --- | --- | --- | --- |
| dynamax-crystal | 300 | **noindex,follow** | one identical "[VAR (0000)]" text in both languages (300/300), internal "★" names, no sprite, attributes, effect or relation. The historical hypothesis was right, now proven. |
| tm-materials | 222 | **noindex,follow** | name + category only, 222/222: no text, sprite, attributes or relation |
| picnic | 81 | **noindex,follow** | same, 81/81 |
| sandwich-ingredients | 59 | **noindex,follow** | same, 59/59 |
| tera-shard | 18 | **noindex,follow** | same, 18/18 |
| game-variant duplicates | 69 | **noindex,follow** | identical ES+EN name as a primary that stays indexable (`laultra-ball` → `ultra-ball`, `storage-key--sea-mauville` → `storage-key`, `firium-z--held` ↔ `firium-z--bag`…) |
| data-card | 27 | **index** | 27 distinct ES flavor texts, 27 distinct EN effects, sprites. The historical noindex hypothesis was **wrong**. |
| TM | 230 | **index / improve** | machine → move relation, sprite; only 44 % have flavor text |
| TR | 100 | **index / improve** | 100 % flavor + machine relation, 100 distinct moves |
| HM | 8 | **index** | |
| all other families | | **index / improve** | documented data |

Totals: **1473 indexable, 749 noindex** (680 family-level + 69 duplicate variants).

## TM / TR / HM → move

338 machine items. `machines[0]` is the oldest version group and named a
different move than the current games for most TMs (the page used it). The
page now takes the machine of the most recent version group
(`pickLatestMachine`, ranks extended with `the-teal-mask`, `the-indigo-disk`,
`legends-za`, `mega-dimension`) and links `/{lang}/movimientos/{slug}/` with the
game named. Verified on all 338: the linked move equals the latest machine's move
(machine endpoint item ↔ machine consistency 338/338), 237 distinct moves, every
move page answers 200. Cost: one machine + one move request on the item page
(unchanged; nothing on the index). The item's own effect/flavor text is not
shown next to a machine fact, since it can describe another generation's move.
Not done: a per-game list of what each TM taught (needs one request per game).

## Other relations

- Item → Pokémon (`held_by_pokemon`): already shown, capped at 15 cards through
  `PokemonCard` (canonical species URLs); the counter shows the real total and
  "Mostrando/Showing N" when capped. Kept, not extended.
- Item → category / attribute / generation: no Pokepedia pages exist for them, so
  nothing is linked (no pages created for SEO).

## AFTER

| Metric | Value |
| --- | --- |
| `getAllItems()` | 2222 = PokeAPI count 2223 minus the duplicated slug; asserted by test |
| Item pages | 1473 indexable + 749 noindex per language; 2222 ES + 2222 EN all 200 |
| Sitemap total | **7686** (−1054) |
| Sitemap by family | pokemon 2050, moves 1874, abilities 748, items 2946 (1473 ES + 1473 EN), types 36, generations 18, static 14 |
| Explanation of −1054 | items 4000 → 2946: +444 for the 222 recovered items (×2 languages) −1498 for 749 noindex items (×2). Nothing else changed. |
| Unique titles among indexable pages ES / EN | 1468 / 1470 (10 / 6 pages still share a title with another distinct item that has the same name in one language, e.g. Bici, Objeto Perdido) |
| Unique meta descriptions among indexable ES / EN | 1473 / 1473 (0 duplicated) |
| ES pages with an English meta description | 0 (was 950) |
| Pages showing "[VAR" / "XXX new effect" | 0 / 0 |
| Items index HTML | 5,607,985 B (+11 %), 2222 anchors, 2 SSR list fetches (count probe + full list), 0 per-item |
| Item detail HTML (27 sampled) | −2 % … +0.6 %; SSR fetches per detail unchanged (item, plus machine + move for TM/TR/HM, plus ≤ 15 held-by) |
| Sitemap item URLs | 2946 / 2946 direct 200, none redirect, none noindex |
| Noindex pages | 749 ES + 749 EN: all 200, `noindex,follow`, self canonical, absent from the sitemap |
| Canonical / og:url | 4444 / 4444 self-consistent; hreflang es/en present on all |
| Internal links on item pages | 99,592 checked: 0 without trailing slash, 0 www, 0 numeric ids, 0 uppercase; 1356 distinct move/Pokémon/ability targets, all direct 200 |
| JSON-LD | unchanged (WebApplication + BreadcrumbList); no Product/Item schema invented |
| Tests | 297 → 380 (+83): itemCatalog 6, itemSeo 33, itemMeta 18, itemIndexing 9, item-indexation SSR 17 |

Phases 1–3 regression: 937 move anchors per language, MovesTable SSR rows,
ability slug resolution, 301/404/500 behavior and sitemap hygiene unchanged.

## Risks and known limits

- The manifest is a snapshot: when PokeAPI fills in data (Z-A mega stones,
  picnic/sandwich descriptions) run `npm run data:items-seo`; `-- --check`
  exits 1 when it is stale. Until then an item stays noindex (page and sitemap
  agree, both read the manifest).
- 749 pages are noindex on data grounds, not on Search Console evidence. The
  family-level rule is conservative, but tera shards, picnic and sandwich items
  are real game items a user might search; they can be restored by adding data.
- 45 unnamed Z-A mega stones and 11 held items are indexable with only a
  factual sentence: thin pages that may end up "crawled – not indexed".
- `/objetos/` HTML is 5.6 MB (2222 cards with long class lists); optimizing it
  is Phase 5.
- `getAllMoves` (`limit=1000`, 937 moves) and `getAllAbilities`
  (`limit=500`, 374 abilities) still use fixed limits; they are not truncated
  today, but have the same latent flaw. `getCompleteResourceList` is ready for them.
- 16 indexable pages share a title in one language (same-named distinct items).

## Search Console plan (not touched by this phase)

After production: check the sitemap shrinks 8740 → 7686 and is read; inspect a
sample of INDEX items and of NOINDEX items (expect "noindex" detected, crawl
allowed — robots.txt does not block them); consider requesting a recrawl;
only then decide whether to validate "Google chose a different canonical" once
the remaining URLs in that group are known. Compare at +7, +14 and +28 days for
the items cluster: indexed, crawled-not-indexed, impressions, clicks, queries,
position. No improvement is claimed before that data exists.
