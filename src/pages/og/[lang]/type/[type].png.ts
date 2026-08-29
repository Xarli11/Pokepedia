import type { APIRoute } from 'astro';
import { isSupportedLang } from '../../../../utils/seo';
import { typeColors, typeTranslations } from '../../../../utils/pokemon';
import { getPokemonByType } from '../../../../services/pokeapi';
import { loadCardFonts } from '../../../../utils/og/fonts';
import { renderCardPng } from '../../../../utils/og/render';
import { cacheableImageResponse, ogNotFound } from '../../../../utils/og/http';
import { buildTypeCard } from '../../../../utils/og/templates/type';

export const GET: APIRoute = async ({ params, request, url }) => {
	const lang = params.lang;
	const typeSlug = (params.type || '').toLowerCase();
	if (!lang || !isSupportedLang(lang)) return ogNotFound();
	if (!Object.prototype.hasOwnProperty.call(typeColors, typeSlug)) return ogNotFound();

	return cacheableImageResponse(request, async () => {
		// Same source of truth as the type landing page's SSR count — no
		// second, divergent counting logic.
		const [fonts, pokemonList] = await Promise.all([loadCardFonts(url.origin), getPokemonByType(typeSlug)]);

		const typeLabel = typeTranslations[lang]?.[typeSlug] || typeSlug;
		const typeColor = typeColors[typeSlug];

		const tree = buildTypeCard({ lang, typeLabel, typeColor, count: pokemonList.length });
		return renderCardPng(tree, fonts);
	});
};
