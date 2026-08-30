// Fetches official artwork from PokeAPI's sprite mirror as an in-memory PNG
// and inlines it as a data: URI, because Satori cannot reliably fetch remote
// image URLs itself inside a Workers isolate. og:image never points at
// raw.githubusercontent.com — that URL is consumed here as a render INPUT
// only; the final PNG served to crawlers is always self-hosted.
//
// On any failure (timeout, non-200, network error) this returns null and
// the caller falls back to a locally-drawn brand mark — the card must never
// 500 because an upstream mirror is slow or down.

const ARTWORK_FETCH_TIMEOUT_MS = 4000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export async function fetchArtworkDataUri(pokemonId: number): Promise<string | null> {
	const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), ARTWORK_FETCH_TIMEOUT_MS);
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timer);

		if (!res.ok) return null;
		const buffer = await res.arrayBuffer();
		if (buffer.byteLength === 0) return null;
		return `data:image/png;base64,${arrayBufferToBase64(buffer)}`;
	} catch {
		return null;
	}
}
