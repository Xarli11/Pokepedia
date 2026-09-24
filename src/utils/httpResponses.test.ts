import { describe, it, expect } from 'vitest';
import { errorResponse, notFoundResponse, upstreamUnavailableResponse, RETRY_AFTER_SECONDS } from './httpResponses';
import { NotFoundError, UpstreamError } from '../services/errors';

describe('errorResponse: failure class -> HTTP status', () => {
  it('NotFoundError -> 404 with an empty body (Astro reroutes it to 404.astro)', () => {
    const response = errorResponse(new NotFoundError('gone'));
    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });

  it('UpstreamError -> 503 with Retry-After and no caching', () => {
    const response = errorResponse(new UpstreamError('PokeAPI down', 502));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe(String(RETRY_AFTER_SECONDS));
    expect(RETRY_AFTER_SECONDS).toBe(60);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
  });

  it('any other error is re-thrown untouched (surfaces as 500, never 404/302/200)', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'find')");
    expect(() => errorResponse(bug)).toThrow(bug);
    expect(() => errorResponse('not even an Error')).toThrow();
  });

  it('builders are stable', () => {
    expect(notFoundResponse().status).toBe(404);
    expect(upstreamUnavailableResponse().status).toBe(503);
  });
});
