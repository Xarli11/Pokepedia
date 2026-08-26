import { describe, it, expect } from 'vitest';
import {
  uiTranslations,
  typeTranslations,
  evolutionTranslations,
  methodTranslations,
  encounterTranslations,
  itemTranslations,
} from './pokemon';

// Regression guard for P0 #14 (locale leaks): most `t.key` lookups across
// the codebase follow the pattern `dict[lang]?.key || dict.es.key`, which
// means a key present in `es` but missing in `en` silently renders Spanish
// text on English pages instead of throwing or visibly breaking. Structural
// key-parity is a cheap, durable way to catch that class of bug without
// having to enumerate every page.
const DICTIONARIES: Record<string, Record<string, Record<string, string>>> = {
  uiTranslations,
  typeTranslations,
  evolutionTranslations,
  methodTranslations,
  encounterTranslations,
  itemTranslations,
};

describe('translation dictionaries — ES/EN key parity', () => {
  for (const [dictName, dict] of Object.entries(DICTIONARIES)) {
    it(`${dictName}: every ES key has an EN counterpart and vice versa`, () => {
      const esKeys = new Set(Object.keys(dict.es || {}));
      const enKeys = new Set(Object.keys(dict.en || {}));

      const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
      const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));

      expect(missingInEn, `keys present in es but missing in en: ${missingInEn.join(', ')}`).toEqual([]);
      expect(missingInEs, `keys present in en but missing in es: ${missingInEs.join(', ')}`).toEqual([]);
    });
  }
});
