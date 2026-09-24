// src/services/errors.ts
//
// The two upstream failure classes a page has to tell apart, because they
// need different HTTP answers:
//
//   NotFoundError  -> the requested entity doesn't exist        -> 404
//   UpstreamError  -> PokeAPI is unreachable/slow/erroring now  -> 503
//
// Anything else thrown while rendering is a Pokepedia bug and must surface
// as a real 500, never be disguised as a 404, a redirect or an empty 200.

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class UpstreamError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'UpstreamError';
        this.status = status;
    }
}

// PokeAPI answers 404 for an unknown name/id and 400 for an identifier it
// can't parse (verified live: `ability/mind's-eye` -> 400). Both mean "no
// such entity". Every other non-2xx (5xx, 429 rate limiting, 403 from its
// CDN...) is treated as a temporary upstream condition.
const NOT_FOUND_STATUSES = new Set([400, 404, 410]);

export function errorForUpstreamStatus(status: number, url: string): NotFoundError | UpstreamError {
    return NOT_FOUND_STATUSES.has(status)
        ? new NotFoundError(`No PokeAPI resource at ${url} (HTTP ${status})`)
        : new UpstreamError(`PokeAPI responded HTTP ${status} for ${url}`, status);
}
