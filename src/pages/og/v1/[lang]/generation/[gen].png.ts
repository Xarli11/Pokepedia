import type { APIRoute } from 'astro';
import { isSupportedLang } from '../../../../../utils/seo';
import { getPokemonByGeneration, GENERATION_ROMAN, generationRegionLabel } from '../../../../../services/pokeapi';
import { loadCardFonts } from '../../../../../utils/og/fonts';
import { renderCardPng } from '../../../../../utils/og/render';
import { cacheableImageResponse, ogNotFound } from '../../../../../utils/og/http';
import { buildGenerationCard } from '../../../../../utils/og/templates/generation';
import { buildDefaultCard } from '../../../../../utils/og/templates/default';

export const GET: APIRoute = async ({ params, request, url }) => {
	const lang = params.lang;
	const genNum = parseInt(params.gen || '', 10);
	if (!lang || !isSupportedLang(lang)) return ogNotFound();
	if (!Number.isInteger(genNum) || genNum < 1 || genNum > 9) return ogNotFound();

	const genKey = `gen${genNum}`;
	const region = generationRegionLabel(genKey, lang);
	const roman = GENERATION_ROMAN[genKey];

	return cacheableImageResponse(
		request,
		async () => {
			// Same source of truth as the generation landing page's SSR count.
			const [fonts, pokemonList] = await Promise.all([loadCardFonts(url.origin), getPokemonByGeneration(genKey)]);

			const tree = buildGenerationCard({ lang, roman, region, count: pokemonList.length });
			return renderCardPng(tree, fonts);
		},
		async () => {
			const fonts = await loadCardFonts(url.origin);
			return renderCardPng(buildDefaultCard(lang), fonts);
		}
	);
};
