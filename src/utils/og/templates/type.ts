import { h } from '../elements';
import { Frame, BrandRow } from '../components';
import { colors } from '../theme';
import type { SupportedLang } from '../../seo';

const COPY: Record<SupportedLang, { typeWord: string; subtitle: (label: string) => string; countSuffix: string }> = {
	es: {
		typeWord: 'TIPO',
		subtitle: () => 'Debilidades · Resistencias · Pokémon',
		countSuffix: 'Pokémon',
	},
	en: {
		typeWord: '',
		subtitle: () => 'Weaknesses · Resistances · Pokémon',
		countSuffix: 'Pokémon',
	},
};

export interface TypeCardProps {
	lang: SupportedLang;
	typeLabel: string;
	typeColor: string;
	count: number;
}

export function buildTypeCard({ lang, typeLabel, typeColor, count }: TypeCardProps) {
	const copy = COPY[lang];
	const title = lang === 'es' ? `${copy.typeWord} ${typeLabel.toUpperCase()}` : `${typeLabel.toUpperCase()} TYPE`;

	return Frame(
		h('div', {
			position: 'absolute',
			top: 0,
			left: 0,
			bottom: 0,
			width: 18,
			backgroundColor: typeColor,
			display: 'flex',
		}),
		h('div', {
			position: 'absolute',
			width: 620,
			height: 620,
			borderRadius: 310,
			top: 100,
			right: -220,
			backgroundColor: `${typeColor}22`,
			border: `2px solid ${typeColor}40`,
			display: 'flex',
		}),
		h(
			'div',
			{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				paddingLeft: 96,
				paddingRight: 88,
			},
			h(
				'div',
				{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 },
				h('div', { width: 28, height: 28, borderRadius: 8, backgroundColor: typeColor, display: 'flex' }),
				h('span', { color: colors.white, fontSize: 64, fontWeight: 900, letterSpacing: -1.5, display: 'flex' }, title)
			),
			h(
				'div',
				{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 },
				h('span', { color: colors.emerald400, fontSize: 44, fontWeight: 800, display: 'flex' }, String(count)),
				h('span', { color: colors.slate300, fontSize: 32, fontWeight: 600, display: 'flex' }, copy.countSuffix)
			),
			h('div', { display: 'flex' }, h('span', { color: colors.slate400, fontSize: 26, fontWeight: 600, letterSpacing: 0.5, display: 'flex' }, copy.subtitle(typeLabel))),
			h('div', { display: 'flex', marginTop: 56 }, BrandRow(56, 40))
		)
	);
}
