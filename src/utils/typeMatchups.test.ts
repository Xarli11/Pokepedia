import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/types/type-chart.json';
import {
  MATCHUP_LEVELS,
  TYPE_CHART_GENERATION,
  TYPE_NAMES,
  damageMultiplier,
  elementalMultiplier,
  formatMultiplier,
  isTypeName,
  matchupsFor,
  type ElementalMultiplier,
  type TypeName,
} from './typeMatchups';

// The matrix is written attacker-first in typeMatchups.ts. The fixture is a
// frozen PokeAPI snapshot, defender-first (what each type RECEIVES): an
// independent encoding of the same chart, so these tests check the table
// against a second source instead of against itself. Deterministic — no
// network at test time.

type Relations = Record<string, { double_damage_from: string[]; half_damage_from: string[]; no_damage_from: string[] }>;
const relations = fixture.relations as Relations;

/** Defender-first fixture -> multiplier of `attacker` against `defender`. */
function fixtureMultiplier(attacker: TypeName, defender: TypeName): ElementalMultiplier {
  const r = relations[defender];
  if (r.no_damage_from.includes(attacker)) return 0;
  if (r.double_damage_from.includes(attacker)) return 2;
  if (r.half_damage_from.includes(attacker)) return 0.5;
  return 1;
}

describe('type chart: scope', () => {
  it('declares the modern chart (Generation VI onwards)', () => {
    expect(TYPE_CHART_GENERATION).toBe(6);
  });

  it('has exactly the 18 types, unique, including Fairy', () => {
    expect(TYPE_NAMES).toHaveLength(18);
    expect(new Set(TYPE_NAMES).size).toBe(18);
    expect(TYPE_NAMES).toContain('fairy');
    expect(Object.keys(relations).sort()).toEqual([...TYPE_NAMES].sort());
  });
});

describe('type chart: all 324 elemental interactions', () => {
  it('checks 18 x 18 = 324 cells and every one matches the PokeAPI snapshot', () => {
    let checked = 0;
    const mismatches: string[] = [];
    for (const attacker of TYPE_NAMES) {
      for (const defender of TYPE_NAMES) {
        checked++;
        const got = elementalMultiplier(attacker, defender);
        const want = fixtureMultiplier(attacker, defender);
        if (got !== want) mismatches.push(`${attacker}->${defender}: got ${got}, want ${want}`);
      }
    }
    expect(checked).toBe(324);
    expect(mismatches).toEqual([]);
  });

  it.each(TYPE_NAMES)('attacker %s: all 18 defenders match the snapshot', (attacker) => {
    for (const defender of TYPE_NAMES) {
      expect(elementalMultiplier(attacker, defender), `${attacker}->${defender}`).toBe(fixtureMultiplier(attacker, defender));
    }
  });

  it('only ever yields 0, 0.5, 1 or 2', () => {
    for (const a of TYPE_NAMES) for (const d of TYPE_NAMES) expect([0, 0.5, 1, 2]).toContain(elementalMultiplier(a, d));
  });

  it('has the known totals: 51 super effective, 61 not very effective, 8 no effect (120 of 324 non-neutral)', () => {
    const count = (m: number) => TYPE_NAMES.flatMap((a) => TYPE_NAMES.map((d) => elementalMultiplier(a, d))).filter((x) => x === m).length;
    expect(count(2)).toBe(51);
    expect(count(0.5)).toBe(61);
    expect(count(0)).toBe(8);
    expect(count(1)).toBe(324 - 120);
  });

  it('has the eight immunities and no others', () => {
    const immunities = TYPE_NAMES.flatMap((a) => TYPE_NAMES.filter((d) => elementalMultiplier(a, d) === 0).map((d) => `${a}->${d}`)).sort();
    expect(immunities).toEqual([
      'dragon->fairy', 'electric->ground', 'fighting->ghost', 'ghost->normal',
      'ground->flying', 'normal->ghost', 'poison->steel', 'psychic->dark',
    ].sort());
  });

  it('uses the MODERN chart: Steel no longer resists Ghost or Dark; Fairy exists', () => {
    expect(elementalMultiplier('ghost', 'steel')).toBe(1);
    expect(elementalMultiplier('dark', 'steel')).toBe(1);
    expect(elementalMultiplier('steel', 'fairy')).toBe(2);
    expect(elementalMultiplier('fairy', 'dragon')).toBe(2);
    expect(elementalMultiplier('dragon', 'fairy')).toBe(0);
    expect(elementalMultiplier('poison', 'fairy')).toBe(2);
  });
});

describe('matchupsFor: golden cases', () => {
  it('single type — Muk (poison)', () => {
    expect(matchupsFor(['poison'])).toEqual({
      x4: [], x2: ['ground', 'psychic'], x05: ['grass', 'fighting', 'poison', 'bug', 'fairy'], x025: [], x0: [],
    });
  });

  it('single type — Pikachu (electric)', () => {
    expect(matchupsFor(['electric'])).toEqual({
      x4: [], x2: ['ground'], x05: ['electric', 'flying', 'steel'], x025: [], x0: [],
    });
  });

  it('single type — a type with no resistances and one immunity-free weakness: Normal', () => {
    expect(matchupsFor(['normal'])).toEqual({ x4: [], x2: ['fighting'], x05: [], x025: [], x0: ['ghost'] });
  });

  it('two types — Corviknight (steel/flying): x2 fire+electric, x0 ground+poison', () => {
    expect(matchupsFor(['steel', 'flying'])).toEqual({
      x4: [],
      x2: ['fire', 'electric'],
      x05: ['normal', 'flying', 'psychic', 'dragon', 'steel', 'fairy'],
      x025: ['grass', 'bug'],
      x0: ['poison', 'ground'],
    });
  });

  it('two types — Gyarados (water/flying): the x4 case is Electric', () => {
    const m = matchupsFor(['water', 'flying'])!;
    expect(m.x4).toEqual(['electric']);
    expect(m.x2).toEqual(['rock']);
    expect(m.x0).toEqual(['ground']);
    expect(m.x025).toEqual([]);
  });

  it('two types — Gardevoir (psychic/fairy): immune to Dragon, x4 none', () => {
    expect(matchupsFor(['psychic', 'fairy'])).toEqual({
      x4: [], x2: ['poison', 'ghost', 'steel'], x05: ['psychic'], x025: ['fighting'], x0: ['dragon'],
    });
  });

  it('two types — Lucario (fighting/steel): x0 poison, x0.25 bug+rock', () => {
    const m = matchupsFor(['fighting', 'steel'])!;
    expect(m.x2).toEqual(['fire', 'fighting', 'ground']);
    expect(m.x025).toEqual(['bug', 'rock']);
    expect(m.x0).toEqual(['poison']);
  });

  it('two types — Ferrothorn (grass/steel): Fire is x4', () => {
    expect(matchupsFor(['grass', 'steel'])!.x4).toEqual(['fire']);
  });

  it('two types — Quagsire (water/ground): Grass is x4 and Electric is x0', () => {
    const m = matchupsFor(['water', 'ground'])!;
    expect(m.x4).toEqual(['grass']);
    expect(m.x0).toEqual(['electric']);
  });

  it('two types — Spiritomb (ghost/dark): only Fairy is super effective; immune to Normal, Fighting and Psychic', () => {
    const m = matchupsFor(['ghost', 'dark'])!;
    expect(m.x4).toEqual([]);
    expect(m.x2).toEqual(['fairy']);
    expect(m.x0).toEqual(['normal', 'fighting', 'psychic']);
  });
});

describe('matchupsFor: exhaustive over all 171 typings (18 mono + 153 dual)', () => {
  const typings: TypeName[][] = [];
  for (const a of TYPE_NAMES) typings.push([a]);
  for (let i = 0; i < TYPE_NAMES.length; i++) for (let j = i + 1; j < TYPE_NAMES.length; j++) typings.push([TYPE_NAMES[i], TYPE_NAMES[j]]);

  it('covers 171 typings', () => {
    expect(typings).toHaveLength(171);
  });

  it('every typing yields a consistent result', () => {
    for (const typing of typings) {
      const m = matchupsFor(typing)!;
      expect(m, typing.join('/')).not.toBeNull();

      // Each attacking type is in exactly one bucket, or is neutral (x1).
      const listed = [...m.x4, ...m.x2, ...m.x05, ...m.x025, ...m.x0];
      expect(new Set(listed).size, `${typing.join('/')} lists a type twice`).toBe(listed.length);

      // Product of the elemental cells, checked against the independent fixture.
      for (const attacker of TYPE_NAMES) {
        const product = typing.reduce((acc, d) => acc * fixtureMultiplier(attacker, d), 1);
        expect(damageMultiplier(attacker, typing), `${attacker} vs ${typing.join('/')}`).toBe(product);
        const bucket = (['x4', 'x2', 'x05', 'x025', 'x0'] as const).find((k) => (m[k] as TypeName[]).includes(attacker));
        const expectedBucket = product === 4 ? 'x4' : product === 2 ? 'x2' : product === 0.5 ? 'x05' : product === 0.25 ? 'x025' : product === 0 ? 'x0' : undefined;
        expect(bucket, `${attacker} vs ${typing.join('/')}`).toBe(expectedBucket);
      }

      // Structural invariants.
      if (typing.length === 1) {
        expect(m.x4, 'a single type cannot be x4').toEqual([]);
        expect(m.x025, 'a single type cannot be x0.25').toEqual([]);
      }
      // Buckets are listed in canonical type order.
      for (const bucket of [m.x4, m.x2, m.x05, m.x025, m.x0]) {
        const idx = bucket.map((t) => TYPE_NAMES.indexOf(t));
        expect([...idx].sort((a, b) => a - b)).toEqual(idx);
      }
    }
  });

  it('is symmetric: the order of the two types does not matter', () => {
    for (const [a, b] of typings.filter((t) => t.length === 2)) {
      expect(matchupsFor([a, b])).toEqual(matchupsFor([b, a]));
    }
  });

  it('x4 needs both types weak; x0 needs at least one immune type', () => {
    for (const typing of typings) {
      const m = matchupsFor(typing)!;
      for (const a of m.x4) expect(typing.every((d) => elementalMultiplier(a, d) === 2)).toBe(true);
      for (const a of m.x0) expect(typing.some((d) => elementalMultiplier(a, d) === 0)).toBe(true);
    }
  });
});

describe('matchupsFor: untrustworthy input yields null (the block is then not rendered)', () => {
  it.each([
    [[]],
    [['normal', 'fire', 'water']],
    [['fire', 'fire']],
    [['stellar']],
    [['unknown']],
    [['Fire']],
    [['fire', 'shadow']],
    [['']],
  ] as [string[]][])('%j', (types) => {
    expect(matchupsFor(types)).toBeNull();
  });

  it('isTypeName accepts only the 18 lowercase slugs', () => {
    for (const t of TYPE_NAMES) expect(isTypeName(t)).toBe(true);
    expect(isTypeName('stellar')).toBe(false);
    expect(isTypeName('Fire')).toBe(false);
  });
});

describe('presentation helpers', () => {
  it('formats multipliers', () => {
    expect(formatMultiplier(4)).toBe('×4');
    expect(formatMultiplier(2)).toBe('×2');
    expect(formatMultiplier(0.5)).toBe('×½');
    expect(formatMultiplier(0.25)).toBe('×¼');
    expect(formatMultiplier(0)).toBe('×0');
  });

  it('lists the five rendered levels strongest first, never x1', () => {
    expect(MATCHUP_LEVELS.map((l) => l.multiplier)).toEqual([4, 2, 0.5, 0.25, 0]);
  });
});
