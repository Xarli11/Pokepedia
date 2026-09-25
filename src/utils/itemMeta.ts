// src/utils/itemMeta.ts
//
// Pure title / description builders for /objetos/{slug}/ pages.
//
// Before this, an item's meta description was its effect text — English on
// Spanish pages for the 954 items that only have an English effect — or its
// flavor text, and the title was "{name} | Objetos" (62 name collisions
// between game variants shared a title). Everything here comes from explicit
// PokeAPI fields; an effect is never inferred.

import { versionGroupRank } from '../services/versionGroups';
import { typeColors } from './pokemon';

export type ItemLang = 'es' | 'en';

const safeLang = (lang: string): ItemLang => (lang === 'en' ? 'en' : 'es');

export type MachineKind = 'tm' | 'tr' | 'hm';

export function machineKind(slug: string): MachineKind | null {
  if (/^tm\d+$/.test(slug)) return 'tm';
  if (/^tr\d+$/.test(slug)) return 'tr';
  if (/^hm\d+$/.test(slug)) return 'hm';
  return null;
}

const MACHINE_LABEL: Record<ItemLang, Record<MachineKind, string>> = {
  es: { tm: 'máquina técnica', tr: 'disco técnico', hm: 'máquina oculta' },
  en: { tm: 'Technical Machine', tr: 'Technical Record', hm: 'Hidden Machine' },
};

/**
 * The machine of the most recent version group. `machines[0]` is the OLDEST
 * (red-blue), which taught a different move for most TMs. Unknown version
 * groups rank lowest, so a recognized one always wins.
 */
export function pickLatestMachine<T extends { version_group: { name: string } }>(machines: T[] | undefined): T | null {
  const list = machines ?? [];
  if (list.length === 0) return null;
  return [...list].sort((a, b) => versionGroupRank(b.version_group.name) - versionGroupRank(a.version_group.name))[0];
}

export interface ItemFacts {
  /** Localized item name. */
  name: string;
  slug: string;
  /** Localized category label, only when a translation exists (never raw English on /es/). */
  categoryLabel?: string | null;
  /** Localized labels of the attributes that have a translation. */
  attributeLabels?: string[];
  flingPower?: number | null;
  cost?: number | null;
  /**
   * Move taught (machines), localized, from the machine of the most recent
   * game. Only stated together with that game: the same TM teaches other moves
   * in other games.
   */
  teaches?: { moveName: string; versionLabel?: string | null } | null;
  /** Localized type label of a Tera Shard (from its "{type}-tera-shard" name). */
  teraTypeLabel?: string | null;
}

/**
 * Machines are titled by number only. Most TMs teach a different move in
 * different games (160 of 230: TM26 is Earthquake in most games, Scary Face in
 * Sword/Shield, Energy Ball in Legends Z-A; up to 9 moves for one TM), so a
 * title naming one move would present a single game's move as universal. The
 * move, with its game, is in the description and on the page.
 */
export function buildItemTitle(lang: string, facts: Pick<ItemFacts, 'name' | 'slug'>): string {
  const l = safeLang(lang);
  const kind = machineKind(facts.slug);
  if (kind) return `${facts.name} — ${capitalize(MACHINE_LABEL[l][kind])} Pokémon`;
  return l === 'es' ? `${facts.name} — Objeto Pokémon` : `${facts.name} — Pokémon Item`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function join(items: string[], lang: ItemLang): string {
  if (items.length <= 1) return items.join('');
  const and = lang === 'es' ? 'y' : 'and';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/**
 * Factual sentence from explicit fields only. States no effect ("cura",
 * "aumenta", "heals"): the only mechanics it may mention are the move a
 * machine teaches and the Fling power, both explicit PokeAPI values.
 */
export function buildItemFactualDescription(lang: string, facts: ItemFacts): string {
  const l = safeLang(lang);
  const kind = machineKind(facts.slug);
  const sentences: string[] = [];

  if (kind) {
    const label = MACHINE_LABEL[l][kind];
    const article = kind === 'tr' ? 'un' : 'una'; // disco (m.) / máquina (f.)
    if (facts.teaches?.versionLabel) {
      const { moveName, versionLabel } = facts.teaches;
      sentences.push(
        l === 'es'
          ? `${facts.name} es ${article} ${label} que enseña ${moveName} en ${versionLabel}.`
          : `${facts.name} is a ${label} that teaches ${moveName} in ${versionLabel}.`
      );
    } else {
      sentences.push(l === 'es' ? `${facts.name} es ${article} ${label}.` : `${facts.name} is a ${label}.`);
    }
  } else if (facts.categoryLabel) {
    sentences.push(
      l === 'es'
        ? `${facts.name} es un objeto Pokémon de la categoría ${facts.categoryLabel}.`
        : `${facts.name} is a Pokémon item in the ${facts.categoryLabel} category.`
    );
  } else {
    sentences.push(l === 'es' ? `${facts.name} es un objeto Pokémon.` : `${facts.name} is a Pokémon item.`);
  }

  if (facts.teraTypeLabel) {
    sentences.push(l === 'es' ? `Tipo Tera: ${facts.teraTypeLabel}.` : `Tera type: ${facts.teraTypeLabel}.`);
  }
  if (facts.attributeLabels && facts.attributeLabels.length > 0) {
    sentences.push(
      l === 'es' ? `Propiedades: ${join(facts.attributeLabels, l)}.` : `Properties: ${join(facts.attributeLabels, l)}.`
    );
  }
  if (facts.flingPower) {
    sentences.push(l === 'es' ? `Su potencia con Lanzamiento es ${facts.flingPower}.` : `Its Fling power is ${facts.flingPower}.`);
  }
  if (facts.cost && facts.cost > 0) {
    sentences.push(l === 'es' ? `Precio de compra: ${facts.cost} ₽.` : `Purchase price: ${facts.cost} ₽.`);
  }
  return sentences.join(' ');
}

/**
 * Meta description (`source: 'text'` = the item's own text led by its name).
 * Machines with a resolved move use the factual sentence
 * (the item's own flavor / effect text can describe another generation's
 * move); otherwise real text in the page language, else the factual sentence
 * in that language — never English on a Spanish page.
 */
export function resolveItemDescription(
  lang: string,
  facts: ItemFacts,
  realText: string | null | undefined
): { text: string; source: 'text' | 'facts' } {
  const kind = machineKind(facts.slug);
  const clean = (realText ?? '').replace(/[\f\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean && !(kind && facts.teaches?.versionLabel)) {
    // Families share their in-game text by design (80 species candies, 36 mails,
    // 14 baking berries...): lead with the item name so every description is
    // its own, unless the text already names the item.
    const named = clean.toLowerCase().includes(facts.name.toLowerCase()) ? clean : `${facts.name}: ${clean}`;
    return { text: named, source: 'text' };
  }
  return { text: buildItemFactualDescription(lang, facts), source: 'facts' };
}

const MACHINE_VERSION_LABELS: Record<ItemLang, Record<string, string>> = {
  es: {
    'brilliant-diamond-shining-pearl': 'Diamante Brillante y Perla Reluciente',
    'sword-shield': 'Espada y Escudo',
    'scarlet-violet': 'Escarlata y Púrpura',
    'the-teal-mask': 'La Máscara Turquesa',
    'the-indigo-disk': 'El Disco Índigo',
    'legends-za': 'Leyendas Pokémon: Z-A',
    'mega-dimension': 'Mega Dimensión',
  },
  en: {
    'brilliant-diamond-shining-pearl': 'Brilliant Diamond & Shining Pearl',
    'sword-shield': 'Sword & Shield',
    'scarlet-violet': 'Scarlet & Violet',
    'the-teal-mask': 'The Teal Mask',
    'the-indigo-disk': 'The Indigo Disk',
    'legends-za': 'Pokémon Legends: Z-A',
    'mega-dimension': 'Mega Dimension',
  },
};

/** Version-group label for the game a machine belongs to; null when unknown (never a raw slug). */
export function machineVersionLabel(lang: string, versionGroup: string): string | null {
  return MACHINE_VERSION_LABELS[safeLang(lang)][versionGroup] ?? null;
}

/** Type slug of a Tera Shard from its "{type}-tera-shard" name, only if it is a Pokepedia type. */
export function teraShardType(slug: string): string | null {
  const m = /^([a-z]+)-tera-shard$/.exec(slug);
  return m && m[1] in typeColors ? m[1] : null;
}
