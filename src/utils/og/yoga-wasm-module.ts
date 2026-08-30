// satori's yoga-layout dependency embeds its own copy of yoga.wasm as a
// base64 string and instantiates it dynamically at module-init time, with
// no public hook to supply a precompiled module instead (see
// yoga-layout/src/load.ts — loadYoga() takes no arguments). satori itself
// ships the same binary as a package subpath specifically so consumers can
// load it another way — that's what we import here, precompiled via the
// same `?module` mechanism used for resvg (see resvg-wasm-module.ts and
// wasm-workers-patch.ts, which actually wires this into yoga's loader).
// @ts-expect-error - wasm module import, resolved by @astrojs/cloudflare's built-in loader (cloudflareModules, on by default)
import YOGA_WASM from 'satori/yoga.wasm?module';

export default YOGA_WASM;
