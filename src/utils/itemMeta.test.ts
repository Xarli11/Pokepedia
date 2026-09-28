import { describe, it, expect } from 'vitest';
import {
  buildItemFactualDescription,
  buildItemTitle,
  machineKind,
  machineVersionLabel,
  pickLatestMachine,
  resolveItemDescription,
  teraShardType,
  type ItemFacts,
} from './itemMeta';

const leftovers: ItemFacts = { name: 'Restos', slug: 'leftovers', categoryLabel: 'Objetos Equipables', attributeLabels: ['Equipable'], flingPower: 10 };
const leftoversEn: ItemFacts = { ...leftovers, name: 'Leftovers', categoryLabel: 'Held Items', attributeLabels: ['Holdable'] };
const tm26: ItemFacts = { name: 'MT26', slug: 'tm26', teaches: { moveName: 'Terremoto', versionLabel: 'Escarlata y Púrpura' } };
const tr01: ItemFacts = { name: 'DT01', slug: 'tr01', teaches: { moveName: 'Golpe Cuerpo', versionLabel: null } };

describe('buildItemTitle', () => {
  it('ES / EN, plain item', () => {
    expect(buildItemTitle('es', leftovers)).toBe('Restos — Objeto Pokémon');
    expect(buildItemTitle('en', leftoversEn)).toBe('Leftovers — Pokémon Item');
  });

  it('machines are titled by number, never by one game\'s move (160 of 230 TMs teach different moves per game)', () => {
    expect(buildItemTitle('es', tm26)).toBe('MT26 — Máquina técnica Pokémon');
    expect(buildItemTitle('en', { name: 'TM26', slug: 'tm26' })).toBe('TM26 — Technical Machine Pokémon');
    expect(buildItemTitle('es', tr01)).toBe('DT01 — Disco técnico Pokémon');
    expect(buildItemTitle('en', { name: 'HM01', slug: 'hm01' })).toBe('HM01 — Hidden Machine Pokémon');
  });

  it('the title is identical whether or not the move could be resolved (no move-dependent title)', () => {
    expect(buildItemTitle('es', tm26)).toBe(buildItemTitle('es', { name: 'MT26', slug: 'tm26' }));
    expect(buildItemTitle('es', tm26)).not.toContain('Terremoto');
  });

  it('does not carry the brand (Layout appends it)', () => {
    expect(buildItemTitle('en', leftoversEn)).not.toMatch(/pokepedia/i);
  });
});

describe('buildItemFactualDescription', () => {
  it('ES / EN from category, attributes and fling power only', () => {
    expect(buildItemFactualDescription('es', leftovers)).toBe(
      'Restos es un objeto Pokémon de la categoría Objetos Equipables. Propiedades: Equipable. Su potencia con Lanzamiento es 10.'
    );
    expect(buildItemFactualDescription('en', leftoversEn)).toBe(
      'Leftovers is a Pokémon item in the Held Items category. Properties: Holdable. Its Fling power is 10.'
    );
  });

  it('states no effect: only the machine move / fling power are mechanics', () => {
    const text = buildItemFactualDescription('es', leftovers) + buildItemFactualDescription('en', leftoversEn);
    expect(text).not.toMatch(/cura|restaura|aumenta|heals|restores|raises|boosts/i);
  });

  it('no category translation: a plain sentence, never a raw English category on /es/', () => {
    expect(buildItemFactualDescription('es', { name: 'Teralito Normal', slug: 'normal-tera-shard' })).toBe('Teralito Normal es un objeto Pokémon.');
  });

  it('machines: TM (una máquina), TR (un disco), HM; the move is only ever stated together with its game', () => {
    expect(buildItemFactualDescription('es', tm26)).toBe('MT26 es una máquina técnica que enseña Terremoto en Escarlata y Púrpura.');
    // No known game -> no move claim: it could be a different move in another game.
    expect(buildItemFactualDescription('es', tr01)).toBe('DT01 es un disco técnico.');
    expect(buildItemFactualDescription('es', tr01)).not.toContain('Golpe Cuerpo');
    expect(buildItemFactualDescription('en', { name: 'HM01', slug: 'hm01', teaches: { moveName: 'Cut', versionLabel: 'Sword & Shield' } })).toBe(
      'HM01 is a Hidden Machine that teaches Cut in Sword & Shield.'
    );
    expect(buildItemFactualDescription('es', { name: 'MT26', slug: 'tm26' })).toBe('MT26 es una máquina técnica.');
  });

  it('cost only when PokeAPI provides it (it currently does not)', () => {
    expect(buildItemFactualDescription('en', { ...leftoversEn, cost: 200 })).toContain('Purchase price: 200 ₽.');
    expect(buildItemFactualDescription('en', { ...leftoversEn, cost: undefined })).not.toContain('price');
    expect(buildItemFactualDescription('en', { ...leftoversEn, cost: 0 })).not.toContain('price');
  });

  it('never leaks null / undefined', () => {
    const d = buildItemFactualDescription('es', { name: 'X', slug: 'x', flingPower: null, cost: null, attributeLabels: [] });
    expect(d).toBe('X es un objeto Pokémon.');
    expect(d).not.toMatch(/null|undefined|NaN/);
  });
});

describe('resolveItemDescription', () => {
  it('real text in the page language, led by the item name so shared family text stays unique', () => {
    const r = resolveItemDescription('es', leftovers, 'Restaura PS cada turno.');
    expect(r).toEqual({ text: 'Restos: Restaura PS cada turno.', source: 'text' });
    expect(resolveItemDescription('es', leftovers, 'Restos restaura PS.').text).toBe('Restos restaura PS.');
  });

  it('no text in the page language -> factual sentence in that language (never English on /es/)', () => {
    const r = resolveItemDescription('es', leftovers, null);
    expect(r.source).toBe('facts');
    expect(r.text).toMatch(/^Restos es un objeto Pokémon/);
    expect(resolveItemDescription('en', leftoversEn, '  ').source).toBe('facts');
  });

  it('a machine with a move but no known game keeps the item\'s own text (no unqualified move claim)', () => {
    const r = resolveItemDescription('es', tr01, 'Salta sobre el objetivo.');
    expect(r).toEqual({ text: 'DT01: Salta sobre el objetivo.', source: 'text' });
  });

  it('a machine with a resolved move uses the factual sentence, not its own (possibly other-generation) text', () => {
    const r = resolveItemDescription('es', tm26, 'Enseña Puño Certero a un Pokémon compatible.');
    expect(r.source).toBe('facts');
    expect(r.text).toContain('Terremoto');
  });

  it('a machine whose move could not be resolved keeps real text when it has one', () => {
    expect(resolveItemDescription('en', { name: 'TM26', slug: 'tm26' }, 'Teaches a move.').source).toBe('text');
  });
});

describe('machines', () => {
  it('machineKind', () => {
    expect(machineKind('tm26')).toBe('tm');
    expect(machineKind('tr01')).toBe('tr');
    expect(machineKind('hm01')).toBe('hm');
    expect(machineKind('tm-materials')).toBeNull();
    expect(machineKind('leftovers')).toBeNull();
  });

  it('pickLatestMachine takes the most recent version group, not machines[0] (the oldest)', () => {
    const machines = [
      { version_group: { name: 'red-blue' }, id: 1 },
      { version_group: { name: 'legends-za' }, id: 4 },
      { version_group: { name: 'scarlet-violet' }, id: 3 },
      { version_group: { name: 'sword-shield' }, id: 2 },
    ];
    expect(pickLatestMachine(machines)?.id).toBe(4);
    expect(pickLatestMachine(machines.slice(0, 1))?.id).toBe(1);
    expect(pickLatestMachine([])).toBeNull();
    expect(pickLatestMachine(undefined)).toBeNull();
  });

  it('an unrecognized version group ranks below every known one', () => {
    const machines = [{ version_group: { name: 'unreleased-game' }, id: 9 }, { version_group: { name: 'red-blue' }, id: 1 }];
    expect(pickLatestMachine(machines)?.id).toBe(1);
  });

  it('version labels exist for the recent groups, null (not a raw slug) otherwise', () => {
    expect(machineVersionLabel('es', 'scarlet-violet')).toBe('Escarlata y Púrpura');
    expect(machineVersionLabel('en', 'legends-za')).toBe('Pokémon Legends: Z-A');
    expect(machineVersionLabel('es', 'red-blue')).toBeNull();
  });
});

describe('tera shards', () => {
  it('derive their type from the "{type}-tera-shard" name, only for real types', () => {
    expect(teraShardType('water-tera-shard')).toBe('water');
    expect(teraShardType('fairy-tera-shard')).toBe('fairy');
    expect(teraShardType('stellar-tera-shard')).toBeNull(); // no Pokepedia type page
    expect(teraShardType('tera-shard')).toBeNull();
    expect(teraShardType('leftovers')).toBeNull();
  });

  it('the factual sentence names the Tera type', () => {
    expect(
      buildItemFactualDescription('es', { name: 'Teralito Agua', slug: 'water-tera-shard', categoryLabel: 'Teralitos', teraTypeLabel: 'Agua' })
    ).toBe('Teralito Agua es un objeto Pokémon de la categoría Teralitos. Tipo Tera: Agua.');
    expect(
      buildItemFactualDescription('en', { name: 'Water Tera Shard', slug: 'water-tera-shard', categoryLabel: 'Tera Shards', teraTypeLabel: 'Water' })
    ).toBe('Water Tera Shard is a Pokémon item in the Tera Shards category. Tera type: Water.');
  });
});
