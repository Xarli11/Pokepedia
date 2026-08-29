// OG images change only when underlying Pokémon/type/generation data
// changes (rare) or a deploy updates the template (also rare) — so we cache
// aggressively. `Cache-Control` covers browsers and any downstream CDN that
// honors headers, but a Cloudflare Worker's own response is NOT edge-cached
// just because it carries that header (that auto-caching only applies to
// Pages' static assets) — a Worker-handled route must read/write the Cache
// API explicitly, which is what `cacheableImageResponse` below does.
export const OG_CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000, immutable';

interface EdgeCache {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
}

function getEdgeCache(): EdgeCache | undefined {
	// `caches.default` only exists in the Workers runtime. Under `astro dev`
	// (plain Node) there is no global `caches` — render fresh every time.
	if (typeof caches === 'undefined') return undefined;
	const anyCaches = caches as unknown as { default?: EdgeCache };
	return anyCaches.default;
}

export async function cacheableImageResponse(
	request: Request,
	buildPng: () => Promise<Uint8Array>
): Promise<Response> {
	const cache = getEdgeCache();
	if (cache) {
		const cached = await cache.match(request);
		if (cached) return cached;
	}

	let png: Uint8Array;
	try {
		png = await buildPng();
	} catch (err) {
		// A valid slug whose data/render pipeline failed unexpectedly (e.g.
		// transient upstream outage) must still not 500 a social crawler.
		console.error('OG render failed:', err);
		return ogNotFound();
	}

	// TS's current BodyInit typing is stricter than the Fetch spec here — a
	// Uint8Array is a valid Response body at runtime.
	const response = new Response(png as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': OG_CACHE_CONTROL,
			'Content-Length': String(png.byteLength),
		},
	});

	if (cache) {
		await cache.put(request, response.clone());
	}
	return response;
}

export function ogNotFound(): Response {
	return new Response('Not found', {
		status: 404,
		headers: { 'Cache-Control': 'public, max-age=300' },
	});
}
