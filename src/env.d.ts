/// <reference types="astro/client" />

declare namespace App {
	interface Locals {
		// Set by an edge/CDN layer ahead of the Cloudflare adapter when it wants
		// this render to override the default Cache-Control response header.
		// No current middleware sets it, so Layout.astro's read of it is always
		// undefined today; kept optional so that future edge code can populate
		// it without a type change here.
		cacheControl?: string;
	}
}

// Client-side globals assigned by Layout.astro's inline <script> (favorites,
// back-to-top scroll handler, in-flight search abort controller) and by the
// optional Google Analytics snippet (gtag). All are guarded with
// `if (window.x)` / `typeof window.x === 'function'` checks at every call
// site because they may not be defined yet (first paint, GA blocked, etc.).
interface Window {
	updateFavButtons?: () => void;
	toggleFavorite?: (pokemonName: string) => void;
	gtag?: (...args: unknown[]) => void;
	_backToTopHandler?: () => void;
	_searchAbortController?: AbortController;
}
