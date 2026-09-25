// src/utils/moveMeta.ts
//
// Pure title / description builders for /movimientos/{slug}/ pages.
//
// Root cause this fixes: [name].astro computed a description but never passed
// it to Layout, so all 937 move pages (in both languages) shared the Layout
// default "Tu enciclopedia Pokémon técnica y definitiva." — Spanish, even on
// /en/ — and 36 pages per language shared a title. Everything here derives
// from explicit, structured PokeAPI fields; nothing describes an effect the
// data does not state.

import { selectLocalizedFlavor } from '../services/localizedText';

export type MoveLang = 'es' | 'en';

export interface MoveFacts {
  /** Localized move name. */
  name: string;
  /** Localized type label ("Agua" / "Water"). */
  typeLabel: string;
  /** PokeAPI damage class: physical | special | status. */
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
}

interface Copy {
  categoryLabel: Record<string, string>;
  titleCategory: Record<string, string>;
}

const COPY: Record<MoveLang, Copy> = {
  es: {
    categoryLabel: { physical: 'Físico', special: 'Especial', status: 'Estado' },
    // Adjective slot in "Movimiento {…} de tipo X".
    titleCategory: { physical: 'físico', special: 'especial', status: 'de estado' },
  },
  en: {
    categoryLabel: { physical: 'Physical', special: 'Special', status: 'Status' },
    titleCategory: { physical: 'Physical', special: 'Special', status: 'Status' },
  },
};

function safeLang(lang: string): MoveLang {
  return lang === 'en' ? 'en' : 'es';
}

function signedPriority(priority: number): string {
  return priority > 0 ? `+${priority}` : String(priority);
}

function joinList(items: string[], lang: MoveLang): string {
  if (items.length <= 1) return items.join('');
  const and = lang === 'es' ? 'y' : 'and';
  const list = items.length === 2 ? items.join(` ${and} `) : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
  return list;
}

/**
 * "Surf — Movimiento especial de tipo Agua" / "Surf — Water-type Special Move".
 * The category is part of the title because PokeAPI has 18 Z-move name pairs
 * that differ only by physical/special; without it their titles collide.
 * Layout.astro appends the brand suffix.
 */
export function buildMoveTitle(lang: string, facts: Pick<MoveFacts, 'name' | 'typeLabel' | 'category'>): string {
  const l = safeLang(lang);
  const cat = COPY[l].titleCategory[facts.category];
  if (l === 'es') {
    return `${facts.name} — Movimiento${cat ? ` ${cat}` : ''} de tipo ${facts.typeLabel}`;
  }
  return `${facts.name} — ${facts.typeLabel}-type${cat ? ` ${cat}` : ''} Move`;
}

/**
 * Sentence built only from explicit fields. Absent power/accuracy (null in
 * PokeAPI: status moves, never-miss moves) are omitted, never guessed.
 *
 *   es: "Surf es un movimiento de tipo Agua y categoría Especial. Tiene 90 de potencia, 100% de precisión y 15 PP."
 *   en: "Surf is a Water-type Special move with 90 power, 100% accuracy and 15 PP."
 */
export function buildMoveFactualDescription(lang: string, facts: MoveFacts): string {
  const l = safeLang(lang);
  const category = COPY[l].categoryLabel[facts.category];

  if (l === 'es') {
    const parts: string[] = [];
    if (facts.power != null) parts.push(`${facts.power} de potencia`);
    if (facts.accuracy != null) parts.push(`${facts.accuracy}% de precisión`);
    if (facts.pp != null) parts.push(`${facts.pp} PP`);
    if (facts.priority !== 0) parts.push(`prioridad ${signedPriority(facts.priority)}`);
    const head = `${facts.name} es un movimiento de tipo ${facts.typeLabel}${category ? ` y categoría ${category}` : ''}.`;
    return parts.length ? `${head} Tiene ${joinList(parts, l)}.` : head;
  }

  const parts: string[] = [];
  if (facts.power != null) parts.push(`${facts.power} power`);
  if (facts.accuracy != null) parts.push(`${facts.accuracy}% accuracy`);
  if (facts.pp != null) parts.push(`${facts.pp} PP`);
  if (facts.priority !== 0) parts.push(`${signedPriority(facts.priority)} priority`);
  const head = `${facts.name} is a ${facts.typeLabel}-type${category ? ` ${category}` : ''} move`;
  return parts.length ? `${head} with ${joinList(parts, l)}.` : `${head}.`;
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: { name: string };
  version_group?: { name: string };
}

// Placeholders PokeAPI ships as "flavor text", none of which describes the move:
//  - the literal "Dummy data" on the 18 Z-move entries;
//  - Scarlet/Violet's boilerplate for moves the game no longer has ("This move
//    can't be used. It's recommended that this move is forgotten…"), which
//    would otherwise be the newest — and identical — text of ~150 moves.
// Filtered out so the next-newest real text (or the factual sentence) is used.
const PLACEHOLDER_RES: RegExp[] = [
  /^dummy data\.?$/i,
  /^this move can.t be used\./i,
  /^este movimiento no se puede usar/i,
];

/**
 * Real flavor text in exactly the requested language, or null. Picks the most
 * recent version group's wording (selectLocalizedFlavor); the oldest entries
 * are terse Gen 1 strings with hard-wrap soft hyphens. Deliberately no English
 * fallback on a Spanish page: the caller falls back to
 * buildMoveFactualDescription(), which is correct Spanish.
 */
export function getLocalizedMoveDescription(entries: FlavorTextEntry[] | undefined, lang: string): string | null {
  const usable = (entries ?? []).filter((e) => !PLACEHOLDER_RES.some((re) => re.test((e.flavor_text ?? '').trim())));
  const picked = selectLocalizedFlavor(usable, { entityType: 'move', requestedLang: safeLang(lang), fallbackLangs: [] });
  // A soft hyphen marks a hard-wrapped word ("criti\u00AD cal"): rejoin it.
  const text = picked?.text.replace(/\u00AD\s*/g, '').trim();
  return text || null;
}

/** Meta description: real localized text if there is one, else the factual sentence. */
export function resolveMoveDescription(
  lang: string,
  facts: MoveFacts,
  entries: FlavorTextEntry[] | undefined
): { text: string; source: 'flavor' | 'facts' } {
  const flavor = getLocalizedMoveDescription(entries, lang);
  return flavor ? { text: flavor, source: 'flavor' } : { text: buildMoveFactualDescription(lang, facts), source: 'facts' };
}
