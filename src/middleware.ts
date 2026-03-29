export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    
    // Evitar bucles de redirección y manejar la raíz
    if (url.pathname === '/') {
        let preferredLang = 'es';
        try {
            const acceptLang = context.request.headers.get('accept-language');
            if (acceptLang && acceptLang.toLowerCase().includes('en')) {
                preferredLang = 'en';
            }
        } catch (e) {
            // Fallback silencioso
        }
        return context.redirect(`/${preferredLang}/`);
    }
    
    // Añadir caché para que las páginas carguen instantáneamente tras la primera visita
    // Cloudflare respetará estos headers
    context.locals.cacheControl = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600';
    
    return next();
}
