import { describe, it, expect } from 'vitest';
import { cacheableImageResponse, ogNotFound, OG_CACHE_CONTROL } from './http';

describe('cacheableImageResponse', () => {
	it('returns a 200 image/png response with the aggressive cache header', async () => {
		const png = new Uint8Array([1, 2, 3, 4]);
		const res = await cacheableImageResponse(new Request('http://localhost/og/es/default.png/'), async () => png);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('image/png');
		expect(res.headers.get('Cache-Control')).toBe(OG_CACHE_CONTROL);
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
	});

	it('turns a render failure into a 404, never a 500', async () => {
		const res = await cacheableImageResponse(new Request('http://localhost/og/es/default.png/'), async () => {
			throw new Error('boom');
		});
		expect(res.status).toBe(404);
	});
});

describe('ogNotFound', () => {
	it('is a plain 404 with a short-lived cache header', () => {
		const res = ogNotFound();
		expect(res.status).toBe(404);
		expect(res.headers.get('Cache-Control')).toContain('max-age=300');
	});
});
