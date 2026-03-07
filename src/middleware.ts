export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    
    if (url.pathname === '/') {
        const acceptLang = context.request.headers.get('accept-language') || '';
        const preferredLang = acceptLang.toLowerCase().includes('es') ? 'es' : 'en';
        return context.redirect(`/${preferredLang}/`);
    }
    
    // Añadir caché para que las páginas carguen instantáneamente tras la primera visita
    context.locals.cacheControl = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600';
    
    return next();
}
