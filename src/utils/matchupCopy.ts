// src/utils/matchupCopy.ts
//
// Copy for the type-matchup block (F6 Experiment 1) and the page's SEO
// title / description. Everything is generated from data (the typing and the
// matrix in typeMatchups.ts) — there is no free-form text. ES and EN are
// written out separately because the grammar differs.
//
// The page calls pokemonSeoCopy() for EVERY Pokémon. Outside the treatment
// group it returns exactly the legacy title/description (and no matchups), so
// control and untouched pages render as before.

import { typeTranslations } from './pokemon';
import { isMatchupTreatment } from './matchupPilot';
import { formatMultiplier, matchupsFor, type TypeMatchups, type TypeName } from './typeMatchups';

type Lang = 'es' | 'en';
const asLang = (lang: string): Lang => (lang === 'es' ? 'es' : 'en');

const DESCRIPTION_MAX = 160;
/** A list longer than this is summarised as a count in running prose (the table always lists everything). */
const MAX_LISTED = 5;

const typeLabel = (type: TypeName, lang: Lang) => typeTranslations[lang][type];

function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join('');
  const and = lang === 'es' ? 'y' : 'and';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

const names = (types: TypeName[], lang: Lang) => types.map((t) => typeLabel(t, lang));

/** "Acero/Volador" — the typing as the site prints it. */
export function typingLabel(types: readonly TypeName[], lang: string): string {
  const l = asLang(lang);
  return types.map((t) => typeLabel(t, l)).join('/');
}

/**
 * Plain-language summary shown above the table. Reflects typing only:
 * "immune" means the TYPES grant immunity, never an ability.
 */
export function matchupSummary(
  pokemonName: string,
  types: readonly TypeName[],
  m: TypeMatchups,
  lang: string,
): string {
  const l = asLang(lang);
  const head = `${pokemonName} (${typingLabel(types, l)})`;
  const sentences: string[] = [];

  // Weaknesses
  if (m.x4.length === 0 && m.x2.length === 0) {
    sentences.push(l === 'es' ? `${head} no tiene debilidades por tipo.` : `${head} has no type weaknesses.`);
  } else {
    const quad = joinList(names(m.x4, l), l);
    const dbl = joinList(names(m.x2, l), l);
    if (l === 'es') {
      const text = m.x4.length && m.x2.length
        ? `${formatMultiplier(4)} de ${quad} y ${formatMultiplier(2)} de ${dbl}`
        : m.x4.length
          ? `${formatMultiplier(4)} de ${quad}`
          : `${formatMultiplier(2)} de ${dbl}`;
      sentences.push(`${head} recibe daño ${text}.`);
    } else {
      const text = m.x4.length && m.x2.length
        ? `${formatMultiplier(4)} damage from ${quad} and ${formatMultiplier(2)} from ${dbl}`
        : m.x4.length
          ? `${formatMultiplier(4)} damage from ${quad}`
          : `${formatMultiplier(2)} damage from ${dbl}`;
      sentences.push(`${head} takes ${text}.`);
    }
  }

  // Resistances
  if (m.x025.length || m.x05.length) {
    const parts: string[] = [];
    if (m.x025.length) {
      const list = m.x025.length <= MAX_LISTED ? joinList(names(m.x025, l), l) : String(m.x025.length);
      const noun = m.x025.length <= MAX_LISTED ? '' : (l === 'es' ? ' tipos' : ' types');
      parts.push(`${list}${noun} (${formatMultiplier(0.25)})`);
    }
    if (m.x05.length) {
      if (m.x05.length <= MAX_LISTED) {
        parts.push(`${joinList(names(m.x05, l), l)} (${formatMultiplier(0.5)})`);
      } else {
        const other = m.x025.length > 0;
        const text = l === 'es'
          ? `${other ? 'otros ' : ''}${m.x05.length} tipos`
          : `${m.x05.length} ${other ? 'other ' : ''}types`;
        parts.push(`${text} (${formatMultiplier(0.5)})`);
      }
    }
    const and = l === 'es' ? ' y ' : ' and ';
    sentences.push(l === 'es' ? `Resiste ${parts.join(and)}.` : `It resists ${parts.join(and)}.`);
  }

  // Immunities (granted by the typing)
  if (m.x0.length) {
    const list = joinList(names(m.x0, l), l);
    sentences.push(l === 'es' ? `Es inmune a ${list}.` : `It is immune to ${list}.`);
  }
  return sentences.join(' ');
}

/** Weakness/immunity part of the meta description, e.g. "débil a Fuego y Eléctrico (×2), inmune a Tierra y Veneno". */
function matchupHeadline(m: TypeMatchups, lang: Lang): string {
  const weak: string[] = [];
  if (m.x4.length) weak.push(`${joinList(names(m.x4, lang), lang)} (${formatMultiplier(4)})`);
  if (m.x2.length) weak.push(`${joinList(names(m.x2, lang), lang)} (${formatMultiplier(2)})`);
  // Groups are comma-separated so "Hielo (×4), Dragón y Hada (×2)" never reads as one run of "y … y".
  const weakText = weak.length
    ? `${lang === 'es' ? 'débil a' : 'weak to'} ${weak.join(', ')}`
    : (lang === 'es' ? 'sin debilidades por tipo' : 'no type weaknesses');
  const immune = m.x0.length
    ? `, ${lang === 'es' ? 'inmune a' : 'immune to'} ${joinList(names(m.x0, lang), lang)}`
    : '';
  return `${weakText}${immune}`;
}

export function matchupTitle(pokemonName: string, lang: string): string {
  return asLang(lang) === 'es'
    ? `${pokemonName}: Debilidades, Stats y Movimientos`
    : `${pokemonName} Weaknesses, Stats & Moves`;
}

/** Meta description for treated pages: facts first, then what else the page has. Always <= 160 chars. */
export function matchupDescription(
  pokemonName: string,
  types: readonly TypeName[],
  m: TypeMatchups,
  totalStats: number,
  lang: string,
): string {
  const l = asLang(lang);
  const head = `${pokemonName} (${typingLabel(types, l)}): ${matchupHeadline(m, l)}.`;
  const tails = l === 'es'
    ? [
        `Stats base (${totalStats}), habilidades, evolución y movimientos.`,
        `Stats base (${totalStats}), habilidades y movimientos.`,
        `Stats base (${totalStats}).`,
      ]
    : [
        `Base stats (${totalStats}), abilities, evolution and moves.`,
        `Base stats (${totalStats}), abilities and moves.`,
        `Base stats (${totalStats}).`,
      ];
  for (const tail of tails) {
    const candidate = `${head} ${tail}`;
    if (candidate.length <= DESCRIPTION_MAX) return candidate;
  }
  return head.length <= DESCRIPTION_MAX ? head : `${head.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

/** The title/description every Pokémon page had before the experiment. Kept byte-identical on purpose. */
export function legacyPokemonSeo(pokemonName: string, totalStats: number, lang: string): { title: string; description: string } {
  return lang === 'es'
    ? {
        title: `${pokemonName}: Stats, Movimientos y Habilidades`,
        description: `Ficha de ${pokemonName}: tipos, estadísticas base (${totalStats}), habilidades, evolución y movimientos que aprende.`,
      }
    : {
        title: `${pokemonName}: Stats, Moves & Abilities`,
        description: `${pokemonName} profile: types, base stats (${totalStats}), abilities, evolution and the moves it learns.`,
      };
}

export interface PokemonSeoCopy {
  title: string;
  description: string;
  /** Non-null only for treatment pages: the page then renders the matchup block. */
  matchups: TypeMatchups | null;
  /** Summary sentence for the block (null when matchups is null). */
  summary: string | null;
}

/**
 * Single entry point used by the Pokémon page. `slug` is the CANONICAL species
 * slug. Treatment pages get the matchup block and facts-first title and
 * description; everything else gets the legacy values.
 */
export function pokemonSeoCopy(args: {
  slug: string;
  lang: string;
  name: string;
  types: readonly string[];
  totalStats: number;
}): PokemonSeoCopy {
  const legacy = legacyPokemonSeo(args.name, args.totalStats, args.lang);
  if (!isMatchupTreatment(args.slug)) return { ...legacy, matchups: null, summary: null };

  const matchups = matchupsFor(args.types);
  // Unknown typing: nothing trustworthy to claim, so the page stays as it was.
  if (!matchups) return { ...legacy, matchups: null, summary: null };

  const types = args.types as readonly TypeName[];
  return {
    title: matchupTitle(args.name, args.lang),
    description: matchupDescription(args.name, types, matchups, args.totalStats, args.lang),
    matchups,
    summary: matchupSummary(args.name, types, matchups, args.lang),
  };
}
