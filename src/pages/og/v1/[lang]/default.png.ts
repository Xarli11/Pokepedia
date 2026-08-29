import type { APIRoute } from 'astro';
import { isSupportedLang } from '../../../../utils/seo';
import { loadCardFonts } from '../../../../utils/og/fonts';
import { renderCardPng } from '../../../../utils/og/render';
import { cacheableImageResponse, ogNotFound } from '../../../../utils/og/http';
import { buildDefaultCard } from '../../../../utils/og/templates/default';

export const GET: APIRoute = async ({ params, request, url }) => {
	const lang = params.lang;
	if (!lang || !isSupportedLang(lang)) return ogNotFound();

	return cacheableImageResponse(request, async () => {
		const fonts = await loadCardFonts(url.origin);
		const tree = buildDefaultCard(lang);
		return renderCardPng(tree, fonts);
	});
};
