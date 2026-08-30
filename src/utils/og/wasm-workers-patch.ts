// Cloudflare Workers only allow a WebAssembly module that was compiled
// ahead-of-time via a static `import ... from '*.wasm?module'` (resolved by
// @astrojs/cloudflare's built-in loader at build time) — any runtime
// WebAssembly.compile/instantiate/Module call made *from raw bytes* throws
// "Wasm code generation disallowed by embedder". @resvg/resvg-wasm exposes
// initWasm() to hand it a precompiled module directly (see render.ts), but
// satori's yoga-layout dependency does not: it unconditionally calls
// `WebAssembly.instantiate(bytes, imports)` on its own embedded wasm the
// moment it's imported, with no override hook.
//
// This module patches that one global entry point so the bytes-based call
// resolves using yoga.wasm precompiled via the same static-import mechanism
// (see yoga-wasm-module.ts) instead of actually compiling the given bytes —
// the emscripten-generated glue code only cares about getting back a
// `{module, instance}` shape it can call into, not that the module was
// compiled from the exact bytes it passed in.
//
// Scope: only the OG render pipeline imports this (via render.ts), so the
// patch is only installed in isolates that have actually served an OG
// image request — it never runs for ordinary page routes. It must be
// imported before `satori`, since satori/yoga-layout trigger their wasm
// load as a side effect at module-evaluation time.
import YOGA_WASM_MODULE from './yoga-wasm-module';

const nativeInstantiate = WebAssembly.instantiate.bind(WebAssembly);

let patched = false;

export function installWorkersWasmPatch(): void {
	if (patched) return;
	patched = true;

	// @ts-expect-error - narrowing the full overloaded signature isn't worth it for a one-shot compatibility shim
	WebAssembly.instantiate = async (source: BufferSource | WebAssembly.Module, importObject?: WebAssembly.Imports) => {
		if (source instanceof WebAssembly.Module) {
			return nativeInstantiate(source, importObject);
		}
		const instance = await nativeInstantiate(YOGA_WASM_MODULE, importObject);
		return { module: YOGA_WASM_MODULE, instance };
	};
}
