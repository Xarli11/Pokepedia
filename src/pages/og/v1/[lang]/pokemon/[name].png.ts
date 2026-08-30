import type { APIRoute } from 'astro';
import { isSupportedLang } from '../../../../../utils/seo';
import { getPokemonByName, getLocalizedName, PokemonNotFoundError } from '../../../../../services/pokeapi';
import { typeColors, typeTranslations, formatPokemonNumber, formatName } from '../../../../../utils/pokemon';
import { loadCardFonts } from '../../../../../utils/og/fonts';
import { fetchArtworkDataUri } from '../../../../../utils/og/artwork';
import { renderCardPng } from '../../../../../utils/og/render';
import { cacheableImageResponse, ogNotFound } from '../../../../../utils/og/http';
import { buildPokemonCard } from '../../../../../utils/og/templates/pokemon';
import { buildDefaultCard } from '../../../../../utils/og/templates/default';
import type { SupportedLang } from '../../../../../utils/seo';

// Mirrors the forme-suffix logic in src/pages/[lang]/pokemon/[name].astro
// (not exported there — it's inline page presentation logic, and Pokémon
// page logic is explicitly out of scope for this sprint) so "Charizard
// (Mega Y)"-style names render identically on the card and on the page.
function buildLocalizedName(speciesName: string, detailName: string, speciesRawName: string, lang: SupportedLang): string {
	if (detailName === speciesRawName) return speciesName;
	const suffix = detailName.replace(speciesRawName, '').replace(/-/g, ' ').trim();
	if (!suffix) return speciesName;
	const suffixMap: Record<string, string> = {
		gmax: lang === 'es' ? 'Gigamax' : 'G-Max',
		mega: 'Mega',
		alola: 'Alola',
		galar: 'Galar',
		hisui: 'Hisui',
		paldea: 'Paldea',
		'mega x': 'Mega X',
		'mega y': 'Mega Y',
	};
	return `${speciesName} (${suffixMap[suffix.toLowerCase()] || formatName(suffix)})`;
}

export const GET: APIRoute = async ({ params, request, url }) => {
	const lang = params.lang;
	const rawName = (params.name || '').toLowerCase();
	if (!lang || !isSupportedLang(lang)) return ogNotFound();
	if (!rawName) return ogNotFound();

	let pokemonData: Awaited<ReturnType<typeof getPokemonByName>>;
	try {
		pokemonData = await getPokemonByName(rawName);
	} catch (err) {
		if (err instanceof PokemonNotFoundError) return ogNotFound();
		// Any other failure (e.g. transient upstream outage) — safe 404,
		// never a 500 for a social crawler.
		return ogNotFound();
	}

	const { detail, species } = pokemonData;
	const pokemonId = detail.id;

	const speciesDisplayName = getLocalizedName(species.names, lang) || species.name;
	const name = buildLocalizedName(speciesDisplayName, detail.name, species.name, lang);
	const dexLabel = pokemonId > 10000 ? (lang === 'es' ? 'FORMA ESPECIAL' : 'SPECIAL FORM') : formatPokemonNumber(pokemonId);
	const types = (detail.types || []).map((t) => {
		const slug = t.type.name;
		return { label: typeTranslations[lang]?.[slug] || slug, color: typeColors[slug] || '#10b981' };
	});
	const bst = (detail.stats || []).reduce((acc, s) => acc + s.base_stat, 0);

	return cacheableImageResponse(
		request,
		async () => {
			const [fonts, artworkDataUri] = await Promise.all([loadCardFonts(url.origin), fetchArtworkDataUri(pokemonId)]);

			const tree = buildPokemonCard({ dexLabel, name, types, bst, artworkDataUri });
			return renderCardPng(tree, fonts);
		},
		async () => {
			// Entity is valid but the full render failed (see http.ts) — one
			// extra attempt at the plain default card, never cached long-term.
			const fonts = await loadCardFonts(url.origin);
			return renderCardPng(buildDefaultCard(lang), fonts);
		}
	);
};
