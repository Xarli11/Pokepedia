import { h, type SatoriNode } from './elements';
import { CARD_WIDTH, CARD_HEIGHT, colors, fontFamily } from './theme';

// Outer 1200x630 frame: near-black slate gradient + two soft emerald glows,
// echoing the blurred-circle decoration already used in Layout.astro's
// footer — deliberately restrained (no particles, no glassmorphism grid).
export function Frame(...children: SatoriNode[]): SatoriNode {
	return h(
		'div',
		{
			width: CARD_WIDTH,
			height: CARD_HEIGHT,
			display: 'flex',
			flexDirection: 'column',
			position: 'relative',
			backgroundColor: colors.bgBottom,
			backgroundImage: `linear-gradient(160deg, ${colors.bgTop} 0%, ${colors.bgBottom} 65%)`,
			fontFamily,
		},
		h('div', {
			position: 'absolute',
			width: 520,
			height: 520,
			borderRadius: 260,
			top: -220,
			right: -160,
			backgroundColor: colors.emeraldGlow,
			display: 'flex',
		}),
		h('div', {
			position: 'absolute',
			width: 420,
			height: 420,
			borderRadius: 210,
			bottom: -200,
			left: -140,
			backgroundColor: colors.emeraldGlow,
			display: 'flex',
		}),
		...children
	);
}

// The header's "Poké-Core" mark (hexagon + circle/line/dot) redrawn as a
// self-contained SVG so the fallback path never depends on a network fetch.
export function PokeCoreMark(size: number): SatoriNode {
	return h(
		'div',
		{
			width: size,
			height: size,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: 'rgba(16,185,129,0.12)',
			border: `${Math.max(3, Math.round(size * 0.05))}px solid ${colors.emerald500}`,
			borderRadius: Math.round(size * 0.28),
			transform: 'rotate(45deg)',
		},
		h(
			'div',
			{
				display: 'flex',
				transform: 'rotate(-45deg)',
			},
			{
				type: 'svg',
				props: {
					width: Math.round(size * 0.5),
					height: Math.round(size * 0.5),
					viewBox: '0 0 24 24',
					fill: 'none',
					stroke: colors.emerald400,
					strokeWidth: 3,
					children: [
						{ type: 'circle', props: { cx: 12, cy: 12, r: 10 } },
						{ type: 'path', props: { d: 'M2 12h20' } },
						{ type: 'circle', props: { cx: 12, cy: 12, r: 3, fill: colors.emerald400 } },
					],
				},
			}
		)
	);
}

export function Wordmark(fontSize: number): SatoriNode {
	return h(
		'div',
		{ display: 'flex', alignItems: 'baseline' },
		h('span', { color: colors.white, fontSize, fontWeight: 900, letterSpacing: -1.5, display: 'flex' }, 'POKE'),
		h('span', { color: colors.emerald500, fontSize, fontWeight: 300, letterSpacing: 1, display: 'flex' }, 'pedia')
	);
}

export function BrandRow(mark: number, wordmarkSize: number): SatoriNode {
	return h(
		'div',
		{ display: 'flex', alignItems: 'center', gap: 16 },
		PokeCoreMark(mark),
		Wordmark(wordmarkSize)
	);
}

export function Chip(label: string): SatoriNode {
	return h(
		'div',
		{
			display: 'flex',
			padding: '8px 16px',
			borderRadius: 10,
			backgroundColor: 'rgba(148,163,184,0.10)',
			border: `1px solid ${colors.panelBorder}`,
			color: colors.slate400,
			fontSize: 20,
			fontWeight: 700,
			letterSpacing: 2,
		},
		label
	);
}

export function TypePill(label: string, color: string): SatoriNode {
	return h(
		'div',
		{
			display: 'flex',
			padding: '10px 24px',
			borderRadius: 12,
			backgroundColor: `${color}26`,
			border: `2px solid ${color}59`,
			color: colors.white,
			fontSize: 28,
			fontWeight: 800,
			letterSpacing: 1,
		},
		label
	);
}
