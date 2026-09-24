// src/testing/renderRoute.ts
//
// Renders a page through src/middleware.ts, as production does: a page that
// throws NotFoundError / UpstreamError is answered 404 / 503 by the
// middleware, and any other error propagates (Astro then serves 500.astro —
// verified on the built worker; the Container API has no error pages).
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { APIContext, MiddlewareNext } from 'astro';
import { onRequest } from '../middleware';
import { SITE_URL } from '../utils/seo';

export async function renderRoute(
    component: any,
    { routePattern, params, path }: { routePattern: string; params: Record<string, string>; path: string }
): Promise<Response> {
    const container = await AstroContainer.create();
    const request = new Request(`${SITE_URL}${path}`);
    const next = (() => container.renderToResponse(component, { params, request })) as unknown as MiddlewareNext;
    const context = {
        request,
        routePattern,
        params,
        redirect: (location: string, status: number) =>
            new Response(null, { status, headers: { Location: location } }),
    } as unknown as APIContext;
    return onRequest(context, next) as Promise<Response>;
}
