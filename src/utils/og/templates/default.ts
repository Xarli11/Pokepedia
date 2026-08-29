import { h } from '../elements';
import { Frame, BrandRow, Chip } from '../components';
import { colors } from '../theme';
import type { SupportedLang } from '../../seo';

const COPY: Record<SupportedLang, { tagline: string; sub: string }> = {
	es: {
		tagline: 'La enciclopedia Pokémon técnica',
		sub: 'Stats · Movimientos · Habilidades · Estrategia',
	},
	en: {
		tagline: 'The Technical Pokémon Encyclopedia',
		sub: 'Stats · Moves · Abilities · Strategy',
	},
};

export function buildDefaultCard(lang: SupportedLang) {
	const copy = COPY[lang];

	return Frame(
		h(
			'div',
			{ position: 'absolute', top: 56, right: 64, display: 'flex', gap: 12 },
			Chip('GEN IX'),
			Chip('DATA'),
			Chip('COMPETITIVE')
		),
		h(
			'div',
			{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				paddingLeft: 88,
				paddingRight: 88,
			},
			BrandRow(96, 78),
			h('div', { display: 'flex', marginTop: 36 }, h('span', { color: colors.slate300, fontSize: 34, fontWeight: 600, display: 'flex' }, copy.tagline)),
			h(
				'div',
				{ display: 'flex', marginTop: 20 },
				h('span', { color: colors.emerald400, fontSize: 24, fontWeight: 700, letterSpacing: 1, display: 'flex' }, copy.sub)
			)
		)
	);
}
