// src/utils/gameContextStorage.ts
//
// Client-only persistence for the selected Game Context (see
// services/gameContext.ts), so choosing "Sword / Shield" on one Pokémon
// page carries over to the next. One key, one shape (a bare context id
// string — there is nothing else worth storing yet), read/written only
// through this module — never `localStorage` directly from a component.
//
// Same pattern as utils/favorites.ts / utils/searchHistory.ts: storage
// access is wrapped in try/catch (private browsing, quota, disabled
// storage) and a corrupted or unrecognized value degrades to the caller's
// fallback instead of throwing.

export const GAME_CONTEXT_KEY = 'pokepedia_game_context';

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** The persisted context id, or null if there is none / storage failed. */
export function readGameContext(storage: StorageLike): string | null {
  try {
    const raw = storage.getItem(GAME_CONTEXT_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeGameContext(storage: StorageLike, contextId: string): void {
  try {
    storage.setItem(GAME_CONTEXT_KEY, contextId);
  } catch {
    /* storage unavailable: persistence is a convenience */
  }
}

/**
 * The context a page should switch to after hydration: the persisted one,
 * but only if the current Pokémon actually has data for it; otherwise the
 * server-computed default, unchanged. A missing/corrupted/unrecognized
 * stored value behaves exactly like "nothing stored".
 */
export function resolveContextForPokemon(
  storedContextId: string | null,
  availableContextIds: readonly string[],
  fallbackContextId: string
): string {
  if (storedContextId && availableContextIds.includes(storedContextId)) return storedContextId;
  return fallbackContextId;
}
