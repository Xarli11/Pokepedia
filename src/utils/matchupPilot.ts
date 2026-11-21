// src/utils/matchupPilot.ts
//
// F6 Experiment 1 — controlled pilot of the type-matchup block on the
// Pokémon page. Design and rules: docs/audits/f6-experiment-1-design-2026-11-21.md
// and docs/experiments/f6-matchups-pilot.md.
//
// ONLY the 30 treatment species receive the block and the matched
// title/description. The 30 control species are listed here for the tests
// (and as the single recorded copy of the assignment): they must render
// exactly as before. The assignment is FIXED — it was drawn once, with a
// seeded random choice inside matched pairs (seed 20261121), and must not be
// re-drawn or rebalanced while the experiment runs.
//
// REMOVAL: when the experiment is decided, either empty MATCHUP_TREATMENT
// (rollback) or delete this file and the gate in utils/matchupCopy.ts
// (generalise to every species).

/** Canonical species slugs (the same slug as the page URL). */
export const MATCHUP_TREATMENT: readonly string[] = [
  'corviknight', 'muk', 'lucario', 'slowbro', 'grimmsnarl',
  'gyarados', 'shuckle', 'alakazam', 'scrafty', 'flygon',
  'malamar', 'ursaluna', 'flamigo', 'yveltal', 'gliscor',
  'hatterene', 'raichu', 'floette', 'aggron', 'regieleki',
  'dragonite', 'falinks', 'nidoqueen', 'steelix', 'baxcalibur',
  'skuntank', 'pinsir', 'abra', 'dragapult', 'scovillain',
];

/** Matched control group: never touched by the experiment. */
export const MATCHUP_CONTROL: readonly string[] = [
  'archaludon', 'gardevoir', 'froslass', 'tyranitar', 'machamp',
  'persian', 'hitmonlee', 'ludicolo', 'clefable', 'charizard',
  'weavile', 'exeggutor', 'hydreigon', 'iron-hands', 'goodra',
  'onix', 'haxorus', 'gengar', 'mightyena', 'tentacruel',
  'electrode', 'mawile', 'golem', 'noivern', 'kadabra',
  'blastoise', 'drampa', 'weezing', 'regirock', 'koffing',
];

const TREATMENT = new Set(MATCHUP_TREATMENT);

export function isMatchupTreatment(canonicalSlug: string): boolean {
  return TREATMENT.has(canonicalSlug);
}
