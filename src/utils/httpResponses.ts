// src/utils/httpResponses.ts
//
// HTTP answers for the three failure classes a page can hit (see
// src/services/errors.ts). Pages return these instead of redirecting to a
// listing: a redirect told Google a missing or temporarily broken entity
// had "moved" somewhere, and a listing is never a real replacement.
import { NotFoundError, UpstreamError } from '../services/errors';

/** Seconds a crawler/browser should wait before retrying after a 503. */
export const RETRY_AFTER_SECONDS = 60;

/**
 * 404 with an empty body: Astro reroutes an empty-body 404 to
 * src/pages/404.astro, so the visitor gets the real not-found page while
 * the status stays 404.
 */
export function notFoundResponse(): Response {
    return new Response(null, { status: 404 });
}

/** 503 + Retry-After, never cached: the entity exists, PokeAPI is failing now. */
export function upstreamUnavailableResponse(): Response {
    return new Response(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
            '<title>503 · Pokepedia</title></head><body>' +
            '<h1>Servicio no disponible temporalmente</h1>' +
            '<p>Los datos de Pokémon no están disponibles ahora mismo. Vuelve a intentarlo en un minuto.</p>' +
            '<p lang="en">Pokémon data is temporarily unavailable. Please try again in a minute.</p>' +
            '</body></html>',
        {
            status: 503,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Retry-After': String(RETRY_AFTER_SECONDS),
                'Cache-Control': 'no-store',
            },
        }
    );
}

/**
 * Maps a classified failure to its HTTP answer: NotFoundError -> 404,
 * UpstreamError -> 503. Anything else is a Pokepedia bug and is re-thrown
 * untouched so it surfaces as a real 500 — never masked as 404/302/200.
 */
export function errorResponse(error: unknown): Response {
    if (error instanceof NotFoundError) return notFoundResponse();
    if (error instanceof UpstreamError) return upstreamUnavailableResponse();
    throw error;
}
