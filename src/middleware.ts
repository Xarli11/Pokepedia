import type { APIContext, MiddlewareNext } from 'astro';

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
        return context.redirect(`/${preferredLang}/`, 308);
    }

    return next();
}
