# Open Graph / Social Cards

Internal technical reference for how Pokepedia generates its Open Graph and
Twitter Card social preview images. Written from the implementation in
`feature/open-graph-cards`. If this file and the code disagree, the code is
right.

## Architecture

Dynamic Satori + resvg-wasm rendering, on a request-time Astro API route,
cached at Cloudflare's edge via the Cache API. Not build-time PNG
generation — the site has ~1025 Pokémon + 18 types + 9 generations in scope
(and thousands more pages outside this sprint's scope), and pre-generating
that many binaries would bloat the repo/deploy bundle permanently and need a
rebuild for every data change. A dynamic route renders once per unique URL
and then lives entirely at the edge — same latency after the first hit,
zero repo bloat.

## Route structure

```
/og/{es|en}/default.png/
/og/{es|en}/pokemon/{name}.png/
/og/{es|en}/type/{typeSlug}.png/
/og/{es|en}/generation/{1-9}.png/
```

Trailing slash included deliberately — the site's global `trailingSlash:
'always'` (astro.config.mjs) applies to Astro endpoint routes exactly like
page routes; a URL without it 404s. Files:

```
src/pages/og/[lang]/default.png.ts
src/pages/og/[lang]/pokemon/[name].png.ts
src/pages/og/[lang]/type/[type].png.ts
src/pages/og/[lang]/generation/[gen].png.ts
```

Every slug is validated against internal data before rendering — `lang`
against `isSupportedLang` (es/en only), `type` against `typeColors`' keys,
`gen` against `1-9`, `name` against `getPokemonByName` (throws
`PokemonNotFoundError` on a miss). No arbitrary input reaches the renderer;
an invalid slug is a 404 (`ogNotFound()`), never a 500 — see
`src/utils/og/http.ts`.

## Rendering pipeline (`src/utils/og/`)

- `render.ts` — `satori(tree, {width, height, fonts}) -> SVG`, then
  `Resvg(svg).render().asPng() -> Uint8Array`.
- `elements.ts` — a tiny `h(type, style, ...children)` hyperscript helper.
  No React/JSX: Satori's element format (`{type, props: {style, children}}`)
  doesn't need it, and adding a JSX toolchain for four templates wasn't
  worth it.
- `components.ts` — shared visual primitives (`Frame`, `PokeCoreMark`,
  `Wordmark`, `Chip`, `TypePill`) reusing Pokepedia's existing slate/emerald
  identity (see `Layout.astro`'s header) — not a reskinned PokeTypes
  template.
- `templates/{default,pokemon,type,generation}.ts` — one builder function
  per card family, returning a Satori element tree.
- `fonts.ts` — loads Inter (see [Fonts](#fonts)).
- `artwork.ts` — fetches official artwork and inlines it as a `data:` URI
  (see [Artwork](#artwork)).
- `theme.ts` — shared color/size constants.
- `http.ts` — `cacheableImageResponse()` (edge cache read-through +
  PNG response) and `ogNotFound()`.

## ES/EN

Card copy uses this repo's existing translation data — `typeTranslations`,
`typeColors`, `GENERATIONS`, `GENERATION_ROMAN` (`src/services/pokeapi.ts`,
`src/utils/pokemon.ts`) — never a new/duplicate dictionary. The Pokémon
card's forme-suffix logic (`Charizard (Mega X)`) intentionally mirrors the
inline logic in `src/pages/[lang]/pokemon/[name].astro` rather than
importing it, because that logic isn't exported from the page and Pokémon
page logic was out of scope for this sprint — see the comment in
`src/pages/og/[lang]/pokemon/[name].png.ts`.

Counts (`70 Pokémon`, `151 Pokémon`) come from the same functions the
landing pages already use (`getPokemonByType`, `getPokemonByGeneration`) —
never hardcoded, never a second counting method that could drift.

## Fallback

- **Invalid slug/lang** → 404 (`ogNotFound()`), not 500.
- **Artwork upstream (raw.githubusercontent.com) fails or times out**
  (4s timeout) → `fetchArtworkDataUri()` returns `null`, and the Pokémon
  template falls back to a locally-drawn `PokeCoreMark` (the same mark used
  in the site header) instead of the artwork — the card still renders and
  returns 200.
- **Render pipeline itself throws** (e.g. a transient PokeAPI outage on an
  otherwise-valid slug) → `cacheableImageResponse()` catches it and returns
  404 rather than 500.

## Artwork

Official artwork is fetched from PokeAPI's sprite mirror
(`raw.githubusercontent.com/PokeAPI/sprites`) as a render **input**,
base64-inlined into the Satori tree via a `data:` URI. It is never the
final `og:image` — that's always a `pokepedia.app/og/...` URL. Confirmed
live (SSR QA): no page's `og:image`/`twitter:image` points at
raw.githubusercontent.com.

## Fonts

Inter, static TTF instances (Regular/Medium/Bold/Black), sourced from the
official [rsms/inter](https://github.com/rsms/inter) v4.1 GitHub release —
SIL Open Font License 1.1 (`public/fonts/og/LICENSE.txt`). Not Google
Fonts: Satori needs font data as a raw `ArrayBuffer` (TTF/OTF — no WOFF2,
no system fonts), so the files are bundled as static assets and fetched
from the request's own origin at render time (`fonts.ts`), with the
`ArrayBuffer`s cached in module scope for the isolate's lifetime.

## Cache

`Cache-Control: public, max-age=86400, s-maxage=31536000, immutable` on
every successful response — but on Cloudflare, a **Worker-handled** route
(unlike a Pages static asset) is not auto-cached at the edge just because
it carries that header. `cacheableImageResponse()` explicitly reads/writes
`caches.default` (the Workers Cache API) before falling back to rendering,
keyed by the full request URL. Under plain `astro dev` (Node), there's no
global `caches` — every request just renders fresh, which is fine for local
work. Measured on the real Wrangler runtime: cold render ~400-600ms
(includes font + artwork fetch), Cache-API hit ~1-2ms.

## Cloudflare Workers compatibility — the two real gotchas

Both of these fail silently under plain `astro dev` (Node has no
restriction here) and only surface under the real Workers runtime — this is
why `npm run dev` alone is not sufficient QA for this feature; use
`npm run build && npx wrangler pages dev dist --compatibility-flags=nodejs_compat`.

1. **Sharp is not usable at runtime on Cloudflare** (confirmed by the
   adapter's own dev-server warning). Never a candidate here — this is why
   the pipeline is Satori + resvg-wasm, not Satori + sharp.

2. **A Worker can only load WASM that was compiled ahead-of-time via a
   static `import ... from '*.wasm?module'`** (resolved by
   `@astrojs/cloudflare`'s built-in module loader, `cloudflareModules: true`
   by default — no config needed). Any *runtime* `WebAssembly.compile`/
   `instantiate(bytes)`/`new WebAssembly.Module(bytes)` throws `"Wasm code
   generation disallowed by embedder"`.
   - `@resvg/resvg-wasm` exposes `initWasm(module)` for this — see
     `resvg-wasm-module.ts` + `render.ts`.
   - `satori`'s `yoga-layout` dependency does **not** expose an override
     hook and unconditionally does a bytes-based `WebAssembly.instantiate`
     of its own embedded wasm the moment it's imported. Fixed two ways:
     - **Downgraded `satori` from `0.33.4` to `0.32.0`** (`--save-exact`).
       `harfbuzzjs` (used for complex-script text shaping — Arabic, CJK
       ligatures) became a satori dependency in exactly `0.33.0` and has
       the *same* unfixable eager-wasm problem with no override hook at
       all. Pokepedia's card text is Spanish/English only, so harfbuzz's
       capability isn't needed — 0.32.0 doesn't depend on it. Verified live
       via `npm view satori@<version> dependencies` across the version
       range before picking the cutoff.
     - **`wasm-workers-patch.ts`** globally patches `WebAssembly.instantiate`
       (installed at the top of `render.ts`, before satori is imported) so
       that any bytes-based call resolves against `yoga-wasm-module.ts`'s
       precompiled module instead of actually compiling the given bytes —
       the Emscripten glue code only cares about getting back a
       `{module, instance}` shape. Scoped: only requests that hit an OG
       route import `render.ts`, so this patch is never installed for
       ordinary page routes in the same isolate.

If `satori` is ever upgraded past `0.33.x` again, re-check whether
`harfbuzzjs` still has no Workers-compatible override — if it doesn't, this
whole approach needs revisiting (or harfbuzz needs the same
precompiled-module patch treatment as yoga).

## Tests

- `src/pages/og/og-endpoints.test.ts` — the 4 route handlers end-to-end
  (real Satori + resvg-wasm render, only network mocked): 1200×630
  `image/png` output for valid slugs, artwork-fetch-failure fallback still
  returns 200, invalid slug/lang/type/generation all 404. Fonts are read
  from the real `public/fonts/og/*.ttf` files on disk so the pipeline
  exercises real glyph data. `vitest.config.ts` deliberately doesn't load
  `@astrojs/cloudflare` (avoids a ~10s teardown hang), so the `.wasm?module`
  imports are mocked with an equivalent real `WebAssembly.Module` built via
  Node's own `fs` + `WebAssembly` APIs (see the `vi.mock` calls at the top
  of that file) — the render pipeline is still exercised for real, just via
  a Node-native module load instead of Wrangler's bundler.
- `src/utils/og/http.test.ts` — `cacheableImageResponse` / `ogNotFound`.
- `src/layouts/Layout.ssr.test.ts` — the localized-default-image fallback,
  explicit local `/og/` image props, `og:locale`, canonical/hreflang still
  rendering.
- Additive assertions in the existing `tipo.ssr.test.ts` /
  `generacion.ssr.test.ts` confirming those pages' `og:image` now points at
  the local `/og/.../{slug}.png/` route.

## Local QA

```bash
npm run dev          # fast iteration; NOT sufficient alone (see gotchas above)
npm run build
npx wrangler pages dev dist --compatibility-date=<today> --compatibility-flags=nodejs_compat
curl -sD - -o card.png http://localhost:8788/og/es/pokemon/dragonite.png/
```
