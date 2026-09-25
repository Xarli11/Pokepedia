import { describe, it, expect } from 'vitest';
import {
  classifyItemFamily,
  findDuplicateNameVariants,
  getItemQualitySignals,
  getItemSeoPolicy,
  isEntirelyThinFamily,
  isPlaceholderName,
  isPlaceholderText,
  itemQualityScore,
  summarizeFamilies,
  type ItemSeoInput,
} from './itemSeo';
import { selectItemEffect, selectItemFlavor } from './items';

const names = (es: string, en: string) => [
  { name: es, language: { name: 'es' } },
  { name: en, language: { name: 'en' } },
];
const flavor = (lang: string, text: string) => ({ text, language: { name: lang }, version_group: { name: 'sword-shield' } });
const effect = (lang: string, text: string) => ({ effect: text, short_effect: text, language: { name: lang } });

// Shapes taken from live PokeAPI data (2026-09-25).
const leftovers: ItemSeoInput = {
  name: 'leftovers',
  category: { name: 'held-items' },
  names: names('Restos', 'Leftovers'),
  flavor_text_entries: [flavor('es', 'Restaura PS.'), flavor('en', 'Restores HP.')],
  sprites: { default: 'x.png' },
  attributes: [{ name: 'holdable' }],
};
const dynamax: ItemSeoInput = {
  name: 'dynamax-crystal-and15',
  category: { name: 'dynamax-crystals' },
  names: names('★And15', '★And15'),
  flavor_text_entries: [
    flavor('es', 'Posibilita la aparición de [VAR (0000)] en el nido\nDinamax.'),
    flavor('en', 'An item that causes [VAR (0000)] to appear from\nthe Watchtower Lair.'),
  ],
  sprites: { default: null },
  attributes: [],
};
const teraShard: ItemSeoInput = {
  name: 'normal-tera-shard',
  category: { name: 'tera-shard' },
  names: names('Teralito Normal', 'Normal Tera Shard'),
  sprites: { default: null },
};
const boosterEnergy: ItemSeoInput = {
  name: 'booster-energy',
  category: { name: 'held-items' },
  names: names('Energía Potenciadora', 'Booster Energy'),
  sprites: { default: null },
};
const tmNoText: ItemSeoInput = {
  name: 'tm26',
  category: { name: 'all-machines' },
  names: names('MT26', 'TM26'),
  sprites: { default: 'tm.png' },
  machines: [{ version_group: { name: 'scarlet-violet' } }],
};
const dataCard: ItemSeoInput = {
  name: 'data-card-01',
  category: { name: 'data-cards' },
  names: names('Tarjeta Datos 01', 'Data Card 01'),
  flavor_text_entries: [flavor('es', 'Contiene los datos del Pokéathlon.'), flavor('en', 'It holds Pokéathlon records.')],
  effect_entries: [effect('en', 'Records the number of times the trainer has come in first place.')],
  sprites: { default: 'card.png' },
};

describe('placeholder detection', () => {
  it.each([
    ['[VAR (0000)] appears in the nest', true],
    ['Dummy Data', true],
    ['dummy data', true],
    ['Unknown.', true],
    ['Unknown.  Currently unused.', true],
    ['Unused.', true],
    ['XXX new effect for bike--yellow', true],
    ['-\n-\n-', true],
    ['  \f ', true],
    ['???', true],
    ['', true],
    ['Restores 20 HP.', false],
    ['A ticket for an unused route, kept as a memento.', false],
    ['Un objeto de origen desconocido que brilla.', false],
  ])('isPlaceholderText(%j) = %s', (text, expected) => {
    expect(isPlaceholderText(text)).toBe(expected);
  });

  it('internal names such as ★And15 are not human names', () => {
    expect(isPlaceholderName('★And15')).toBe(true);
    expect(isPlaceholderName('Restos')).toBe(false);
  });

  it('selectItemEffect / selectItemFlavor never return a placeholder, falling back to real text', () => {
    const entries = [
      { text: '[VAR (0000)] stuff', language: { name: 'en' }, version_group: { name: 'sword-shield' } },
      { text: 'Real older text.', language: { name: 'en' }, version_group: { name: 'red-blue' } },
    ];
    expect(selectItemFlavor(entries as any, 'en')?.text).toBe('Real older text.');
    expect(selectItemFlavor([entries[0]] as any, 'en')).toBeNull();
    const eff = [
      { effect: 'Unused.', short_effect: 'Unknown.', language: { name: 'en' } },
    ];
    expect(selectItemEffect(eff as any, 'en')).toBeNull();
    // "Unused." long effect with a real short_effect: the short_effect is what is shown.
    const real = [{ effect: 'Unused.', short_effect: 'Holds ten Seals.', language: { name: 'en' } }];
    expect(selectItemEffect(real as any, 'en')?.text).toBe('Holds ten Seals.');
  });
});

describe('classifyItemFamily', () => {
  it('splits machines and prefix families, otherwise uses the PokeAPI category', () => {
    expect(classifyItemFamily('tm26', 'all-machines')).toBe('tm');
    expect(classifyItemFamily('tr01', 'all-machines')).toBe('tr');
    expect(classifyItemFamily('hm01', 'all-machines')).toBe('hm');
    expect(classifyItemFamily('dynamax-crystal-and15', 'dynamax-crystals')).toBe('dynamax-crystal');
    expect(classifyItemFamily('data-card-01', 'data-cards')).toBe('data-card');
    expect(classifyItemFamily('leftovers', 'held-items')).toBe('held-items');
    expect(classifyItemFamily('x')).toBe('uncategorized');
  });
});

describe('quality signals', () => {
  it('reads descriptions per language, ignoring placeholders', () => {
    expect(getItemQualitySignals(leftovers)).toMatchObject({ descriptionEs: true, descriptionEn: true, hasSprite: true, hasAttributes: true });
    const s = getItemQualitySignals(dynamax);
    expect(s.descriptionEs).toBe(false);
    expect(s.descriptionEn).toBe(false);
    expect(s.placeholderFields).toEqual(expect.arrayContaining(['flavor:es', 'flavor:en', 'name:es', 'name:en']));
  });

  it('counts a machine as a relation', () => {
    expect(getItemQualitySignals(tmNoText).hasRelation).toBe(true);
    expect(itemQualityScore(tmNoText)).toBe(2); // sprite + relation
  });
});

describe('getItemSeoPolicy', () => {
  it('A: real description in ES and EN -> index', () => {
    const p = getItemSeoPolicy(leftovers);
    expect(p).toMatchObject({ decision: 'index', indexable: true, family: 'held-items', thin: false });
  });

  it('data cards (suspected historically) have distinct real text -> index', () => {
    expect(getItemSeoPolicy(dataCard).decision).toBe('index');
  });

  it('B: a description in only one language -> index + improve (localized fallback)', () => {
    const enOnly = { ...leftovers, flavor_text_entries: [flavor('en', 'Restores HP.')] };
    const p = getItemSeoPolicy(enOnly);
    expect(p.decision).toBe('index-improve');
    expect(p.reason).toMatch(/only in EN/);
  });

  it('B: TM/TR without any text but with a sprite and a machine relation -> index + improve, never thin', () => {
    const p = getItemSeoPolicy(tmNoText);
    expect(p).toMatchObject({ decision: 'index-improve', family: 'tm', thin: false });
  });

  it('C: placeholder-only family with no other data -> noindex, given family evidence', () => {
    const family = { size: 300, thin: 300 };
    const p = getItemSeoPolicy(dynamax, family);
    expect(p).toMatchObject({ decision: 'noindex', indexable: false, family: 'dynamax-crystal', thin: true });
    expect(p.reason).toMatch(/300\/300 thin/);
    expect(p.reason).toMatch(/placeholder text only/);
  });

  it('C: a name-and-category-only family (tera shards) -> noindex', () => {
    expect(getItemSeoPolicy(teraShard, { size: 18, thin: 18 }).decision).toBe('noindex');
  });

  it('a thin item WITHOUT family evidence is never noindexed (conservative)', () => {
    expect(getItemSeoPolicy(dynamax).decision).toBe('index-improve');
  });

  it('one data gap inside a documented family (Booster Energy, 11 of 72) stays indexable', () => {
    const p = getItemSeoPolicy(boosterEnergy, { size: 72, thin: 11 });
    expect(p).toMatchObject({ decision: 'index-improve', indexable: true, thin: true });
    expect(p.reason).toMatch(/data gap/);
  });

  it('family threshold: >= 5 members and >= 90% thin', () => {
    expect(isEntirelyThinFamily({ size: 5, thin: 5 })).toBe(true);
    expect(isEntirelyThinFamily({ size: 10, thin: 9 })).toBe(true);
    expect(isEntirelyThinFamily({ size: 10, thin: 8 })).toBe(false);
    expect(isEntirelyThinFamily({ size: 4, thin: 4 })).toBe(false); // too few to call it a family
    expect(isEntirelyThinFamily(undefined)).toBe(false);
  });

  it('summarizeFamilies counts thin members per family', () => {
    const map = summarizeFamilies([leftovers, boosterEnergy, dynamax, { ...dynamax, name: 'dynamax-crystal-and458' }, tmNoText]);
    expect(map.get('held-items')).toEqual({ size: 2, thin: 1 });
    expect(map.get('dynamax-crystal')).toEqual({ size: 2, thin: 2 });
    expect(map.get('tm')).toEqual({ size: 1, thin: 0 });
  });
});

describe('findDuplicateNameVariants', () => {
  const id = (name: string, es: string, en: string, quality = 0) => ({ name, names: names(es, en), quality });

  it('keeps one primary per identical ES+EN name; the game-specific variants point to it', () => {
    const v = findDuplicateNameVariants([
      id('ultra-ball', 'Ultra Ball', 'Ultra Ball'),
      id('laultra-ball', 'Ultra Ball', 'Ultra Ball'),
      id('storage-key', 'Llave Almacén', 'Storage Key'),
      id('storage-key--galactic-warehouse', 'Llave Almacén', 'Storage Key'),
      id('storage-key--sea-mauville', 'Llave Almacén', 'Storage Key'),
      id('leftovers', 'Restos', 'Leftovers'),
    ]);
    expect(Object.fromEntries(v)).toEqual({
      'laultra-ball': 'ultra-ball',
      'storage-key--galactic-warehouse': 'storage-key',
      'storage-key--sea-mauville': 'storage-key',
    });
  });

  it('richer data wins over the slug (both Z-crystal variants have text; the one with more data is primary)', () => {
    const v = findDuplicateNameVariants([
      id('firium-z--held', 'Pirostal Z', 'Firium Z', 3),
      id('firium-z--bag', 'Pirostal Z', 'Firium Z', 2),
    ]);
    expect([...v]).toEqual([['firium-z--bag', 'firium-z--held']]);
  });

  it('names that only collide in one language are different items, not variants', () => {
    expect(findDuplicateNameVariants([id('bicycle', 'Bici', 'Bicycle'), id('bike--green', 'Bici', 'Bike')]).size).toBe(0);
  });

  it('items without a human name are never grouped', () => {
    expect(findDuplicateNameVariants([id('a', '★And15', '★And15'), id('b', '★And15', '★And15')]).size).toBe(0);
    expect(findDuplicateNameVariants([{ name: 'x' }, { name: 'y' }]).size).toBe(0);
  });
});
