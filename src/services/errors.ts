// src/services/errors.ts
//
// Failure classes a page has to tell apart, because they need different
// HTTP answers (mapped in src/utils/httpResponses.ts):
//
//   EntityNotFoundError -> the entity the URL names doesn't exist -> 404
//   NotFoundError       -> some other PokeAPI resource is missing   -> 503
//   UpstreamError       -> PokeAPI unreachable/slow/erroring now    -> 503
//
// Only the page's primary entity lookup throws EntityNotFoundError. A
// missing related resource (a required dependency such as the species of
// a Pokémon that exists) is PokeAPI failing to represent a real entity,
// never "this page doesn't exist". Optional enrichment degrades at its
// call site. Anything else thrown is a Pokepedia bug and surfaces as 500.

/** A PokeAPI resource that doesn't exist (HTTP 404/410). */
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

/** The primary entity requested by the URL doesn't exist: the page is a 404. */
export class EntityNotFoundError extends NotFoundError {
    constructor(message: string) {
        super(message);
        this.name = 'EntityNotFoundError';
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

export interface UpstreamStatusOptions {
    /**
     * Treat HTTP 400 as "no such entity". Only for lookups by a URL-supplied
     * slug: PokeAPI answers 400 for identifiers it can't parse (verified:
     * `ability/mind's-eye`). Anywhere else a 400 means Pokepedia built a bad
     * request — a bug that must surface as a 500, not hide as a 404.
     */
    invalidIdIsNotFound?: boolean;
}

export function errorForUpstreamStatus(status: number, url: string, options: UpstreamStatusOptions = {}): Error {
    if (status === 404 || status === 410 || (status === 400 && options.invalidIdIsNotFound)) {
        return new NotFoundError(`No PokeAPI resource at ${url} (HTTP ${status})`);
    }
    if (status === 400) {
        return new Error(`PokeAPI rejected a request Pokepedia built (HTTP 400): ${url}`);
    }
    return new UpstreamError(`PokeAPI responded HTTP ${status} for ${url}`, status);
}
