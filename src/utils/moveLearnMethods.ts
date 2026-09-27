// src/utils/moveLearnMethods.ts
//
// PokeAPI's `move-learn-method` values (verified live against the full list,
// 2026-09-27 — not just the four everyone remembers) and their ES/EN
// labels. `LEARN_METHOD_ORDER` is also the fixed index table the learnset
// dataset (scripts/generate-catalogs.ts --only=move-learnsets) encodes
// method as a small integer against — the single source of truth for both
// the generator and the runtime decoder, so they can't drift apart.
//
// PokeAPI has no `names` for this resource (verified live — every method
// is English-only in its own data), so ES labels are hand-written, same
// pattern as versionGroups.ts / gameContext.ts's target/ailment tables.
// The obscure ones (Stadium's surfing Pikachu minigame, Colosseum/XD
// purification, the Zygarde Cube, a Let's Go light-ball trade quirk) are
// real, rare PokeAPI values — not invented — kept so no relation is ever
// silently dropped for having an unrecognized method.

export const LEARN_METHOD_ORDER: readonly string[] = [
  'level-up',
  'machine',
  'egg',
  'tutor',
  'train',
  'xd-purification',
  'stadium-surfing-pikachu',
  'light-ball-egg',
  'form-change',
  'zygarde-cube',
  'colosseum-purification',
];

const METHOD_LABEL_ES: Readonly<Record<string, string>> = {
  'level-up': 'Nivel',
  machine: 'MT/MO/TR',
  egg: 'Huevo',
  tutor: 'Tutor',
  train: 'Entrenamiento',
  'xd-purification': 'Purificación (XD)',
  'stadium-surfing-pikachu': 'Pikachu surfista (Stadium)',
  'light-ball-egg': 'Bola Luminosa (huevo)',
  'form-change': 'Cambio de forma',
  'zygarde-cube': 'Cubo Zygarde',
  'colosseum-purification': 'Purificación (Colosseum)',
};

const METHOD_LABEL_EN: Readonly<Record<string, string>> = {
  'level-up': 'Level-up',
  machine: 'TM/HM/TR',
  egg: 'Egg',
  tutor: 'Tutor',
  train: 'Training',
  'xd-purification': 'Purification (XD)',
  'stadium-surfing-pikachu': 'Surfing Pikachu (Stadium)',
  'light-ball-egg': 'Light Ball (egg)',
  'form-change': 'Form change',
  'zygarde-cube': 'Zygarde Cube',
  'colosseum-purification': 'Purification (Colosseum)',
};

/** ES/EN label for a learn method; a formatted slug for a genuinely unknown one (never dropped). */
export function learnMethodLabel(method: string, lang: string): string {
  const table = lang === 'en' ? METHOD_LABEL_EN : METHOD_LABEL_ES;
  return table[method] ?? method.replace(/-/g, ' ');
}

export function learnMethodIndex(method: string): number {
  return LEARN_METHOD_ORDER.indexOf(method);
}

export function learnMethodByIndex(index: number): string {
  return LEARN_METHOD_ORDER[index] ?? 'level-up';
}
