// Shared visual language for OG cards. Deliberately reuses Pokepedia's
// existing slate/near-black + emerald identity (see Layout.astro header/
// footer) rather than inventing a new palette — cards must read as the same
// product as the live site, not a reskinned PokeTypes template.

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const colors = {
	bgTop: '#0b1120',
	bgBottom: '#020617',
	panel: 'rgba(15,23,42,0.55)',
	panelBorder: 'rgba(148,163,184,0.16)',
	white: '#f8fafc',
	slate300: '#cbd5e1',
	slate400: '#94a3b8',
	slate500: '#64748b',
	emerald400: '#34d399',
	emerald500: '#10b981',
	emeraldGlow: 'rgba(16,185,129,0.16)',
} as const;

export const fontFamily = 'Inter';

export const brand = {
	es: 'Pokepedia',
	en: 'Pokepedia',
} as const;
