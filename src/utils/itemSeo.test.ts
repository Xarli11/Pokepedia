import { describe, it, expect } from 'vitest';
import {
  classifyItemFamily,
  findDuplicateNameVariants,
  getItemQualitySignals,
  getItemSeoPolicy,
  isPlaceholderName,
  isPlaceholderText,
  itemQualityScore,
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

// Shapes from live PokeAPI data (2026-09-25) for the families the audit reviewed.
const xxxOnly: ItemSeoInput = {
  name: 'bike--yellow',
  category: { name: 'unused' },
  names: names('Bici', 'Bike'),
  effect_entries: [effect('en', 'XXX new effect for bike--yellow')],
  sprites: { default: null },
};
const unknownStone: ItemSeoInput = {
  name: 'god-stone',
  category: { name: 'unused' },
  names: names('Piedra divina', 'god stone'),
  effect_entries: [effect('en', 'Unknown.  Currently unused.')],
  sprites: { default: 'stone.png' },
};
const petal: ItemSeoInput = {
  // 87 "unused" key items: real flavor ES+EN + sprite, only the effect is an "XXX" stub.
  name: 'yellow-petal',
  category: { name: 'unused' },
  names: names('Pétalo amarillo', 'Yellow Petal'),
  flavor_text_entries: [flavor('es', 'Pétalo prensado.'), flavor('en', 'A pressed flower petal.')],
  effect_entries: [effect('en', 'XXX new effect for yellow-petal')],
  sprites: { default: 'petal.png' },
};
const pocket: ItemSeoInput = {
  name: 'battle-pocket',
  category: { name: 'unused' },
  names: names('Bolsillo de combate', 'Battle Pocket'),
  flavor_text_entries: [flavor('es', ''), flavor('en', '-\n-\n-')],
  sprites: { default: null },
};
const pickedNamed = (name: string, category: string, es: string, en: string): ItemSeoInput => ({
  name,
  category: { name: category },
  names: names(es, en),
  sprites: { default: null },
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

  it('C: dynamax crystals are system data (internal name + placeholder text + nothing else) -> noindex', () => {
    const p = getItemSeoPolicy(dynamax);
    expect(p).toMatchObject({ decision: 'noindex', indexable: false, family: 'dynamax-crystal', thin: true });
    expect(p.reason).toMatch(/system data/);
  });

  describe('"XXX new effect" and "Unknown." are placeholders, never content', () => {
    it('an XXX stub is not a description and not a supporting signal', () => {
      const s = getItemQualitySignals(xxxOnly);
      expect(s.descriptionEs).toBe(false);
      expect(s.descriptionEn).toBe(false);
      expect(s.placeholderFields).toContain('effect:en');
    });

    it('"Unknown. Currently unused." is not a description either', () => {
      const s = getItemQualitySignals(unknownStone);
      expect(s.descriptionEn).toBe(false);
      expect(s.placeholderFields).toContain('effect:en');
    });

    it('an XXX-only item is judged thin, not documented by its stub', () => {
      expect(getItemSeoPolicy(xxxOnly).thin).toBe(true);
    });

    it('an item whose only "description" is an XXX stub is never given that text as description', () => {
      expect(selectItemEffect(xxxOnly.effect_entries as any, 'en')).toBeNull();
      expect(selectItemEffect(unknownStone.effect_entries as any, 'en')).toBeNull();
    });

    it('the 87 unused key items with real flavor text stay indexable: the description comes from the flavor, not the stub', () => {
      const p = getItemSeoPolicy(petal);
      expect(p).toMatchObject({ decision: 'index', thin: false });
      expect(selectItemEffect(petal.effect_entries as any, 'en')).toBeNull();
      expect(selectItemFlavor(petal.flavor_text_entries as any, 'en')?.text).toBe('A pressed flower petal.');
    });
  });

  describe('category "unused" (122 items): decided per item, not per family', () => {
    it('bag-UI pockets (blank / dash-only text, no sprite) -> noindex,follow', () => {
      const p = getItemSeoPolicy(pocket);
      expect(p).toMatchObject({ decision: 'noindex', thin: true });
      expect(p.reason).toMatch(/game-internal category "unused"/);
    });

    it('a documented unused item (Rule Book: real text + sprite) -> index', () => {
      expect(getItemSeoPolicy(petal).indexable).toBe(true);
    });

    it('stub-only unused items (XXX / Unknown. and no flavor) are thin: noindex, because of their category', () => {
      expect(getItemSeoPolicy(xxxOnly).decision).toBe('noindex');
      expect(getItemSeoPolicy(unknownStone).decision).toBe('noindex'); // a sprite alone is 1 signal
    });

    it('the real god-stone has flavor text next to its "Unknown." stub: index + improve, from the flavor', () => {
      const withFlavor = { ...unknownStone, flavor_text_entries: [flavor('en', 'A rare stone.')] };
      expect(getItemSeoPolicy(withFlavor)).toMatchObject({ decision: 'index-improve', thin: false });
    });
  });

  describe('name-only families are real entities: index + improve, not noindex', () => {
    it.each([
      ['tera-shard', pickedNamed('water-tera-shard', 'tera-shard', 'Teralito Agua', 'Water Tera Shard')],
      ['tm-materials', pickedNamed('psyduck-down', 'tm-materials', 'Plumón de Psyduck', 'Psyduck Down')],
      ['picnic', pickedNamed('academy-bottle', 'picnic', 'Termo Academia', 'Academy Bottle')],
      ['sandwich-ingredients', pickedNamed('baguette', 'sandwich-ingredients', 'Barra de Pan', 'Baguette')],
    ])('%s: distinct real entity with a specific name -> index + improve', (family, item) => {
      const p = getItemSeoPolicy(item);
      expect(p).toMatchObject({ decision: 'index-improve', indexable: true, thin: true, family });
      expect(p.reason).toMatch(/data debt/);
    });

    it('Booster Energy (a held item with no PokeAPI text) stays indexable', () => {
      expect(getItemSeoPolicy(boosterEnergy)).toMatchObject({ decision: 'index-improve', indexable: true, thin: true });
    });

    it('an unnamed thin item outside game-internal categories is still not noindexed (Z-A mega stone)', () => {
      const megaStone: ItemSeoInput = { name: 'meganiumite', category: { name: 'mega-stones' }, sprites: { default: null } };
      expect(getItemSeoPolicy(megaStone).indexable).toBe(true);
    });
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
