// src/utils/analytics.ts
//
// Single entry point for product analytics events. GA4 base config lives in
// Layout.astro (gtag.js snippet); every event call anywhere else in the
// codebase — client <script> blocks, inline onclick handlers — must go
// through trackEvent() here instead of calling window.gtag directly, so
// there is one place that knows the event names/params and one place that
// enforces "never break the page".
//
// Rules this module exists to enforce:
//   - No PII, ever. No raw free-text search terms, no user-identifying data.
//   - Fails silently: if GA hasn't loaded yet, is blocked by the browser/an
//     extension, or window.gtag simply isn't a function, trackEvent() is a
//     no-op. It must never throw and must never delay/block the UI action
//     that triggered it.
//   - Parameters are a flat set of short, non-sensitive strings describing
//     *what* happened, not raw user input.

export interface AnalyticsParams {
	entity_type?: string;
	entity_slug?: string;
	language?: string;
	target?: string;
	source_surface?: string;
	[key: string]: string | number | boolean | undefined;
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}): void {
	try {
		if (typeof window === 'undefined') return;
		if (typeof window.gtag !== 'function') return;
		window.gtag('event', eventName, params);
	} catch {
		// Analytics must never break UX — swallow and move on.
	}
}
