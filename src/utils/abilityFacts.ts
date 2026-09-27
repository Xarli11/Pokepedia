// src/utils/abilityFacts.ts
//
// Facts for /habilidades/{slug}/ pages: generation, main-series flag, the
// mechanical effect vs. flavor text distinction, and historical
// (`effect_changes`) changes — normalized from PokeAPI's `ability`
// resource, all fields already fetched by getAbilityDetailByName().

export interface AbilityEffectText {
  text: string;
  /** 'effect' = mechanical explanation; 'flavor' = in-game descriptive blurb, not a substitute for it. */
  source: 'effect' | 'flavor';
}

interface LangText { language: { name: string } }
interface RawEffectEntry extends LangText { effect: string; short_effect?: string }
interface RawFlavorEntry extends LangText { flavor_text: string }

/**
 * The mechanical effect in the requested language if PokeAPI has it;
 * otherwise English mechanical effect (labelled honestly, never silently
 * swapped for flavor text); otherwise the requested language's flavor text;
 * otherwise English flavor text. Never machine-translated at runtime.
 */
export function resolveAbilityEffect(
  lang: string,
  effectEntries: readonly RawEffectEntry[] | undefined,
  flavorEntries: readonly RawFlavorEntry[] | undefined
): AbilityEffectText | null {
  const effect = (l: string) => effectEntries?.find((e) => e.language.name === l);
  const flavor = (l: string) => flavorEntries?.find((e) => e.language.name === l);

  const reqEffect = effect(lang);
  if (reqEffect) return { text: clean(reqEffect.effect), source: 'effect' };
  const enEffect = lang !== 'en' ? effect('en') : null;
  if (enEffect) return { text: clean(enEffect.effect), source: 'effect' };
  const reqFlavor = flavor(lang);
  if (reqFlavor) return { text: clean(reqFlavor.flavor_text), source: 'flavor' };
  const enFlavor = lang !== 'en' ? flavor('en') : null;
  if (enFlavor) return { text: clean(enFlavor.flavor_text), source: 'flavor' };
  return null;
}

function clean(text: string): string {
  return text.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface AbilityHistoryEntry {
  versionGroup: string;
  /** The effect text that held through versionGroup, in whatever language PokeAPI has for it. */
  effect: string;
}

/**
 * `effect_changes` in the requested language when available, English
 * otherwise (never dropped just because the requested language is
 * missing — PokeAPI's ES coverage for this field is inconsistent per
 * ability, verified live: some abilities have es effect_changes text,
 * many don't).
 */
export function abilityHistory(
  lang: string,
  raw: readonly { version_group: { name: string }; effect_entries: readonly RawEffectEntry[] }[] | undefined
): AbilityHistoryEntry[] {
  return (raw ?? [])
    .map((change) => {
      const entry = change.effect_entries.find((e) => e.language.name === lang) ?? change.effect_entries.find((e) => e.language.name === 'en');
      return entry ? { versionGroup: change.version_group.name, effect: clean(entry.effect) } : null;
    })
    .filter((x): x is AbilityHistoryEntry => x !== null);
}
