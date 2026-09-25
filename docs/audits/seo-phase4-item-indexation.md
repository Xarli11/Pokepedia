# SEO Phase 4 — item entity quality and selective indexation

Base: `105be13` (v0.12.0). Measured 2026-09-25 against live PokeAPI data and
the built Cloudflare Worker (`wrangler pages dev dist`). Principle: audit →
classify → decide → implement → validate; noindex only with item-level evidence
of system data or game-internal entries, never because PokeAPI has few fields.

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
relation (machine or held-by) %, final decision as **indexable / noindex**.

| Family | Items | Name | Flavor | Effect | Sprite | Attr | Rel | Indexable / noindex |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dynamax-crystal | 300 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 0 / 300 |
| tm | 230 | 100/100 | 44/44 | 43 | 100 | 0 | 100 | 230 / 0 |
| tm-materials | 222 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 222 / 0 |
| unused | 122 | 99/100 | 95/100 | 88 | 86 | 0 | 0 | 87 / 35 (29 dup) |
| plot-advancement | 101 | 100/100 | 87/99 | 76 | 76 | 0 | 0 | 98 / 3 (3 dup) |
| tr | 100 | 100/100 | 100/100 | 0 | 0 | 0 | 100 | 100 / 0 |
| mega-stones | 92 | 51/51 | 51/51 | 51 | 51 | 0 | 0 | 92 / 0 |
| gameplay | 82 | 99/100 | 82/90 | 78 | 78 | 0 | 0 | 81 / 1 (1 dup) |
| picnic | 81 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 81 / 0 |
| species-candies | 80 | 100/100 | 100/100 | 0 | 0 | 0 | 0 | 80 / 0 |
| held-items | 72 | 100/100 | 85/85 | 76 | 76 | 44 | 39 | 72 / 0 |
| sandwich-ingredients | 59 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 59 / 0 |
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
| tera-shard | 18 | 100/100 | 0/0 | 0 | 0 | 0 | 0 | 18 / 0 |
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

## Review 2: what the first policy got wrong

The first version of the policy noindexed any family in which ≥ 90 % of the
members had no description, no sprite and no relation (680 items). That treats
"PokeAPI has few fields" as "Google should not index this entity". The review
below replaced it: **noindex now needs item-level evidence of system data or
game-internal entries.**

### Category "unused" (122 items) — audited one by one

| Group | Items | Evidence | Decision |
| --- | --- | --- | --- |
| A. documented key items (Rule Book, Seal Bag, Loot Sack, mega key stones, Ride Pager…) | 18 | real flavor ES+EN, real short effect, sprite | index |
| D. legitimate key items with real flavor ES+EN, whose *effect* is a stub (85 × "XXX new effect for …": Z-crystal `--bag`, Rotom Powers, petals, meteorites, Bike…; 2 × "Unknown.": god-stone, common-stone) | 87 | description comes from the flavor; the stub is never used | index (29 of the variant kind below) |
| D. real flavor text only, no sprite/effect (Autograph, Clothing Trunk, Wishing Chip, Rotom Bike variants, Reins of Unity…) | 9 | real flavor | index |
| stub effect, no sprite (xtransceiver `--red/--yellow`) | 2 | real flavor | index / duplicate variant |
| B. bag-UI pockets: Battle Pocket, Candy Jar, Medicine Pocket, Catching Pocket, Power-Up Pocket, Pokémon Box | 6 | blank or "-\\n-\\n-" text, no sprite, no relation, category literally "unused" | **noindex,follow** |
| C. pure placeholder/debug entities | 0 | no item is *only* a stub: every stubbed item has real flavor text | — |

The "XXX new effect for …" (87 items) and "Unknown." / "Unknown.  Currently
unused." (2) effects are placeholders and never count as content or as a
description (tested). 35 of the 122 are noindex: the 6 pockets and 29 game
variants (below); 87 stay indexable.

### tm-materials (222), picnic (81), sandwich-ingredients (59), tera-shard (18)

| Question | tm-materials | picnic | sandwich-ingredients | tera-shard |
| --- | --- | --- | --- | --- |
| Real game entities | yes (Scarlet/Violet TM crafting materials) | yes (picnic bottles, cups, tablecloths, picks) | yes (ingredients, Herba Mystica) | yes (one per type) |
| Distinct URL per entity | 222/222 unique EN and ES names | 81/81 | 59/59 | 18/18 |
| Name alone identifies it | "Psyduck Down", "Meowth Fur" | "Academy Bottle" | "Baguette", "Sweet Herba Mystica" | "Water Tera Shard" |
| Game indices (exists in game data) | 222/222 | 81/81 | 59/59 | 18/18 |
| Interchangeable / variants / duplicates | no | a few "(Y)/(R)/(B)" variants, each with its own name | no | no |
| Placeholder or internal names | none (0 "★") | none | none | none |
| Reasonable intent | "X material Pokémon" | "X picnic item" | "X sandwich ingredient" | "what is X Tera Shard" |
| Covered by another page | no | no | no | the type page covers the type, not the shard |
| **Decision** | **index + improve** | **index + improve** | **index + improve** | **index + improve** |

They have only a name and a category today, so the page is a short factual
sentence. That is a data debt, not evidence against the entity. Tera shards get
one extra explicit relation: the "{type}-tera-shard" name links its Pokepedia
type page ("Tipo Tera: Agua").

### Dynamax crystals (300) — unchanged, strong evidence

300 items, one identical "[VAR (0000)]" text in both languages, "★And15"
internal names, no sprite, attributes, effect or relation: system data.
noindex,follow, 200, out of the sitemap, not blocked in robots.txt.

### Duplicated variants (68)

Items with the exact same ES + EN name as a primary that stays indexable
(`laultra-ball` → `ultra-ball`, `storage-key--sea-mauville` → `storage-key`,
`firium-z--held` ↔ `firium-z--bag`). Checked against their primaries: **64 have
their own distinct description**, 53 belong to a different PokeAPI category (a
held Z-crystal vs the key item, for instance), 4 have no text of their own and 1
(`bike--yellow`) has the same text as `bike--green`. None is a provable 1:1
equivalent (different PokeAPI entities, ids and data), so **no 301**: they stay
reachable 200 pages, `noindex,follow`, self canonical, with the primary carrying
the search intent.

### TM / TR / HM: one move or several?

Fetched every machine (2372) of the 338 machine items:

| Kind | Items | Teach exactly 1 move across games | Teach > 1 move | Max distinct moves |
| --- | --- | --- | --- | --- |
| TM | 230 | 70 | 160 | 9 |
| TR | 100 | 100 | 0 | 1 |
| HM | 8 | 4 | 4 | 4 |
| total | 338 | 174 | 164 | 9 |

Examples: TM26 is Earthquake in 20 version groups, Scary Face in Sword/Shield, Poison
Jab in Let's Go, Poison Tail in Scarlet/Violet and Energy Ball in Legends Z-A;
TM43 has 9 moves (Secret Power, Flame Charge, Sky Attack, Detect, Shadow Ball,
Fly, Volt Switch, Brick-Break, Fling); TM01 has 8. A title naming the newest move
would present one game's move as universal, so **machine titles are the number
only** ("TM26 — Technical Machine Pokémon"); the newest game's move appears in the
description and on the page **with its game** ("teaches Energy Ball in Pokémon
Legends: Z-A", "Teaches: Energy Ball (Pokémon Legends: Z-A)"). With no known game
the move is not stated at all. All 338 links resolve to the move of the latest
machine (338/338) and all move pages answer 200. Not done: a per-game list.

## Remaining duplicated titles (indexable pages)

8 pairs, 10 ES and 6 EN pages: distinct items that share a name in *one*
language: Bici (bicycle / bike--green), Objeto Perdido (lost-item /
dropped-item), Piezas Devon (devon-goods / devon-parts), Llave Ascensor
(lift-key / elevator-key), Maleta (travel-trunk / clothing-trunk); EN: S.S.
Ticket (ss-ticket / ss-ticket--letsgo), Basement Key (basement-key /
basement-key--new-mauville), Contest Costume (--jacket / --dress). There is no
clean factual differentiator (the categories that differ are "Sin uso" /
"Unused"), so nothing is forced.

## Other relations

- Item → Pokémon (`held_by_pokemon`): capped at 15 cards through `PokemonCard`
  (canonical species URLs), real total shown, "Mostrando/Showing N" when capped.
- Item → Type: Tera shards only. Item → category / attribute / generation: no
  Pokepedia pages exist, nothing linked.

## Final policy

| Class | Items | Rule |
| --- | --- | --- |
| INDEX | 1191 | real description in ES and EN |
| INDEX + IMPROVE | 657 | description in one language, or none but ≥ 2 signals, or a thin real entity (name + category: tm-materials, picnic, sandwich, tera shards, Booster Energy, Z-A mega stones…): factual localized sentence |
| NOINDEX,follow | 306 policy + 68 duplicate variants = **374** | 300 dynamax crystals (system data), 6 bag-UI pockets (game-internal category, no data); 68 same-name game variants |
| CONSOLIDATE (301) | 0 | no provable equivalent |
| INVALID (404) | 0 | all 2222 slugs answer 200 |

**1848 indexable, 374 noindex per language.**

## AFTER

| Metric | Value |
| --- | --- |
| `getAllItems()` | 2222 = PokeAPI count 2223 minus the duplicated slug; asserted by test |
| Item pages | 1848 indexable + 374 noindex per language; 4444 URLs all 200 |
| Sitemap total | **8436** (−304 vs v0.12.0's 8740) |
| Sitemap by family | pokemon 2050, moves 1874, abilities 748, items 3696 (1848 ES + 1848 EN), types 36, generations 18, static 14 |
| Explanation of −304 | items 4000 → 3696: +444 for the 222 recovered items (×2 languages) −748 for 374 noindex items (×2). Nothing else changed. |
| Unique titles among indexable pages ES / EN | 1843 / 1845 (10 / 6 pages share a title, see above) |
| Unique meta descriptions among indexable ES / EN | 1848 / 1848 (0 duplicated) |
| ES pages with an English meta description | 0 (was 950) |
| Placeholders in meta / visible text | 0 / 0 (two English flavor texts that contain the word "unknown" are real text) |
| Items index HTML | 5.6 MB (+11 %), 2222 anchors, 2 SSR list fetches, 0 per item |
| Item detail HTML | −2 % … +0.6 %; SSR fetches per detail unchanged |
| Sitemap item URLs | 3696 / 3696 direct 200, none redirect, none noindex |
| Noindex pages | 374 ES + 374 EN: all 200, `noindex,follow`, self canonical, absent from the sitemap |
| Canonical / og:url | 4444 / 4444 self-consistent; hreflang es/en on all |
| Internal links on item pages | 99,628 checked: 0 without trailing slash, 0 www, 0 numeric ids, 0 uppercase; 1356 targets all direct 200 |
| Machine items | 338 / 338 link the latest machine's move, 237 distinct moves, all move pages 200 |
| JSON-LD | unchanged (WebApplication + BreadcrumbList) |
| Tests | 297 → 396 (+99): itemCatalog 6, itemSeo 43, itemMeta 21, itemIndexing 10, item-indexation SSR 19 |

Phases 1–3 regression: 937 move anchors per language, MovesTable SSR rows,
ability slug resolution, 301/404/500 and sitemap hygiene unchanged.

## Enrichment debt (kept indexable, needs data)

tm-materials 222, picnic 81, sandwich-ingredients 59, tera-shard 18 (name +
category only), 11 held items (Booster Energy, Ability Shield, Covert Cloak,
Clear Amulet…), 45 unnamed Legends Z-A mega stones. If Search Console later
shows they are "crawled – not indexed" en masse, revisit with that evidence;
enrichment would need data PokeAPI does not expose (which TM each material
crafts, which sandwich uses an ingredient).

## Risks and known limits

- The manifest is a snapshot: run `npm run data:items-seo` when PokeAPI data
  changes (`-- --check` exits 1 when stale). Page and sitemap both read it.
- The 374 noindex are decided on data, not Search Console; the 68 variants carry
  their own text, so this is the most debatable group: reversible by editing
  the duplicate rule.
- Indexable thin pages (≈ 380 name-only entities) may end up "crawled – not
  indexed"; that is measurable, not assumed.
- `/objetos/` HTML is 5.6 MB (Phase 5).
- `getAllMoves` / `getAllAbilities` still use fixed limits (not truncated
  today); `getCompleteResourceList` is ready for them.

## Search Console plan (not touched by this phase)

After production: the sitemap goes 8740 → 8436 and should be re-read; inspect a
sample of INDEX and of NOINDEX items (expect "noindex" detected; crawling is
allowed, robots.txt does not block them); consider requesting a recrawl; only
then decide whether to validate "Google chose a different canonical" once the
remaining URLs in that group are known. Compare at +7, +14 and +28 days for the
items cluster: indexed, crawled-not-indexed, impressions, clicks, queries,
position (separately for the thin indexable families). No improvement is claimed
before that data exists.
