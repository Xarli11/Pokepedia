import { h } from '../elements';
import { Frame, BrandRow, TypePill, PokeCoreMark } from '../components';
import { colors } from '../theme';

export interface PokemonCardProps {
	dexLabel: string;
	name: string;
	types: { label: string; color: string }[];
	bst: number;
	artworkDataUri: string | null;
}

// Long forme names ("Charizard (Mega Y)", "Necrozma (Dusk Mane)") must not
// clip or overflow the 1200x630 safe area — shrink by length instead of a
// per-Pokémon hardcode.
function nameFontSize(name: string): number {
	if (name.length <= 12) return 78;
	if (name.length <= 18) return 62;
	if (name.length <= 26) return 48;
	return 38;
}

export function buildPokemonCard({ dexLabel, name, types, bst, artworkDataUri }: PokemonCardProps) {
	const primaryColor = types[0]?.color || colors.emerald500;
	const bstLabel = 'BST';

	return Frame(
		h(
			'div',
			{ flex: 1, display: 'flex', flexDirection: 'row', paddingLeft: 88, paddingTop: 64, paddingBottom: 56, paddingRight: 40 },
			h(
				'div',
				{ width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
				h(
					'div',
					{ display: 'flex' },
					h(
						'span',
						{
							color: colors.slate400,
							fontSize: 26,
							fontWeight: 700,
							letterSpacing: 2,
							display: 'flex',
							fontFamily: 'monospace',
						},
						dexLabel
					)
				),
				h(
					'div',
					{ display: 'flex', marginTop: 8, marginBottom: 24, maxWidth: 600 },
					h('span', { color: colors.white, fontSize: nameFontSize(name), fontWeight: 900, letterSpacing: -1, display: 'flex', lineHeight: 1.05 }, name)
				),
				h(
					'div',
					{ display: 'flex', gap: 12, marginBottom: 32 },
					...types.map((t) => TypePill(t.label.toUpperCase(), t.color))
				),
				h(
					'div',
					{
						display: 'flex',
						alignItems: 'baseline',
						gap: 16,
						padding: '20px 28px',
						borderRadius: 18,
						backgroundColor: 'rgba(15,23,42,0.6)',
						border: `1px solid ${colors.panelBorder}`,
						width: 260,
					},
					h('span', { color: colors.slate400, fontSize: 22, fontWeight: 800, letterSpacing: 2, display: 'flex' }, bstLabel),
					h('span', { color: colors.emerald400, fontSize: 40, fontWeight: 900, display: 'flex' }, String(bst))
				),
				h('div', { display: 'flex', marginTop: 44 }, BrandRow(52, 36))
			),
			h(
				'div',
				{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
				h('div', {
					position: 'absolute',
					width: 420,
					height: 420,
					borderRadius: 210,
					backgroundColor: `${primaryColor}33`,
					display: 'flex',
				}),
				artworkDataUri
					? { type: 'img', props: { src: artworkDataUri, width: 400, height: 400, style: { objectFit: 'contain', display: 'flex' } } }
					: PokeCoreMark(220)
			)
		)
	);
}
