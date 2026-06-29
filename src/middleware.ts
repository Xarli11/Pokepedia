import type { APIContext, MiddlewareNext } from 'astro';

export function onRequest(context: APIContext, next: MiddlewareNext) {
    const url = new URL(context.request.url);

    if (url.pathname === '/' || url.pathname === '') {
        let preferredLang = 'es';
        const acceptLang = context.request.headers.get('accept-language') || '';
        if (acceptLang.toLowerCase().includes('en')) {
            preferredLang = 'en';
        }
        return context.redirect(`/${preferredLang}/`, 308);
    }

    return next();
}
