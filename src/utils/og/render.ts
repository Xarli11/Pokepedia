import { installWorkersWasmPatch } from './wasm-workers-patch';
// Must run before satori/yoga-layout's own module-init side effect tries a
// bytes-based WebAssembly.instantiate — see wasm-workers-patch.ts.
installWorkersWasmPatch();

import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import RESVG_WASM from './resvg-wasm-module';
import type { SatoriFont } from './fonts';
import type { SatoriNode } from './elements';
import { CARD_WIDTH, CARD_HEIGHT } from './theme';

let wasmReady: Promise<void> | null = null;
function ensureResvgWasm(): Promise<void> {
	if (!wasmReady) wasmReady = initWasm(RESVG_WASM);
	return wasmReady;
}

export async function renderCardPng(tree: SatoriNode, fonts: SatoriFont[]): Promise<Uint8Array> {
	const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
		width: CARD_WIDTH,
		height: CARD_HEIGHT,
		fonts,
	});

	await ensureResvgWasm();
	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } });
	const rendered = resvg.render();
	return rendered.asPng();
}
