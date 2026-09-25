// src/utils/items.ts
//
// Item-specific adapter over the centralized selection engine in
// src/services/localizedText.ts. See that module for the full root-cause
// analysis and the evidence-backed corruption policy.

import {
  selectLocalizedEffect,
  selectLocalizedFlavor,
  type EffectEntry,
  type FlavorEntry,
  type ProvenancedText,
} from '../services/localizedText';

export type { ProvenancedText } from '../services/localizedText';

import { withoutPlaceholderText } from './itemSeo';

const ENTITY_TYPE = 'item';

/**
 * Primary, technical description — sourced from effect_entries. Placeholder
 * and blank entries ("Unknown.", "[VAR (0000)]", whitespace-only) are
 * dropped first, so the selection can never return them.
 */
export function selectItemEffect(
  effectEntries: EffectEntry[] | undefined,
  lang: string
): ProvenancedText | null {
  return selectLocalizedEffect(withoutPlaceholderText(effectEntries), { entityType: ENTITY_TYPE, requestedLang: lang });
}

/** Secondary, narrative in-game description — sourced from flavor_text_entries. */
export function selectItemFlavor(
  flavorEntries: FlavorEntry[] | undefined,
  lang: string
): ProvenancedText | null {
  return selectLocalizedFlavor(withoutPlaceholderText(flavorEntries), { entityType: ENTITY_TYPE, requestedLang: lang });
}
