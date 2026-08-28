import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent } from './analytics';

// This project's vitest config runs in a plain Node environment (no DOM),
// so `window` is undefined by default here — the same shape trackEvent()
// must tolerate in real usage (GA blocked, ad blocker, SSR-adjacent code
// paths). Tests that need a gtag stub build a minimal fake `window`.

describe('trackEvent', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('no-ops silently when window does not exist at all', () => {
		expect(typeof window).toBe('undefined');
		expect(() => trackEvent('global_search', { language: 'es' })).not.toThrow();
	});

	it('no-ops silently when window.gtag is not a function', () => {
		vi.stubGlobal('window', { gtag: 'not-a-function' });
		expect(() => trackEvent('global_search', { language: 'es' })).not.toThrow();
	});

	it('forwards to window.gtag with the event name and params when gtag is available', () => {
		const gtagMock = vi.fn();
		vi.stubGlobal('window', { gtag: gtagMock });

		trackEvent('favorite_toggle', { entity_type: 'pokemon', entity_slug: 'pikachu', target: 'add' });

		expect(gtagMock).toHaveBeenCalledTimes(1);
		expect(gtagMock).toHaveBeenCalledWith('event', 'favorite_toggle', {
			entity_type: 'pokemon',
			entity_slug: 'pikachu',
			target: 'add',
		});
	});

	it('never throws even if the underlying gtag call throws (blocked by an extension, etc.)', () => {
		vi.stubGlobal('window', { gtag: vi.fn(() => { throw new Error('blocked'); }) });
		expect(() => trackEvent('sources_click')).not.toThrow();
	});
});
