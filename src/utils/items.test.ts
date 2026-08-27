import { describe, it, expect } from 'vitest';
import { selectItemEffect, selectItemFlavor } from './items';
import { getLocalizedName } from '../services/pokeapi';

import lifeOrb from './__fixtures__/items/life-orb.json';
import assaultVest from './__fixtures__/items/assault-vest.json';
import heavyDutyBoots from './__fixtures__/items/heavy-duty-boots.json';

// Deep selection-policy tests (blocked combinations, order-independence,
// provenance, mega-stone swap chain, etc.) live in
// src/services/localizedText.test.ts. This file only pins down that the
// item-specific adapter wires entityType: 'item' correctly and that the
// public API the page imports (selectItemEffect/selectItemFlavor) behaves
// the same as calling the generic engine directly.
describe('selectItemEffect / selectItemFlavor — adapter wiring', () => {
  it('resolves identity: slug and localized names', () => {
    expect(assaultVest.name).toBe('assault-vest');
    expect(getLocalizedName(assaultVest.names as any, 'es')).toBe('Chaleco Asalto');
    expect(getLocalizedName(assaultVest.names as any, 'en')).toBe('Assault Vest');
  });

  it('scopes the corruption denylist to entityType "item" (assault-vest x-y is rejected)', () => {
    const flavor = selectItemFlavor(assaultVest.flavor_text_entries as any, 'es');
    expect(flavor!.text).not.toContain('Megapiedra');
    expect(flavor!.versionGroup).not.toBe('x-y');
  });

  it('effect falls back to EN with fallbackUsed=true when ES effect_entries are absent', () => {
    const effect = selectItemEffect(lifeOrb.effect_entries as any, 'es');
    expect(effect!.language).toBe('en');
    expect(effect!.fallbackUsed).toBe(true);
  });

  it('returns null (not a fabricated string) when an item has no effect_entries at all', () => {
    expect(selectItemEffect(heavyDutyBoots.effect_entries as any, 'es')).toBeNull();
  });
});
