export function onRequest(context: any, next: any) {
    const url = new URL(context.request.url);
    if (url.pathname === '/') {
        return context.redirect('/es');
    }
    return next();
}
