# SEO Phase 5 — Crawl performance, reliability and crawl efficiency

Base: `main` = `develop` = `8d6cea23bb18a42324973ab1c4e2a4715481003a` (v0.13.0).
Branch: `feature/seo-crawl-performance`.
Method: data → hypothesis → action → measurement → iteration. Nothing below was
changed before it was measured; two things that looked right on paper were
measured, found worse, and reverted (see "What measurement corrected").

Not touched, by instruction: Search Console, the Phase 4 item indexation policy
(1848 indexable / 374 noindex per language), the sitemap's 8436 URLs, branding,
new pages, infrastructure, releases.

---

## 1. Architecture (BEFORE any change)

| | |
|---|---|
| Framework / adapter | Astro 5.17.3, `output: 'server'`, `@astrojs/cloudflare` 12.6.13 → Cloudflare Pages advanced-mode worker (`dist/_worker.js`), `trailingSlash: 'always'` |
| Rendering | **Every route is SSR** (no prerendered pages). Each request runs the worker and calls upstream APIs |
| Hydration | **No framework islands** (no `client:*` anywhere). Interactivity is plain `<script>` blocks + `ClientRouter` (View Transitions). "Hydration payload" therefore means only what pages serialize by hand: a JSON `<div>` in `MovesTable`, `data-*` attributes |
| Upstream providers | PokeAPI (required data), Showdown `pokedex.json` 524 KB (optional: types/stats/abilities/tier), Smogon sets `gen9ou.json` 55 KB (optional), WikiDex (optional Spanish text fallback) |
| Server cache | In-memory `Map`, 24 h, per isolate (`services/pokeapi.ts`, `services/smogon.ts`). No edge cache, no KV, no HTML cache |
| HTML cache headers | **None** on any HTML response (200/301/404/503). Only `/sitemap.xml` sets `public, s-maxage=86400, stale-while-revalidate=3600`. 503 already sends `Retry-After: 60` + `no-store` |
| Personalization | HTML does **not** vary by user. Only `Accept-Language` on `/` (308 redirect). Verified live: identical bytes for different `Accept-Language`/`Cookie` on `/es/pokemon/pikachu/` and `/es/objetos/`. Favorites/history live in `localStorage`, client only. So no cookie/`Vary` fragmentation exists to worry about |

### Route map (BEFORE)

Blocking = the page can't render without it (failure → 503/404 per Phase 2).
Optional = failure degrades a section, page stays 200.

| Route | Blocking (required) | Optional enrichment | Cacheable data |
|---|---|---|---|
| `/{lang}/` | `generation/{n}` | Showdown pokedex (types) | generation, pokedex |
| `/{lang}/pokemon/{slug}/` | `pokemon/{slug}` → `species` (2 sequential) | Showdown, ability catalog, Smogon sets, evolution chain (+ item/location names), ability details, alternate forms, prev/next (2 full `pokemon/{id}`), ES move/item names for sets, WikiDex | all of it (24 h) |
| `/{lang}/movimientos/` | move catalog | — (all per-row data is fetched by the browser) | catalog |
| `/{lang}/movimientos/{slug}/` | `move/{slug}` | up to 40 × `pokemon/{id}` for the learned-by cards | move, Pokémon |
| `/{lang}/habilidades/{slug}/` | `ability/{slug}` | up to 40 × `pokemon/{id}` | ability, Pokémon |
| `/{lang}/objetos/` | item catalog (2 requests: head + list) | — | catalog |
| `/{lang}/objetos/{slug}/` | `item/{slug}` | TM/TR/HM: machine → move; up to 15 × `pokemon/{id}` held-by | item, machine, move, Pokémon |
| `/{lang}/tipo/{slug}/` | `type/{slug}`, species list | Showdown pokedex (secondary types), 9 × `generation/{n}` | all |
| `/{lang}/generacion/{n}/` | `generation/{n}` | Showdown pokedex | all |
| `/sitemap.xml` | item (2 req), move, ability, species catalogs | none (a failing family was silently dropped, see §5) | all |

---

## 2. Measurement method and its limits

* **HTML bytes / headers / latency**: `astro build` → `wrangler pages dev dist`
  (workerd, real network to PokeAPI/Showdown/Smogon), raw bytes with
  `Accept-Encoding: identity`; gzip -9 and brotli -q5 shown for reference only.
  Local workerd is **not** Cloudflare's edge: it is used for *relative*
  comparison. BEFORE = a worktree of `8d6cea2` built and served side by side.
* **Fetch maps**: an instrumented `fetch` around the Astro Container render
  (`src/__scratch__`, not committed) — per URL start/duration/status/bytes,
  cold (fresh module registry = fresh isolate) and warm (second render).
  Container HTML has dev-only `data-astro-source-*` attributes, so byte counts
  come from wrangler, fetch counts from the harness.
* **Latency**: medians of 5 cold runs (module reset each) and 9 warm requests.
  **PokeAPI's own latency drifted ~2× between runs** (e.g. move page cold
  189/77 ms BEFORE in two runs), so only deltas that are large and repeat across
  runs are claimed (marked ✔ below).
* Cloudflare-only behavior (Cache API hit rates, CPU limits, subrequest limits)
  cannot be measured locally and is stated as unverified where it matters.

---

## 3. BEFORE

### 3.1 HTML (raw bytes, initial HTML — not the hydrated DOM)

| Page | raw | gzip | brotli | `<a>` |
|---|---:|---:|---:|---:|
| `/es/objetos/` | 5 608 043 | 119 162 | 79 187 | 2238 |
| `/en/objetos/` | 5 607 829 | 118 983 | 78 906 | 2238 |
| `/es/movimientos/` | 1 378 599 | 52 922 | 40 364 | 953 |
| `/en/movimientos/` | 1 378 451 | 52 834 | 40 273 | 953 |
| `/es/habilidades/` | 516 590 | 20 020 | 15 749 | 390 |
| `/es/` | 529 852 | 28 811 | 23 092 | 168 |
| `/es/tipo/water/` | 472 495 | 19 103 | 14 933 | 200 |
| `/es/generacion/1/` | 453 788 | 18 563 | 14 554 | 184 |
| pokemon feraligatr | 549 650 | 34 412 | 28 555 | 80 |
| pokemon garchomp | 454 896 | 31 505 | 26 776 | 94 |
| pokemon pikachu | 521 621 | 34 514 | 28 575 | 77 |
| pokemon charizard | 641 071 | 38 292 | 30 324 | 72 |
| pokemon sneasler | 224 108 | 24 993 | 21 854 | 105 |
| pokemon ursaluna-bloodmoon | 216 153 | 25 102 | 22 009 | 112 |
| move surf / earthquake / protect / brutal-swing | 227 058 / 227 328 / 228 225 / 228 619 | ≈12.7–13.2 K | ≈10.4–10.8 K | 61 |
| item leftovers | 40 017 | 9 077 | 8 532 | 22 |
| item tm26 | 27 916 | 7 161 | 6 740 | 21 |
| item water-tera-shard | 27 550 | 7 044 | 6 608 | 21 |
| item oran-berry | 103 416 | 10 675 | 9 415 | 35 |
| item dynamax-crystal-and15 | 27 320 | 7 017 | 6 575 | 20 |
| ability minds-eye | 32 234 | 8 322 | 7 860 | 21 |
| ability levitate | 227 137 | 12 439 | 10 206 | 60 |

The Phase 3 numbers in the brief (Pokémon 224–641 KB, `/es/objetos/` ≈5.6 MB)
reproduce exactly on v0.13.0.

Compression is not a fix: the 5.6 MB page is 47× compressible *because it is
the same 35 classes repeated 2222 times*. Googlebot still receives, parses and
builds a DOM from 5.6 MB.

### 3.2 Where the bytes were (hidden/serialized data audit)

| Page | useful visible HTML | hidden JSON/scripts | repeated attributes | notes |
|---|---|---|---|---|
| `/es/objetos/` (5.61 MB) | text 81 KB, hrefs 75 KB | `data-*` 551 KB, inline `onerror` 191 KB, `style=` 158 KB, per-card fallback `<svg>` **614 KB** | `class=` **2 768 KB (49.4 %)** | 2222 cards × ≈2.5 KB; the same ~35 utilities on every card |
| `/es/movimientos/` (1.38 MB) | text 31 KB, hrefs 35 KB | `data-*` 437 KB (7 × `https://pokeapi.co/api/v2/move/N/` per row) | `class=` 756 KB (54.8 %) | 937 rows × ≈1.4 KB |
| pokemon feraligatr (550 KB) | table 62 KB | **`moves-data` JSON 405 678 B (74 %)** | `class=` 72 KB | JSON was every processed row (name, slug, url, level, method, methodLabel, version, versionLabel), HTML-escaped (`"`→`&quot;`) — a duplicate of the visible table |
| pokemon charizard (641 KB) | table 48 KB | `moves-data` **509 169 B (79 %)** | | |
| pokemon garchomp (455 KB) | table 78 KB | `moves-data` 290 697 B (64 %) | | |
| pokemon sneasler (224 KB) | table 94 KB | `moves-data` 48 260 B | `class=` 94 KB (42 %) | few moves per version → small JSON |
| `/es/habilidades/`, `/es/tipo/*`, `/es/generacion/*`, `/es/` | | | `class=` 55–65 % | not in scope of this phase's priorities (see debt) |

Top 10 byte sources (BEFORE):

1. `/objetos/` Tailwind `class=` lists — 2 768 111 B per page
2. `/objetos/` identical fallback `<svg>` per card — 613 636 B
3. `/objetos/` per-card `data-*` (URLs, defaults) — 551 439 B
4. Pokémon `moves-data` JSON — 405 678 B (feraligatr) … 509 169 B (charizard)
5. `/movimientos/` `class=` lists — 756 051 B
6. `/movimientos/` per-row `data-*` URLs — 437 313 B
7. `/objetos/` sprite `src`/`alt` — 252 406 B (kept: it *is* the content)
8. `/objetos/` inline `onerror` handlers — 191 092 B
9. `/objetos/` inline `style=` — 157 762 B
10. **Network, not HTML:** learned-by / held-by cards fetch full `pokemon/{id}` objects (≈300 KB each, ~250 KB of which is `moves`) → 12 MB / 41 requests for `/movimientos/surf/`

### 3.3 Fetch map BEFORE (cold isolate, real upstream)

`req` = upstream requests · `p/s/m/w` = PokeAPI/Showdown/Smogon/WikiDex · `MB` = downloaded ·
`waves` = sequential dependency depth (fetches that could not start until an earlier one finished)

| Route | req | p/s/m/w | MB | waves |
|---|---:|---|---:|---:|
| `/es/objetos/` | 2 | 2/0/0/0 | 0.15 | 2 |
| `/es/movimientos/` | 1 | 1/0/0/0 | 0.06 | 1 |
| `/es/habilidades/` | 1 | 1/0/0/0 | 0.03 | 1 |
| `/es/` | 2 | 1/1/0/0 | 0.55 | 2 |
| `/es/tipo/water/` | 12 | 11/1/0/0 | 0.81 | 3 |
| `/es/generacion/1/` | 2 | 1/1/0/0 | 0.55 | 2 |
| pokemon feraligatr | 11 | 9/1/1/0 | 1.52 | 7 |
| pokemon garchomp | 21 | 19/1/1/0 | 1.70 | 8 |
| pokemon pikachu | 28 | 26/1/1/0 | 2.35 | 8 |
| pokemon charizard | 13 | 11/1/1/0 | 1.88 | 7 |
| pokemon sneasler | 13 | 11/1/1/0 | 0.84 | 8 |
| pokemon ursaluna-bloodmoon | 17 | 14/1/1/1 | 0.91 | 10 |
| move surf / earthquake / protect / brutal-swing | 41 | 41/0/0/0 | 11.4–12.8 | 2 |
| item leftovers | 3 | 3/0/0/0 | 0.67 | 2 |
| item tm26 (item + machine + move) | 3 | 3/0/0/0 | 0.07 | 3 |
| item water-tera-shard / dynamax-crystal-and15 | 1 | 1/0/0/0 | 0.00 | 1 |
| item oran-berry (held-by 15) | 16 | 16/0/0/0 | 4.06 | 2 |
| ability minds-eye | 2 | 2/0/0/0 | 0.04 | 2 |
| ability levitate | 41 | 41/0/0/0 | 7.57 | 2 |
| `/sitemap.xml` | 5 | 5/0/0/0 | 0.23–0.32 | 2 |

Findings from the Pokémon fetch map (feraligatr, cold): the critical path was
`pokemon → species → Showdown (0.72 s) → ability catalog → Smogon → [evolution ‖
abilities ‖ forms] → prev/next (2 × ~280 KB) → ES names` — **7–10 sequential
waves** for data that is mostly independent. Also: the evolution chain and the
item/location names inside it were **bare, uncached, untimed** `fetch()` calls
(1–3 extra requests on *every* render, even warm; concurrent duplicates:
`item/83` twice on pikachu); WikiDex had no timeout.

### 3.4 Catalogs

| Catalog | API `count` | loaded BEFORE | mechanism | headroom |
|---|---:|---:|---|---|
| items | 2223 | 2223 (2222 after `isRealItem`/dedupe) | Phase 4: `?limit=1` + `?limit=count` | none needed |
| moves | 937 | 937 | `?limit=1000` (hard-coded) | 63 entries |
| abilities | 374 | 374 | `?limit=500` (hard-coded) | 126 entries |
| pokemon-species (sitemap) | 1025 | 1025 | `?limit=1025` (hard-coded == current count: one new species would be dropped from the sitemap) | **0** |
| species ids/names, suggestions | 1025 | 1025 | `?limit=2000` | ok today |
| forms (`pokemon` ≥ 10000) | 1351 total | 326 | `?limit=1000&offset=1025` | ok today |

Same latent truncation bug the items catalog had in Phase 4 (`?limit=2000` →
2000 of 2223), still present in four more places.

### 3.5 Timeouts BEFORE

PokeAPI 8 s (central, `fetchWithCache`) · Showdown pokedex 5 s · Smogon sets 8 s ·
**evolution chain: none** · **evolution item/location names: none** · **WikiDex:
none**. Client side: 5–8 s (unchanged).

---

## 4. Hypotheses and verdicts

| # | Hypothesis | Verdict (from data) |
|---|---|---|
| H1 | `/objetos/` weight is per-card markup repetition, not data | **Confirmed**: class lists 49 %, svg 11 %, data-* 10 %, onerror 3 %, style 3 % of 5.6 MB; the content (names+hrefs+sprites) is ≈0.4 MB |
| H2 | Pokémon pages are dominated by a duplicated client dataset | **Confirmed**: 64–79 % of feraligatr/garchomp/charizard, but only 12–22 % of sneasler/ursaluna |
| H3 | The main *runtime* cost is not where the brief assumed (HTML size) but the card fan-out and the serial Pokémon fetch chain | **Confirmed**: 41 requests / 12 MB per move page; 7–10 waves per Pokémon page |
| H4 | Showdown's dataset is downloaded repeatedly | **Partly**: once per isolate server-side (24 h memory cache, OK), but it is the slowest call (≈0.72 s cold) and sits on the critical path; and **each browser** downloads it again (524 KB) on every page with `PokemonCard` |
| H5 | Cross-request cache "because it sounds good" | **Not supported for PokeAPI** (15–50 ms per request, already CDN-fast). **Supported for the two static datasets** (Showdown 0.7 s) |
| H6 | Page-level HTML edge caching would help crawl efficiency | **Rejected** (§6) |
| H7 | Smogon enrichment is expensive | **Refuted**: 55 KB, 0.01–0.3 s, was blocking only because it was sequential after Showdown |
| H8 | Class repetition inside the Pokémon `MovesTable` rows is worth a rewrite | **Rejected** (§6): ≈10 % of the page for a change that touches both the SSR and the client row template |

---

## 5. Implemented changes

Logical commits (`git log origin/develop..HEAD`); the docs commit is last.

1. **`fix(data): make PokeAPI catalog pagination generic`**
   One helper, `getCompleteResourceList(resource)`, now feeds items, moves,
   abilities, species (sitemap, canonical slugs, suggestions) and forms. One
   request asks for everything (`?limit=100000`), the response's own `count` is
   the contract, `next` completes a capped page, an incomplete or `count`-less
   response throws `UpstreamError` (→ 503), and duplicates are removed by name
   (`roseli-berry` and any future one). This also **removes the head request**:
   items 2 → 1 request, sitemap 5 → 4.
2. **`feat(data): harden upstream fetching`**
   `services/upstream.ts` (per-provider timeouts + one structured log format);
   in `fetchWithCache`: in-flight de-duplication, one bounded retry, stale-on-error,
   LRU bound (400 entries), variant/transform projections; evolution chain and
   WikiDex moved onto the timed path; Showdown/Smogon datasets: validated
   memory + Cache API layers; per-503/500 `page_error` log line in the middleware.
3. **`perf(ssr): reduce duplicated movement payloads in the Pokémon MovesTable`**
   Only `(move, level, method)` per version group is serialized (compact indices
   + labels only for methods/versions that appear), in a `<script type="application/json">`
   (no `&quot;` escaping). Names/URLs/labels are rebuilt by the *same*
   `expandMoves()` the server uses for its SSR rows, so they cannot drift. SSR
   rows and canonical `<a href>` are unchanged.
4. **`perf(items): reduce object and move index HTML overhead`**
   Card/row styling moved to one stylesheet (`@apply` of the *same* utilities;
   dark/hover/group-hover variants verified in the compiled CSS and visually),
   fallback icon via one delegated `error` handler + CSS mask, URLs derived from
   the slug, default attributes dropped. All 2222 / 937 real anchors kept.
5. **`perf(data): deduplicate upstream requests and stop fetching full Pokémon for cards`**
   `getPokemonCards` (see §7 for the policy that measurement forced), prev/next
   from the species list (name+id, one cached request shared site-wide) instead of two
   full `pokemon/{id}`, alternate forms cached as summaries, and the Pokémon page
   restructured so Showdown / ability catalog / evolution / forms / species list
   start as soon as their inputs exist (7–10 waves → 2–4). `EvolutionChain`
   names go through the cached, timed, de-duplicated fetch.
6. **`fix(seo): never serve a partial sitemap as 200`** (§8).
7. **`perf(data): use the pokedex for cards only when it is already cached`**
   (the correction, see below).
8. **`perf(ssr): server-render tier badges when the pokedex is already known`**
   No 524 KB browser download for a badge when the server already had the data;
   also fixes `[^a-z0-0]` (stripped digits: `porygon2` never matched its tier).
9. **`test(reliability): cover upstream failure semantics end to end`**
10. **`fix(types)`**: `astro check` clean (0 errors).

### What measurement corrected

*First version of the card change* always used Showdown's pokedex (0 requests for
40 cards). Cold, that made move/item/ability pages **slower** (move page ≈190 ms →
≈900 ms; `minds-eye` even fetched 524 KB to save two requests) because Showdown's
0.7 s beats no one against a 40-way PokeAPI fan-out that completes in ≈0.2 s.
Fixed by policy: cards read the pokedex **only if it is already in memory or in
the edge cache** (`getCachedSmogonDataBatch`), never start that download. A cold
isolate now behaves exactly as before; a warm one needs 0 `pokemon/{id}`
requests. (Local simulation of an edge-cache hit: first request of a fresh
isolate 0.86 s → 0.48 s for a Pokémon page.)

---

## 6. Rejected / deferred, and why

| Change | Why not |
|---|---|
| **HTML edge caching of entity pages** | Cloudflare doesn't cache Worker output by itself; it would need `caches.default` in middleware, cannot be verified locally, and the crawl is long-tail (8436 URLs, mostly one hit each) so the hit rate would be low. The real risk is caching a *degraded 200* (Smogon down) for a day. Dataset-level caching gives the shared win without that risk. Left with no `Cache-Control`, as before |
| Cache API for PokeAPI | PokeAPI is already CDN-fast (15–50 ms) — nothing to win |
| Redis / KV / DB / VPS | Out of scope by instruction; not needed |
| Paginating/“load more” on `/objetos/`, `/movimientos/` | Would drop entities from the crawlable graph |
| Client-only lists, removing anchors, `noindex` for weight | Explicitly forbidden |
| Compact `MovesTable` **row** classes | ≈10 % of the page; touches SSR + client templates; not "blind CSS optimization" |
| Always-on pokedex for cards | Measured slower cold (see above) |
| Dropping alternate-form fetches (use `species.varieties` + id artwork) | Some forms have no official artwork; would need per-image fallbacks. Kept, cached as summaries |
| Sprite-existence filtering on `/objetos/` | Sample of 80 item sprite URLs: **44 return 404** (TMs, candies, dynamax crystals, herba mystica). Needs a generated manifest (extend `scripts/item-seo-manifest.ts`); a name-pattern heuristic would be incomplete. Debt |
| Retry on 429 / timeouts | Would multiply rate-limit pressure / block for 16 s |
| Page-level `stale-while-revalidate` on HTML | Same as edge caching |

---

## 7. AFTER

### 7.1 HTML

| Page | raw BEFORE | raw AFTER | Δ | gzip B→A | brotli B→A | `<a>` B→A |
|---|---:|---:|---:|---|---|---|
| `/es/objetos/` | 5 608 043 | **960 033** | **−83 %** | 119 162 → 63 739 | 79 187 → 52 866 | 2238 → 2238 |
| `/en/objetos/` | 5 607 829 | 959 819 | −83 % | 118 983 → 63 571 | 78 906 → 52 648 | 2238 → 2238 |
| `/es/movimientos/` | 1 378 599 | **297 000** | **−78 %** | 52 922 → 24 816 | 40 364 → 22 735 | 953 → 953 |
| `/en/movimientos/` | 1 378 451 | 296 852 | −78 % | 52 834 → 24 743 | 40 273 → 22 696 | 953 → 953 |
| pokemon feraligatr | 549 650 | 150 712 | −73 % | 34 412 → 23 921 | 28 555 → 21 595 | 80 → 80 |
| pokemon garchomp | 454 896 | 165 342 | −64 % | 31 505 → 24 030 | 26 776 → 21 623 | 94 → 94 |
| pokemon pikachu | 521 621 | 140 062 | −73 % | 34 514 → 24 150 | 28 575 → 21 888 | 77 → 77 |
| pokemon charizard | 641 071 | 143 615 | −78 % | 38 292 → 24 301 | 30 324 → 22 082 | 72 → 72 |
| pokemon sneasler | 224 108 | 167 833 | −25 % | 24 993 → 22 993 | 21 854 → 20 370 | 105 → 105 |
| pokemon ursaluna-bloodmoon | 216 153 | 178 385 | −17 % | 25 102 → 23 366 | 22 009 → 20 768 | 112 → 112 |
| move surf | 227 058 | 232 676 | +2 % | ≈ same | ≈ same | 61 → 61 |
| item leftovers / tm26 / water-tera-shard / dynamax… | 40 017 / 27 916 / 27 550 / 27 320 | 40 293 / 27 916 / 27 550 / 27 320 | 0–1 % | | | 22/21/21/20 unchanged |
| item oran-berry | 103 416 | 105 509 | +2 % | | | 35 → 35 |
| ability levitate / minds-eye | 227 137 / 32 234 | 232 714 / 32 363 | +2 % / 0 % | | | 60 / 21 unchanged |
| `/es/habilidades/`, `/es/`, tipo, generación | unchanged | unchanged | 0 | | | unchanged |

The card pages grow ≈2 % on purpose: the server now renders the tier badge
when it has the data (§5.8) instead of making every browser download 524 KB.

Payload of the Pokémon `MovesTable` dataset (`moves-data`):

| Page | JSON BEFORE | JSON AFTER | visible tbody B→A | rows |
|---|---:|---:|---|---|
| feraligatr | 405 678 | 13 902 | 61 920 → 54 735 | 48 → 48 |
| garchomp | 290 697 | 10 129 | 77 727 → 68 718 | 60 → 60 |
| pikachu | 390 743 | 13 625 | 38 970 → 34 506 | 30 → 30 |
| charizard | 509 169 | 17 193 | 47 992 → 42 489 | 37 → 37 |
| sneasler | 48 260 | 2 800 | 94 391 → 83 558 | 72 → 72 |
| ursaluna-bloodmoon | 28 010 | 2 253 | 104 879 → 92 850 | 80 → 80 |

Client JS: `MovesTable` 5 466 → 5 796 B (+330 B: `expandMoves`), `/objetos/` script
5 411 → 5 027 B, `/movimientos/` script 4 567 → 4 829 B (+262 B). Per-page CSS added:
+9.2 KB (`/objetos/`) and +6.1 KB (`/movimientos/`), cacheable, in exchange for −4.6 MB / −1.1 MB of HTML.
Net JS ≈ +200 B, justified by −400 KB on Pokémon pages.

### 7.2 Fetch map AFTER (cold isolate; "warm pokedex" = pokedex already cached in the isolate)

| Route | req B → A | MB B → A | waves B → A | cold ms (medians, 2 runs) B → A | warm ms B → A |
|---|---|---|---|---|---|
| `/es/objetos/` | 2 → **1** | 0.15 → 0.15 | 2 → 1 | 111 / 73 → 41 / 44 | 34 → 16 |
| `/es/movimientos/` | 1 → 1 | 0.06 | 1 | 56 / 39 → 31 / 27 | 14 → 6 |
| `/es/` | 2 → 2 | 0.55 | 2 | 793 / 779 → 771 / 844 | 8 → 7 |
| `/es/tipo/water/` | 12 → 12 | 0.81 | 3 | 912 / 861 → 837 / 857 | 9 → 10 |
| `/es/generacion/1/` | 2 → 2 | 0.55 | 2 | 798 / 773 → 782 / 776 | 7 → 8 |
| pokemon feraligatr | 11 → 10 | 1.52 → 1.09 | **7 → 2** | 992 / 936 → **770 / 773** ✔ | 32 → **7** ✔ |
| pokemon garchomp | 21 → 20 | 1.70 → 1.37 | **8 → 3** | 1096 / 931 → **790 / 827** ✔ | 30 → **7** ✔ |
| pokemon pikachu | 28 → 26 | 2.35 → 1.84 | **8 → 3** | 1090 / 945 → **782 / 776** ✔ | 60 → **6** ✔ |
| pokemon charizard | 13 → 12 | 1.88 → 1.37 | **7 → 2** | 970 / 861 → **772 / 778** ✔ | 31 → **6** ✔ |
| pokemon sneasler | 13 → 11 | 0.84 → 0.81 | **8 → 3** | 1066 / 866 → **781 / 787** ✔ | 55 → **6** ✔ |
| pokemon ursaluna-bloodmoon | 17 → 16 | 0.91 → 0.90 | **10 → 4** | 1246 / 1020 → **784 / 828** ✔ | 54 → **6** ✔ |
| move surf | 41 → 41 **(cold)** / **2 (warm pokedex)** | 11.97 → 11.97 / **0.12** | 2 → 2 | 189 / 77 → 86 / 172 (noise) / 53 (warm pokedex) | 3 → 2 |
| item oran-berry | 16 → 16 / **2 (warm)** | 4.06 → 4.06 / **0.11** | 2 → 2 | 165 / 53 → 51 / 50 / 48 | 2 → 2 |
| ability levitate | 41 → 41 / **2 (warm)** | 7.57 → 7.57 / **0.10** | 2 → 2 | 161 / 67 → 66 / 88 / 49 | 3 → 2 |
| item tm26 | 3 → 3 | 0.07 | 3 → 3 | 178 / 51 → 49 / 50 | 3 → 1 |
| `/sitemap.xml` | 5 → **4** | 0.23–0.32 → 0.23 | 2 → 2 | ≈70 → ≈70 (same, network-bound) | ≈29 → ≈30 |

Warm-instance latency (wrangler, 9 requests median, TTFB): Pokémon pages
**31–44 ms → 3 ms** (the uncached bare fetches are gone), `/es/objetos/`
348 → 218 ms total, `/es/movimientos/` 207 → 62 ms total.

No route makes more upstream requests than before.

### 7.3 Item sample

| Item | requests | notes |
|---|---|---|
| tm26 | item + machine + move = **3** (unchanged) | confirmed real numbers; machine → latest version group |
| oran-berry | item + 15 held-by = 16 → 16 cold / 2 warm | held-by limit 15, all parallel, all optional |
| leftovers | item + 2 held-by (PokeAPI lists only 2 holders) = 3 cold, 2 warm (item + species list) | |
| water-tera-shard, dynamax-crystal-and15 | 1 | |

`HELD_BY_LIMIT` (15) and the relation are unchanged. The 15 requests were
independent, parallel and optional (not needed for the main HTML), and repeated
across requests only via the isolate cache.

### 7.4 Crawlability and policy (live, wrangler)

* `/es/objetos/`, `/en/objetos/`: **2222** unique entity anchors each.
* `/es/movimientos/`, `/en/movimientos/`: **937** each.
* Pokémon MovesTable SSR anchors (feraligatr 48, garchomp 60, pikachu 30, charizard 37, sneasler 72) — identical to BEFORE, including duplicates.
* Sitemap: **8436** `<loc>`, byte-identical to BEFORE (`cmp`), 1848 item URLs per language.
* Item policy unchanged: `dynamax-crystal-and15` → `noindex,follow`; `leftovers`, `tm26`, `water-tera-shard`, `oran-berry` indexable; canonicals unchanged.
* Status/redirect matrix identical BEFORE vs AFTER for: `/es/pokemon/25/` (301), `/Pikachu/` (301), `basculin-red-striped` (301 → `basculin`), unslashed (301), unknown Pokémon/item/move/ability/type (404), `/xx/` (404), `/es/objetos/211/` (301), `/es/movimientos/57/` (301), sitemap (200 + same Cache-Control).

---

## 8. Reliability

### Error semantics (unchanged, now proven end to end)

| Situation | Answer |
|---|---|
| primary entity does not exist (`EntityNotFoundError`) | 404 |
| required dependency missing / upstream timeout / network / 5xx / 429 / non-JSON | 503 + `Retry-After: 60` + `Cache-Control: no-store` |
| optional enrichment fails | 200 degraded |
| unexpected error | 500 |

`upstream-faults.ssr.test.ts`: 6 fault kinds × (3 required roles + 7 optional
roles + learned-by + all-optional-down) = 77 tests, plus 404s and retry cases.
Result: **no 200 with missing required data** in any combination.

### Sitemap (a real bug found while measuring)

`safeList` swallowed a failing family and answered **200** with the rest,
cached 24 h through `s-maxage`. One PokeAPI blip would have told crawlers all
moves (or abilities, or items) were gone. Now every family is required: failure →
503/`Retry-After`/`no-store`. URL set unchanged (8436). Cost: 4 requests.

### Retries

At most **one** retry, only for a fast transient fault (network error, HTTP 5xx),
250 ms apart, inside the same 8 s overall deadline. Never for: timeout (already
spent its budget), 429 (would multiply rate limits), 404/400, invalid JSON.
BEFORE: none. There was no measured failure rate to justify more; this is a
defensive minimum, and `upstream_retry` log lines will show whether it fires.

### Timeouts (centralized in `services/upstream.ts`)

| Provider | BEFORE | AFTER | Reason |
|---|---|---|---|
| PokeAPI (required) | 8 s | 8 s | healthy 15–800 ms measured; ≈10× worst observed |
| Showdown pokedex | 5 s | 5 s | 524 KB in 0.7–0.8 s |
| Smogon sets | 8 s | **5 s** | 55 KB in ≤0.3 s; optional data shouldn't outwait required data |
| Evolution chain | none | 8 s (PokeAPI path) | |
| Evolution item/location names | none | 8 s, cached, de-duplicated | |
| WikiDex | none | **3 s** | optional fallback text |

### 5xx risk by route (dependencies and Workers limits)

Highest historical 5xx exposure = most upstream dependencies **in series** and most
subrequests. Cloudflare Workers caps subrequests per request (50 on the Free plan,
1000 on paid — plan not verified): BEFORE, move/ability pages used 41 (9 below the
Free cap, with retries/duplicates it could cross it), Pokémon pages up to 28; and
every cached `pokemon/{id}` kept ~300 KB parsed in isolate memory with **no size
bound** (128 MB isolate limit).

| Route | required deps | subrequests B → A | series waves B → A |
|---|---|---|---|
| pokemon | 2 (pokemon, species) in series | 11–28 → 10–26 | 7–10 → 2–4 |
| move / ability | 1 | 41 → 41 cold, 2–3 warm | 2 → 2 |
| item | 1 | 1–16 → same cold, 3 warm | |
| tipo | 2 in parallel (+9 optional generation calls) | 12 → 12 | 3 → 3 |
| sitemap | 4 in parallel | 5 → 4 | |

Not reproduced live: an actual 503 through wrangler (would need PokeAPI failing).
Covered by the container-based fault matrix and the middleware tests.

### Observability

Failures now log one JSON line each: `upstream_error | upstream_retry | upstream_slow (>2 s) | upstream_stale`
with `provider, resource, status, ms, error, attempt` (URL path only, no query, no PII),
and every 503/500 page logs `page_error` with `path, error, status, message` (the message names the
failing endpoint). Successful requests are not logged; routine 404s are not logged.

---

## 9. Cache and reliability policy

| Layer | What | Key | TTL | Invalidation | On error | Never |
|---|---|---|---|---|---|---|
| PokeAPI, memory (per isolate) | any successful 2xx JSON GET, or a *projection* (`#summary`) of a large one | exact URL (+ `#variant`); no language, no entity mixing | 24 h | TTL/LRU (400 entries) / isolate recycle | previous **valid** copy for the same URL up to 7 days, refreshed after 60 s; **only** for `UpstreamError` (never 404); none stored → error propagates → 503 | 404, 429, 5xx, timeouts, invalid JSON, partial catalogs |
| In-flight | concurrent identical requests | URL (+ entity-lookup flag, so a primary lookup never inherits a secondary one's error class) | request lifetime | — | shared failure, not remembered | |
| Showdown pokedex, Smogon sets: memory | parsed, validated dataset | dataset URL | 24 h | | last valid copy | |
| same: Cloudflare Cache API (`caches.default`, where present) | validated dataset body | dataset URL | fresh 6 h, kept 7 d as stale fallback | overwritten on refresh | stale edge copy served if Showdown/Smogon fail | unparseable/empty/`{"error":…}` bodies, non-200 |
| HTML | **nothing cached** | — | — | — | — | (see §6) |

Languages: nothing is keyed by language. Redirects/404/503/500 are never stored.
`noindex` state is decided at render time from the item manifest, never cached.

HTML headers audit (wrangler): 200/301/404 carry no `Cache-Control` (as before);
`/sitemap.xml` `public, s-maxage=86400, stale-while-revalidate=3600` (as before);
503 `Retry-After: 60` + `no-store`. No header changed.

Cloudflare preview differences observed: none in status/redirect semantics.
The Cache API works in local workerd and persists across worker restarts (used to
verify the edge-cache path: 1.06 s → 0.22 s for a cold isolate on `/es/movimientos/surf/`
when the pokedex was in the cache), but **production hit rates and behavior on the
`pages.dev` hostname are unverified**; the layer is designed to be a no-op when absent.

---

## 10. Risks

1. **Edge cache is unverified in production.** Contained: datasets only, validated before write, silent no-op if unavailable.
2. **Stale-on-error can serve data up to 7 days old** when PokeAPI is down. Acceptable for near-static game data; logged as `upstream_stale`.
3. **Cold isolates gained no latency on card pages** (by design after the correction); the win exists only when the pokedex is already cached (memory or edge).
4. **Global stylesheet classes** (`.item-card`, `.move-row`, `.oi-*`, `.mi-*`) are unlayered CSS and beat utility classes on those elements; priority colouring therefore uses a `data-p` attribute. Anyone toggling utilities on those elements from JS will hit it.
5. Local wrangler ≠ Cloudflare edge; latency numbers are relative only, and PokeAPI latency drifted ~2× between runs.
6. The item `alt` remains the slug (unchanged): 2222 alt texts that read as slugs.

---

## 11. Future debt

* `/habilidades/` (517 KB), `/es/` (530 KB), `/tipo/*` (472 KB), `/generacion/*` (454 KB): 55–65 % `class=` — same technique as `/objetos/`.
* `PokemonCard` weighs ≈5 KB per card (move/ability/item pages: 30–40 cards ≈ 200 KB).
* Item sprite manifest (≈55 % of `/objetos/` sprite URLs 404 in a sample of 80).
* `MovesTable` client still fetches every move's full PokeAPI JSON in the browser (category/priority/effect) — ~40–100 requests per version switch; a compact server-side or static projection would remove it.
* `CompetitiveSets` client re-fetches ability details the server already loaded.
* `getPokemonByName` mutates the cached species/move objects when applying `SPANISH_PATCHES` (`unshift` per request); harmless but grows.
* Per-request `getLocalizedNames` downloads full move/item JSON (~47 KB each, ≈20 per Spanish page with sets) only for the Spanish name.
* `tipo/*` fetches 9 `generation/{n}` per render for the by-generation breakdown.
* `Astro.locals.cacheControl` in `Layout.astro` is dead code.

---

## 12. Search Console plan (nothing done in this phase)

The manual inspection quota is the constraint. Suggested order once this ships:

1. **Sitemap** — resubmit `/sitemap.xml` (content byte-identical, so no URL churn expected); confirm 8436 discovered.
2. **Spot-inspect 4 templates**, not 4 URLs: `/es/objetos/` (was 5.6 MB — check "Page fetch" shows no size warning and 2222 links discovered), `/es/movimientos/`, one heavy Pokémon (`/es/pokemon/charizard/`), one item (`/es/objetos/leftovers/`).
3. **Watch Crawl stats** (Settings → Crawl stats): average response time and "host status"; expect lower average response size and no 5xx growth.
4. **Pages report → Server error (5xx)**: the historical ~35. With `page_error` logs, any remaining ones can be attributed to an endpoint.
5. Do **not** request indexing for the 374 noindex item pages, and don't touch the Phase 4 policy.

---

## Appendix: reproducing

```
npm run build && npx wrangler pages dev dist --port 4331 --compatibility-date=2025-01-01 --compatibility-flag=nodejs_compat
curl -s -H 'Accept-Encoding: identity' -o /dev/null -w '%{size_download}\n' localhost:4331/es/objetos/
```

BEFORE: `git worktree add --detach /tmp/before 8d6cea2`, build, serve on another port.
Fetch maps: an instrumented `fetch` around `AstroContainer` renders with `vi.resetModules()` between cold runs.
