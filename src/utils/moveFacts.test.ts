import { describe, it, expect } from 'vitest';
import { buildMoveMechanics, targetLabel, ailmentLabel, movePastValues } from './moveFacts';

describe('buildMoveMechanics: Earthquake-like (plain damaging move)', () => {
  it('reports nothing beyond target when meta has no notable effect', () => {
    const m = buildMoveMechanics(
      { name: 'all-other-pokemon' },
      { ailment: { name: 'none' }, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, min_hits: null, max_hits: null, min_turns: null, max_turns: null, stat_chance: 0 },
      []
    );
    expect(m.target).toBe('all-other-pokemon');
    expect(m.ailment).toBeNull();
    expect(m.drain).toBeNull();
    expect(m.recoil).toBeNull();
    expect(m.healing).toBeNull();
    expect(m.critRate).toBeNull();
    expect(m.flinchChance).toBeNull();
    expect(m.minHits).toBeNull();
    expect(m.statChanges).toEqual([]);
  });
});

describe('buildMoveMechanics: recoil vs drain', () => {
  it('a draining move (positive meta.drain) reports drain, not recoil', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { drain: 50 }, []);
    expect(m.drain).toBe(50);
    expect(m.recoil).toBeNull();
  });
  it('a recoil move (negative meta.drain) reports recoil, not drain', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { drain: -33 }, []);
    expect(m.recoil).toBe(33);
    expect(m.drain).toBeNull();
  });
});

describe('buildMoveMechanics: multi-hit / multi-turn / priority-adjacent fields', () => {
  it('a multi-hit move reports hit range', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { min_hits: 2, max_hits: 5 }, []);
    expect(m.minHits).toBe(2);
    expect(m.maxHits).toBe(5);
  });
  it('a multi-turn move reports turn range', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { min_turns: 2, max_turns: 3 }, []);
    expect(m.minTurns).toBe(2);
    expect(m.maxTurns).toBe(3);
  });
  it('a flinch-chance move reports it', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { flinch_chance: 30 }, []);
    expect(m.flinchChance).toBe(30);
  });
  it('a healing move reports healing %', () => {
    const m = buildMoveMechanics({ name: 'user' }, { healing: 50 }, []);
    expect(m.healing).toBe(50);
  });
  it('a higher-crit-rate move reports crit_rate', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { crit_rate: 1 }, []);
    expect(m.critRate).toBe(1);
  });
});

describe('buildMoveMechanics: status / ailment moves', () => {
  it('reports the ailment and its chance when present', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { ailment: { name: 'paralysis' }, ailment_chance: 30 }, []);
    expect(m.ailment).toBe('paralysis');
    expect(m.ailmentChance).toBe(30);
  });
  it('a guaranteed-ailment move (chance 0 meaning always) has no ailmentChance to show', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { ailment: { name: 'sleep' }, ailment_chance: 0 }, []);
    expect(m.ailment).toBe('sleep');
    expect(m.ailmentChance).toBeNull();
  });
  it('"unknown" ailment is treated as no ailment', () => {
    const m = buildMoveMechanics({ name: 'selected-pokemon' }, { ailment: { name: 'unknown' } }, []);
    expect(m.ailment).toBeNull();
  });
});

describe('buildMoveMechanics: stat-changing moves', () => {
  it('reports stat changes and their chance', () => {
    const m = buildMoveMechanics(
      { name: 'selected-pokemon' },
      { stat_chance: 100 },
      [{ change: -1, stat: { name: 'attack' } }, { change: -1, stat: { name: 'defense' } }]
    );
    expect(m.statChanges).toEqual([{ stat: 'attack', change: -1 }, { stat: 'defense', change: -1 }]);
    expect(m.statChance).toBe(100);
  });
  it('no stat changes means no stat chance either, even if meta has one', () => {
    const m = buildMoveMechanics({ name: 'user' }, { stat_chance: 50 }, []);
    expect(m.statChanges).toEqual([]);
    expect(m.statChance).toBeNull();
  });
});

describe('buildMoveMechanics: missing meta (status moves with no meta from PokeAPI)', () => {
  it('degrades to all-null instead of throwing', () => {
    const m = buildMoveMechanics({ name: 'user' }, null, undefined);
    expect(m.ailment).toBeNull();
    expect(m.drain).toBeNull();
    expect(m.statChanges).toEqual([]);
  });
});

describe('targetLabel', () => {
  it('labels every known target in both languages', () => {
    for (const t of ['all-other-pokemon', 'selected-pokemon', 'user', 'entire-field']) {
      expect(targetLabel(t, 'es')).not.toBe(t.replace(/-/g, ' '));
      expect(targetLabel(t, 'en')).not.toBe(t.replace(/-/g, ' '));
    }
  });
  it('falls back to a formatted slug for an unknown target', () => {
    expect(targetLabel('made-up-target', 'es')).toBe('made up target');
  });
});

describe('ailmentLabel', () => {
  it('labels every known ailment in both languages', () => {
    for (const a of ['paralysis', 'sleep', 'confusion', 'leech-seed']) {
      expect(ailmentLabel(a, 'es')).not.toBe(a.replace(/-/g, ' '));
      expect(ailmentLabel(a, 'en')).not.toBe(a.replace(/-/g, ' '));
    }
  });
});

describe('movePastValues', () => {
  it('normalizes a historical entry (Tackle-like: accuracy/power/pp changed pre-Black/White)', () => {
    const raw = [{ power: 35, accuracy: 95, pp: null, effect_chance: null, type: null, version_group: { name: 'black-white' } }];
    expect(movePastValues(raw)).toEqual([{ versionGroup: 'black-white', power: 35, accuracy: 95, pp: null, effectChance: null, type: null }]);
  });
  it('empty when there are no past values', () => {
    expect(movePastValues([])).toEqual([]);
    expect(movePastValues(undefined)).toEqual([]);
  });
  it('keeps a changed type field (Bite/Karate Chop were Normal before Gen VI)', () => {
    const raw = [{ power: null, accuracy: null, pp: null, effect_chance: null, type: { name: 'normal' }, version_group: { name: 'gold-silver' } }];
    expect(movePastValues(raw)[0].type).toBe('normal');
  });
});
