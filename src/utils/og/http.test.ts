import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheableImageResponse, ogNotFound, OG_CACHE_CONTROL, OG_FALLBACK_CACHE_CONTROL } from './http';

// In-memory stand-in for Cloudflare's `caches.default` (Workers Cache API),
// keyed by request URL like the real thing — lets us assert exactly which
// responses get written to it without needing the real Workers runtime.
function installMockEdgeCache() {
	const store = new Map<string, Response>();
	const put = vi.fn(async (request: Request, response: Response) => {
		store.set(request.url, response);
	});
	const match = vi.fn(async (request: Request) => store.get(request.url));
	vi.stubGlobal('caches', { default: { match, put } });
	return { put, match, store };
}

describe('cacheableImageResponse — success', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('returns a 200 image/png response with the aggressive cache header', async () => {
		const png = new Uint8Array([1, 2, 3, 4]);
		const res = await cacheableImageResponse(new Request('http://localhost/og/v1/es/default.png/'), async () => png);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('Cache-Control')).toBe(OG_CACHE_CONTROL);
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
	});

	it('writes a genuine primary-render success to caches.default, and a second request for the same URL hits it without re-rendering', async () => {
		const { put, match } = installMockEdgeCache();
		const buildPng = vi.fn(async () => new Uint8Array([9, 9]));
		const request = () => new Request('http://localhost/og/v1/es/pokemon/dragonite.png/');

		const first = await cacheableImageResponse(request(), buildPng);
		expect(first.status).toBe(200);
		expect(buildPng).toHaveBeenCalledTimes(1);
		expect(put).toHaveBeenCalledTimes(1);

		const second = await cacheableImageResponse(request(), buildPng);
		expect(second.status).toBe(200);
		expect(match).toHaveBeenCalled();
		// Cache hit — the render function must not run again.
		expect(buildPng).toHaveBeenCalledTimes(1);
	});
});

describe('cacheableImageResponse — full render failure', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('with no fallback: 404, never a 500, never cached', async () => {
		const { put } = installMockEdgeCache();
		const res = await cacheableImageResponse(new Request('http://localhost/og/v1/es/default.png/'), async () => {
			throw new Error('boom');
		});
		expect(res.status).toBe(404);
		expect(res.headers.get('Content-Type')).not.toBe('image/png');
		expect(put).not.toHaveBeenCalled();
	});

	it('with a working fallback: 200 image/png with the short-lived Cache-Control, and it is never written to caches.default', async () => {
		const { put } = installMockEdgeCache();
		const fallbackPng = new Uint8Array([7, 7, 7]);
		const res = await cacheableImageResponse(
			new Request('http://localhost/og/v1/es/pokemon/dragonite.png/'),
			async () => {
				throw new Error('primary render failed');
			},
			async () => fallbackPng
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('Cache-Control')).toBe(OG_FALLBACK_CACHE_CONTROL);
		expect(res.headers.get('Cache-Control')).not.toBe(OG_CACHE_CONTROL);
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(fallbackPng);
		expect(put).not.toHaveBeenCalled();
	});

	it('when the fallback also throws: 404, not an infinite retry — fallback is attempted exactly once', async () => {
		const { put } = installMockEdgeCache();
		const fallbackPng = vi.fn(async () => {
			throw new Error('fallback failed too');
		});
		const res = await cacheableImageResponse(
			new Request('http://localhost/og/v1/es/pokemon/dragonite.png/'),
			async () => {
				throw new Error('primary render failed');
			},
			fallbackPng
		);

		expect(res.status).toBe(404);
		expect(fallbackPng).toHaveBeenCalledTimes(1);
		expect(put).not.toHaveBeenCalled();
	});
});

describe('ogNotFound', () => {
	beforeEach(() => installMockEdgeCache());
	afterEach(() => vi.unstubAllGlobals());

	it('is a plain 404 with a short-lived cache header, not image/png', () => {
		const res = ogNotFound();
		expect(res.status).toBe(404);
		expect(res.headers.get('Cache-Control')).toContain('max-age=300');
		expect(res.headers.get('Content-Type')).not.toBe('image/png');
	});
});
