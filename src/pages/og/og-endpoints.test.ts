import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// vitest.config.ts deliberately doesn't load @astrojs/cloudflare (avoids a
// ~10s KV/platform-proxy teardown hang), so the `.wasm?module` specifier
// that plugin resolves in dev/build isn't available here. Substitute an
// equivalent real WebAssembly.Module built from the same .wasm file via
// Node's own fs + WebAssembly APIs — the render pipeline still exercises
// genuine resvg-wasm rasterization, just via a Node-native module load.
vi.mock('../../utils/og/resvg-wasm-module', () => {
	const wasmPath = fileURLToPath(new URL('../../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url));
	return { default: new WebAssembly.Module(readFileSync(wasmPath)) };
});

// Same reasoning as the resvg mock above — see wasm-workers-patch.ts, which
// this test suite also exercises for real (the patched WebAssembly.instantiate
// stays installed in this Node process, so it must resolve to a real module too).
vi.mock('../../utils/og/yoga-wasm-module', () => {
	const wasmPath = fileURLToPath(new URL('../../../node_modules/satori/yoga.wasm', import.meta.url));
	return { default: new WebAssembly.Module(readFileSync(wasmPath)) };
});

const { GET: defaultGet } = await import('./[lang]/default.png');
const { GET: pokemonGet } = await import('./[lang]/pokemon/[name].png');
const { GET: typeGet } = await import('./[lang]/type/[type].png');
const { GET: generationGet } = await import('./[lang]/generation/[gen].png');

// Full end-to-end coverage of the OG image endpoints (Satori render +
// resvg-wasm rasterization) with only network boundaries mocked — PokeAPI
// data and the upstream artwork mirror — never live network, matching this
// repo's SSR test convention. Fonts are read from the real public/fonts/og/
// files on disk so the render pipeline exercises real glyph data, same as
// production; `fetchWithCache`'s module-level cache means each test that
// hits PokeAPI uses a slug/id not reused by other test files.

const FONTS_DIR = fileURLToPath(new URL('../../../public/fonts/og/', import.meta.url));

function fontArrayBuffer(fileName: string): ArrayBuffer {
	const buf = readFileSync(`${FONTS_DIR}${fileName}`);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

interface MockOptions {
	artworkOk?: boolean;
}

function mockFetch({ artworkOk = true }: MockOptions = {}) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);

			if (url.includes('/fonts/og/Inter-Regular.ttf')) return { ok: true, arrayBuffer: async () => fontArrayBuffer('Inter-Regular.ttf') } as unknown as Response;
			if (url.includes('/fonts/og/Inter-Medium.ttf')) return { ok: true, arrayBuffer: async () => fontArrayBuffer('Inter-Medium.ttf') } as unknown as Response;
			if (url.includes('/fonts/og/Inter-Bold.ttf')) return { ok: true, arrayBuffer: async () => fontArrayBuffer('Inter-Bold.ttf') } as unknown as Response;
			if (url.includes('/fonts/og/Inter-Black.ttf')) return { ok: true, arrayBuffer: async () => fontArrayBuffer('Inter-Black.ttf') } as unknown as Response;

			if (url.includes('raw.githubusercontent.com')) {
				if (!artworkOk) return { ok: false } as Response;
				if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
				// A tiny valid 1x1 PNG is enough to exercise the data-URI path.
				const onePxPng = Buffer.from(
					'89504e470d0a1a0a0000000d49484452000000010000000108020000009077053d0000000a4944415478da6360000002000155a0e3410000000049454e44ae426082',
					'hex'
				);
				return { ok: true, arrayBuffer: async () => onePxPng.buffer.slice(onePxPng.byteOffset, onePxPng.byteOffset + onePxPng.byteLength) } as unknown as Response;
			}

			if (url.includes('/pokemon-species/og-test-mon')) {
				return {
					ok: true,
					json: async () => ({
						name: 'og-test-mon',
						names: [{ language: { name: 'en' }, name: 'OgTestMon' }],
						flavor_text_entries: [],
						evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' },
						varieties: [{ is_default: true, pokemon: { name: 'og-test-mon', url: 'https://pokeapi.co/api/v2/pokemon/og-test-mon/' } }],
					}),
				} as Response;
			}
			if (url.includes('/pokemon/og-test-mon')) {
				return {
					ok: true,
					json: async () => ({
						id: 555001,
						name: 'og-test-mon',
						types: [{ slot: 1, type: { name: 'grass' } }],
						sprites: { front_default: '', other: { 'official-artwork': { front_default: '' } } },
						stats: [
							{ base_stat: 50, stat: { name: 'hp' } },
							{ base_stat: 50, stat: { name: 'attack' } },
						],
						abilities: [],
						moves: [],
						height: 5,
						weight: 5,
						species: { url: 'https://pokeapi.co/api/v2/pokemon-species/og-test-mon/' },
					}),
				} as Response;
			}
			if (url.includes('/wikidex.net')) return { ok: false, json: async () => ({}) } as Response;

			if (url.includes('/type/grass')) {
				return {
					ok: true,
					json: async () => ({
						name: 'grass',
						pokemon: [
							{ pokemon: { name: 'og-test-mon', url: 'https://pokeapi.co/api/v2/pokemon/555001/' } },
							{ pokemon: { name: 'og-test-mon-2', url: 'https://pokeapi.co/api/v2/pokemon/555002/' } },
						],
					}),
				} as Response;
			}

			if (url.includes('/generation/4')) {
				return {
					ok: true,
					json: async () => ({
						pokemon_species: [
							{ name: 'og-test-mon', url: 'https://pokeapi.co/api/v2/pokemon-species/555001/' },
						],
					}),
				} as Response;
			}

			return { ok: false, json: async () => ({}) } as Response;
		})
	);
}

function ctx(pathname: string, params: Record<string, string>) {
	const request = new Request(`http://localhost:4321${pathname}`);
	return { params, request, url: new URL(request.url) } as any;
}

function readPngDimensions(buffer: Uint8Array): { width: number; height: number } {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function readBody(res: Response): Promise<Uint8Array> {
	return new Uint8Array(await res.arrayBuffer());
}

describe('OG image endpoints', () => {
	beforeEach(() => mockFetch());
	afterEach(() => vi.unstubAllGlobals());

	it('default: renders a real 1200x630 PNG for es', async () => {
		const res = await defaultGet(ctx('/og/es/default.png/', { lang: 'es' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		const body = await readBody(res);
		expect(body.byteLength).toBeGreaterThan(0);
		expect(readPngDimensions(body)).toEqual({ width: 1200, height: 630 });
	});

	it('default: renders for en too', async () => {
		const res = await defaultGet(ctx('/og/en/default.png/', { lang: 'en' }));
		expect(res.status).toBe(200);
		expect(readPngDimensions(await readBody(res))).toEqual({ width: 1200, height: 630 });
	});

	it('default: invalid lang returns 404, not 500', async () => {
		const res = await defaultGet(ctx('/og/fr/default.png/', { lang: 'fr' }));
		expect(res.status).toBe(404);
	});

	it('pokemon: valid slug renders 1200x630 PNG using real artwork', async () => {
		const res = await pokemonGet(ctx('/og/es/pokemon/og-test-mon.png/', { lang: 'es', name: 'og-test-mon' }));
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(readPngDimensions(await readBody(res))).toEqual({ width: 1200, height: 630 });
	});

	it('pokemon: falls back cleanly (still 200) when the artwork mirror fails', async () => {
		mockFetch({ artworkOk: false });
		const res = await pokemonGet(ctx('/og/es/pokemon/og-test-mon.png/', { lang: 'es', name: 'og-test-mon' }));
		expect(res.status).toBe(200);
		expect(readPngDimensions(await readBody(res))).toEqual({ width: 1200, height: 630 });
	});

	it('pokemon: invalid/unknown slug returns 404, not 500', async () => {
		const res = await pokemonGet(ctx('/og/es/pokemon/definitely-not-a-pokemon.png/', { lang: 'es', name: 'definitely-not-a-pokemon' }));
		expect(res.status).toBe(404);
	});

	it('type: valid type renders 1200x630 PNG with the real PokeAPI-derived count', async () => {
		const res = await typeGet(ctx('/og/es/type/grass.png/', { lang: 'es', type: 'grass' }));
		expect(res.status).toBe(200);
		expect(readPngDimensions(await readBody(res))).toEqual({ width: 1200, height: 630 });
	});

	it('type: invalid type slug returns 404', async () => {
		const res = await typeGet(ctx('/og/es/type/not-a-type.png/', { lang: 'es', type: 'not-a-type' }));
		expect(res.status).toBe(404);
	});

	it('generation: valid generation renders 1200x630 PNG', async () => {
		const res = await generationGet(ctx('/og/es/generation/4.png/', { lang: 'es', gen: '4' }));
		expect(res.status).toBe(200);
		expect(readPngDimensions(await readBody(res))).toEqual({ width: 1200, height: 630 });
	});

	it('generation: out-of-range generation returns 404, not 500', async () => {
		const res = await generationGet(ctx('/og/es/generation/99.png/', { lang: 'es', gen: '99' }));
		expect(res.status).toBe(404);
	});

	it('generation: non-numeric generation returns 404, not 500', async () => {
		const res = await generationGet(ctx('/og/es/generation/abc.png/', { lang: 'es', gen: 'abc' }));
		expect(res.status).toBe(404);
	});
});
