export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    
    // Si estamos en la raíz exacta, redirigir según idioma
    if (url.pathname === '/' || url.pathname === '') {
        let preferredLang = 'es';
        try {
            const acceptLang = context.request.headers.get('accept-language');
            if (acceptLang && acceptLang.toLowerCase().includes('en')) {
                preferredLang = 'en';
            }
        } catch (e) {
            // Ante cualquier error en el móvil, default a español
        }
        return context.redirect(`/${preferredLang}/`, 302);
    }
    
    return next();
}
