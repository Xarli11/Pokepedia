import { h } from '../elements';
import { Frame, BrandRow } from '../components';
import { colors } from '../theme';
import type { SupportedLang } from '../../seo';

const LABEL: Record<SupportedLang, string> = {
	es: 'GENERACIÓN',
	en: 'GENERATION',
};

export interface GenerationCardProps {
	lang: SupportedLang;
	roman: string;
	region: string;
	count: number;
}

export function buildGenerationCard({ lang, roman, region, count }: GenerationCardProps) {
	const countSuffix = 'Pokémon';

	return Frame(
		h(
			'div',
			{
				position: 'absolute',
				right: 20,
				top: -40,
				display: 'flex',
				fontSize: 460,
				fontWeight: 900,
				color: 'rgba(16,185,129,0.10)',
				letterSpacing: -10,
			},
			roman
		),
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
				{ display: 'flex' },
				h('span', { color: colors.white, fontSize: 68, fontWeight: 900, letterSpacing: -1.5, display: 'flex' }, `${LABEL[lang]} ${roman}`)
			),
			h(
				'div',
				{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 28, marginBottom: 18 },
				h('span', { color: colors.emerald400, fontSize: 44, fontWeight: 800, display: 'flex' }, String(count)),
				h('span', { color: colors.slate300, fontSize: 32, fontWeight: 600, display: 'flex' }, countSuffix)
			),
			h(
				'div',
				{ display: 'flex' },
				h('span', { color: colors.slate400, fontSize: 26, fontWeight: 600, display: 'flex' }, `${region} · Pokepedia`)
			),
			h('div', { display: 'flex', marginTop: 56 }, BrandRow(56, 40))
		)
	);
}
