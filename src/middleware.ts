import type { APIContext, MiddlewareNext } from 'astro';
import { isSupportedLang, pagePath } from './utils/seo';

function parsePreferredLang(acceptLang: string): string {
    // Parse "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7" → highest-q wins
    const entries = acceptLang.split(',').map(part => {
        const [tag, qPart] = part.trim().split(';q=');
        return { lang: tag.trim().split('-')[0].toLowerCase(), q: qPart ? parseFloat(qPart) : 1.0 };
    }).sort((a, b) => b.q - a.q);

    for (const { lang } of entries) {
        if (lang === 'es') return 'es';
        if (lang === 'en') return 'en';
    }
    return 'es';
}

export function onRequest(context: APIContext, next: MiddlewareNext) {
    const url = new URL(context.request.url);

    if (url.pathname === '/' || url.pathname === '') {
        const acceptLang = context.request.headers.get('accept-language') || '';
        const preferredLang = parsePreferredLang(acceptLang);
        return context.redirect(pagePath(preferredLang), 308);
    }

    // Every page under src/pages/[lang]/ matches any first path segment, so
    // /xx/, /fr/movimientos/ or a leaked /${lang}/objetos/… used to render
    // (200 with a broken page). An unknown locale is an unknown URL: answer
    // 404. Not context.rewrite('/404/'): that path itself matches /[lang]
    // (lang = "404") and loops back into this check.
    if (context.routePattern.startsWith('/[lang]') && !isSupportedLang(context.params.lang ?? '')) {
        return new Response(null, { status: 404 });
    }

    return next();
}
