export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    
    if (url.pathname === '/') {
        const acceptLang = context.request.headers.get('accept-language') || '';
        const preferredLang = acceptLang.toLowerCase().includes('es') ? 'es' : 'en';
        return context.redirect(`/${preferredLang}`);
    }
    
    return next();
}
