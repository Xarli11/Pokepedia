// OG images change only when underlying Pokémon/type/generation data
// changes (rare) or a deploy updates the template (also rare) — so a
// genuine render is cached hard, versioned (see the /og/v1/ route prefix)
// so it's safe to mark immutable. `Cache-Control` covers browsers and any
// downstream CDN that honors headers, but a Cloudflare Worker's own
// response is NOT edge-cached just because it carries that header (that
// auto-caching only applies to Pages' static assets) — a Worker-handled
// route must read/write the Cache API explicitly, which is what
// `cacheableImageResponse` below does.
export const OG_CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000, immutable';

// Response policy for a valid entity whose render pipeline fails (see
// cacheableImageResponse below): the returned default-card fallback is a
// real PNG, but NOT a correct representation of the requested entity, so it
// gets a short-lived header instead of the immutable one above — and is
// never written into the Workers Cache API at all (see the `cache.put` call
// below, which only runs for a genuine primary-render success). This keeps
// a transient failure from being served as "the card" for a year: the next
// request just tries the real render again.
export const OG_FALLBACK_CACHE_CONTROL = 'public, max-age=60';

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

function pngResponse(png: Uint8Array, cacheControl: string): Response {
	// TS's current BodyInit typing is stricter than the Fetch spec here — a
	// Uint8Array is a valid Response body at runtime.
	return new Response(png as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': cacheControl,
			'Content-Length': String(png.byteLength),
		},
	});
}

/**
 * Renders and edge-caches an OG image for a request that has already been
 * validated (valid lang + valid entity slug — invalid ones never reach this
 * function, see ogNotFound()). Response policy for `buildPng` failing:
 *
 *  - `fallbackPng` given and it succeeds: 200 image/png, real PNG bytes,
 *    but of the *default* card, not the requested entity — short
 *    Cache-Control, and deliberately never written to caches.default (see
 *    OG_FALLBACK_CACHE_CONTROL above). One extra render attempt, not a
 *    retry loop: if this also throws, it falls through to the same 404 as
 *    having no fallback at all.
 *  - no `fallbackPng`, or it also throws: 404 via ogNotFound() — same as an
 *    invalid slug. Never a fabricated image/png claim, never a 500.
 */
export async function cacheableImageResponse(
	request: Request,
	buildPng: () => Promise<Uint8Array>,
	fallbackPng?: () => Promise<Uint8Array>
): Promise<Response> {
	const cache = getEdgeCache();
	if (cache) {
		const cached = await cache.match(request);
		if (cached) return cached;
	}

	try {
		const png = await buildPng();
		const response = pngResponse(png, OG_CACHE_CONTROL);
		if (cache) {
			await cache.put(request, response.clone());
		}
		return response;
	} catch (err) {
		// A valid slug whose data/render pipeline failed unexpectedly (e.g. a
		// transient upstream outage) must still not 500 a social crawler.
		console.error('OG render failed:', err);
	}

	if (fallbackPng) {
		try {
			const png = await fallbackPng();
			// Deliberately not cached (no `cache.put`) — see OG_FALLBACK_CACHE_CONTROL.
			return pngResponse(png, OG_FALLBACK_CACHE_CONTROL);
		} catch (err) {
			console.error('OG fallback render also failed:', err);
		}
	}

	return ogNotFound();
}

/** Invalid lang/slug, or both the primary and fallback render failed. Plain
 * text is fine here — this is an explicit "no image" response, never a
 * false image/png claim, and it never touches caches.default (the 404
 * itself carries only a short-lived Cache-Control for downstream caches
 * that do respect headers). */
export function ogNotFound(): Response {
	return new Response('Not found', {
		status: 404,
		headers: { 'Cache-Control': 'public, max-age=300' },
	});
}
