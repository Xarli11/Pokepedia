// Isolated in its own module so tests can substitute an equivalent
// WebAssembly.Module (built from the same .wasm file via Node's own fs +
// WebAssembly APIs) without needing @astrojs/cloudflare's Vite plugin —
// vitest.config.ts deliberately doesn't load the Cloudflare adapter (see
// its comments: it avoids a ~10s KV/platform-proxy teardown hang).
// @ts-expect-error - wasm module import, resolved by @astrojs/cloudflare's built-in loader (cloudflareModules, on by default)
import RESVG_WASM from '@resvg/resvg-wasm/index_bg.wasm?module';

export default RESVG_WASM;
