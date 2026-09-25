import { describe, it, expect } from 'vitest';
import {
  buildAbilityIndex,
  findKeyCollisions,
  normalizeAbilityKey,
  resolveAbilitySlug,
  abilitySlugOrNull,
} from './abilitySlug';

const index = buildAbilityIndex([
  'levitate',
  'minds-eye',
  'dragons-maw',
  'as-one-glastrier',
  'as-one-spectrier',
  'embody-aspect',
  'water-absorb',
  'sand-stream',
]);

describe('resolveAbilitySlug', () => {
  it("Mind's Eye -> minds-eye (apostrophe), no manual exception", () => {
    expect(resolveAbilitySlug("Mind's Eye", index)).toEqual({ status: 'normalized', slug: 'minds-eye' });
    expect(resolveAbilitySlug("Dragon's Maw", index)).toEqual({ status: 'normalized', slug: 'dragons-maw' });
  });

  it('plain name: direct match', () => {
    expect(resolveAbilitySlug('Levitate', index)).toEqual({ status: 'direct', slug: 'levitate' });
  });

  it('name with spaces -> hyphenated slug', () => {
    expect(resolveAbilitySlug('Water Absorb', index)).toEqual({ status: 'direct', slug: 'water-absorb' });
  });

  it('parentheses: As One (Glastrier) -> as-one-glastrier', () => {
    expect(resolveAbilitySlug('As One (Glastrier)', index)).toEqual({ status: 'normalized', slug: 'as-one-glastrier' });
  });

  it('a qualified variant with no own entity resolves to the base ability, flagged as variant', () => {
    expect(resolveAbilitySlug('Embody Aspect (Teal)', index)).toEqual({ status: 'variant', slug: 'embody-aspect' });
  });

  it('is case / punctuation / diacritic tolerant', () => {
    expect(abilitySlugOrNull('SAND-STREAM', index)).toBe('sand-stream');
    expect(abilitySlugOrNull('Sand_Stream!', index)).toBe('sand-stream');
    expect(abilitySlugOrNull('Mind’s Eye', index)).toBe('minds-eye'); // typographic apostrophe
  });

  it('a name with no counterpart is explicitly unresolved (never a guessed slug)', () => {
    expect(resolveAbilitySlug('Persistent', index)).toEqual({ status: 'unresolved' });
    expect(resolveAbilitySlug('', index)).toEqual({ status: 'unresolved' });
    expect(abilitySlugOrNull('Persistent', index)).toBeNull();
  });

  it('a normalized-key collision is reported, never chosen arbitrarily', () => {
    const colliding = buildAbilityIndex(['mind-s-eye', 'minds-eye', 'levitate']);
    expect(findKeyCollisions(colliding)).toEqual([{ key: 'mindseye', slugs: ['mind-s-eye', 'minds-eye'] }]);
    const r = resolveAbilitySlug("Mind's Eye", colliding);
    expect(r.status).toBe('ambiguous');
    expect(r).toEqual({ status: 'ambiguous', candidates: ['mind-s-eye', 'minds-eye'] });
    expect(abilitySlugOrNull("Mind's Eye", colliding)).toBeNull();
    // An exact slug still wins over the fuzzy tier.
    expect(resolveAbilitySlug('minds-eye', colliding)).toEqual({ status: 'direct', slug: 'minds-eye' });
  });

  it('normalizeAbilityKey', () => {
    expect(normalizeAbilityKey("Mind's Eye")).toBe('mindseye');
    expect(normalizeAbilityKey('As One (Spectrier)')).toBe('asonespectrier');
  });
});

// Sweep over a real snapshot of both sources (see the fixture's _note).
describe('Showdown -> PokeAPI ability sweep (snapshot 2026-09-25)', async () => {
  const snapshot = (await import('./__fixtures__/abilities/snapshot.json')).default as {
    pokeapiSlugs: string[];
    showdownNames: string[];
  };
  const real = buildAbilityIndex(snapshot.pokeapiSlugs);

  // Showdown-only names with no PokeAPI entity (CAP fakemon abilities, the
  // MissingNo placeholder). They must stay unlinked, not get a guessed slug.
  const EXPECTED_UNRESOLVED = ['', 'Persistent', 'Rebound'];

  it('no two real PokeAPI abilities share a normalized key', () => {
    expect(findKeyCollisions(real)).toEqual([]);
  });

  it('every Showdown name resolves to an existing slug, or is one of the known unresolved names', () => {
    const unresolved: string[] = [];
    for (const name of snapshot.showdownNames) {
      const r = resolveAbilitySlug(name, real);
      expect(r.status, name).not.toBe('ambiguous');
      if ('slug' in r) expect(snapshot.pokeapiSlugs, name).toContain(r.slug);
      else unresolved.push(name);
    }
    expect(unresolved.sort()).toEqual([...EXPECTED_UNRESOLVED].sort());
  });

  it("Mind's Eye resolves to minds-eye", () => {
    expect(abilitySlugOrNull("Mind's Eye", real)).toBe('minds-eye');
  });

  it('the old naive transform is what broke: it yields slugs PokeAPI does not have', () => {
    const naive = (n: string) => n.toLowerCase().replace(/\s+/g, '-');
    const broken = snapshot.showdownNames.filter((n) => !snapshot.pokeapiSlugs.includes(naive(n)) && abilitySlugOrNull(n, real));
    expect(broken.sort()).toEqual(
      ["Dragon's Maw", 'As One (Glastrier)', 'As One (Spectrier)', "Mind's Eye", 'Embody Aspect (Teal)', 'Embody Aspect (Wellspring)', 'Embody Aspect (Hearthflame)', 'Embody Aspect (Cornerstone)'].sort()
    );
  });
});
