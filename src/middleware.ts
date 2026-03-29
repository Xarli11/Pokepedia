export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    
    // Si el usuario entra en la raíz pura, lo mandamos a su idioma
    if (url.pathname === '/') {
        let preferredLang = 'es';
        const acceptLang = context.request.headers.get('accept-language') || '';
        if (acceptLang.toLowerCase().includes('en')) {
            preferredLang = 'en';
        }
        return context.redirect(`/${preferredLang}/`, 308); // Redirección permanente para SEO y estabilidad
    }
    
    return next();
}
