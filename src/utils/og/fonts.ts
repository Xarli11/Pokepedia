// Satori needs font data as raw ArrayBuffers (TTF/OTF — no WOFF2, no system
// fonts, no runtime Google Fonts fetch). We bundle static Inter instances
// under public/fonts/og/ (SIL OFL 1.1, sourced from github.com/rsms/inter
// v4.1 — see public/fonts/og/LICENSE.txt) and fetch them from the request's
// own origin, once per isolate, caching the ArrayBuffers in module scope.

const FONT_FILES = {
	regular: '/fonts/og/Inter-Regular.ttf',
	medium: '/fonts/og/Inter-Medium.ttf',
	bold: '/fonts/og/Inter-Bold.ttf',
	black: '/fonts/og/Inter-Black.ttf',
} as const;

type FontWeightKey = keyof typeof FONT_FILES;

const bufferCache = new Map<FontWeightKey, ArrayBuffer>();

async function loadFontBuffer(origin: string, weightKey: FontWeightKey): Promise<ArrayBuffer> {
	const cached = bufferCache.get(weightKey);
	if (cached) return cached;

	const res = await fetch(new URL(FONT_FILES[weightKey], origin).toString());
	if (!res.ok) {
		throw new Error(`OG font fetch failed for ${weightKey}: HTTP ${res.status}`);
	}
	const buffer = await res.arrayBuffer();
	bufferCache.set(weightKey, buffer);
	return buffer;
}

export interface SatoriFont {
	name: string;
	data: ArrayBuffer;
	weight: 400 | 500 | 700 | 900;
	style: 'normal';
}

export async function loadCardFonts(origin: string): Promise<SatoriFont[]> {
	const [regular, medium, bold, black] = await Promise.all([
		loadFontBuffer(origin, 'regular'),
		loadFontBuffer(origin, 'medium'),
		loadFontBuffer(origin, 'bold'),
		loadFontBuffer(origin, 'black'),
	]);

	return [
		{ name: 'Inter', data: regular, weight: 400, style: 'normal' },
		{ name: 'Inter', data: medium, weight: 500, style: 'normal' },
		{ name: 'Inter', data: bold, weight: 700, style: 'normal' },
		{ name: 'Inter', data: black, weight: 900, style: 'normal' },
	];
}
