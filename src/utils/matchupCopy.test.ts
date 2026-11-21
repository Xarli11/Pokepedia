import { describe, it, expect } from 'vitest';
import typings from './__fixtures__/types/pilot-typings.json';
import catalogEs from '../data/generated/pokemon.es.json';
import catalogEn from '../data/generated/pokemon.en.json';
import { toEntries, type CatalogFile } from '../data/catalogs/schema';
import { MATCHUP_CONTROL, MATCHUP_TREATMENT, isMatchupTreatment } from './matchupPilot';
import {
  legacyPokemonSeo,
  matchupDescription,
  matchupSummary,
  matchupTitle,
  pokemonSeoCopy,
  typingLabel,
} from './matchupCopy';
import { TYPE_NAMES, matchupsFor, type TypeMatchups, type TypeName } from './typeMatchups';

const speciesTypes = typings.typings as Record<string, TypeName[]>;

const es = toEntries(catalogEs as unknown as CatalogFile<'pokemon'>);
const en = toEntries(catalogEn as unknown as CatalogFile<'pokemon'>);
const nameOf = (entries: ReturnType<typeof toEntries<'pokemon'>>, slug: string) => entries.find((e) => e.slug === slug)!.name;

const CORVIKNIGHT = matchupsFor(['steel', 'flying'])!;
const GYARADOS = matchupsFor(['water', 'flying'])!;

describe('pilot assignment is fixed and well-formed', () => {
  it('has exactly 30 treatment and 30 control species, disjoint, no duplicates', () => {
    expect(MATCHUP_TREATMENT).toHaveLength(30);
    expect(MATCHUP_CONTROL).toHaveLength(30);
    expect(new Set(MATCHUP_TREATMENT).size).toBe(30);
    expect(new Set(MATCHUP_CONTROL).size).toBe(30);
    expect(MATCHUP_TREATMENT.filter((s) => MATCHUP_CONTROL.includes(s))).toEqual([]);
  });

  it('is exactly the assignment recorded in docs/audits/f6-experiment-1-design-2026-11-21.md (never re-drawn)', () => {
    expect([...MATCHUP_TREATMENT].sort()).toEqual([
      'abra', 'aggron', 'alakazam', 'baxcalibur', 'corviknight', 'dragapult', 'dragonite', 'falinks', 'flamigo', 'floette',
      'flygon', 'gliscor', 'grimmsnarl', 'gyarados', 'hatterene', 'lucario', 'malamar', 'muk', 'nidoqueen', 'pinsir',
      'raichu', 'regieleki', 'scovillain', 'scrafty', 'shuckle', 'skuntank', 'slowbro', 'steelix', 'ursaluna', 'yveltal',
    ].sort());
    expect([...MATCHUP_CONTROL].sort()).toEqual([
      'archaludon', 'blastoise', 'charizard', 'clefable', 'drampa', 'electrode', 'exeggutor', 'gardevoir', 'gengar', 'golem',
      'goodra', 'haxorus', 'hitmonlee', 'hydreigon', 'iron-hands', 'kadabra', 'koffing', 'ludicolo', 'machamp', 'mawile',
      'mightyena', 'noivern', 'onix', 'persian', 'regirock', 'tentacruel', 'tyranitar', 'weavile', 'weezing', 'froslass',
    ].sort());
  });

  it('every pilot slug is a real species (not a form) in the committed catalogs, ES and EN', () => {
    for (const slug of [...MATCHUP_TREATMENT, ...MATCHUP_CONTROL]) {
      for (const entries of [es, en]) {
        const entry = entries.find((e) => e.slug === slug);
        expect(entry, slug).toBeDefined();
        expect(entry!.form, `${slug} must be a species`).toBe(false);
      }
    }
  });

  it('only treatment slugs are treatment', () => {
    for (const s of MATCHUP_TREATMENT) expect(isMatchupTreatment(s)).toBe(true);
    for (const s of MATCHUP_CONTROL) expect(isMatchupTreatment(s)).toBe(false);
    expect(isMatchupTreatment('garchomp')).toBe(false);
    expect(isMatchupTreatment('corviknight-gmax')).toBe(false);
  });
});

describe('matchupSummary (typing only, never ability-dependent)', () => {
  it('ES — Corviknight', () => {
    expect(matchupSummary('Corviknight', ['steel', 'flying'], CORVIKNIGHT, 'es')).toBe(
      'Corviknight (Acero/Volador) recibe daño ×2 de Fuego y Eléctrico. Resiste Planta y Bicho (×¼) y otros 6 tipos (×½). Es inmune a Veneno y Tierra.',
    );
  });

  it('EN — Corviknight', () => {
    expect(matchupSummary('Corviknight', ['steel', 'flying'], CORVIKNIGHT, 'en')).toBe(
      'Corviknight (Steel/Flying) takes ×2 damage from Fire and Electric. It resists Grass and Bug (×¼) and 6 other types (×½). It is immune to Poison and Ground.',
    );
  });

  it('ES/EN — a x4 weakness is stated with its own multiplier', () => {
    expect(matchupSummary('Gyarados', ['water', 'flying'], GYARADOS, 'es')).toBe(
      'Gyarados (Agua/Volador) recibe daño ×4 de Eléctrico y ×2 de Roca. Resiste Fuego, Agua, Lucha, Bicho y Acero (×½). Es inmune a Tierra.',
    );
    expect(matchupSummary('Gyarados', ['water', 'flying'], GYARADOS, 'en')).toBe(
      'Gyarados (Water/Flying) takes ×4 damage from Electric and ×2 from Rock. It resists Fire, Water, Fighting, Bug and Steel (×½). It is immune to Ground.',
    );
  });

  it('ES/EN — only x4 (no x2) reads correctly', () => {
    const m: TypeMatchups = { x4: ['fire'], x2: [], x05: [], x025: [], x0: [] };
    expect(matchupSummary('Ferrothorn', ['grass', 'steel'], m, 'es')).toBe('Ferrothorn (Planta/Acero) recibe daño ×4 de Fuego.');
    expect(matchupSummary('Ferrothorn', ['grass', 'steel'], m, 'en')).toBe('Ferrothorn (Grass/Steel) takes ×4 damage from Fire.');
  });

  it('ES/EN — a typing with no weaknesses says so (never an empty claim)', () => {
    const m: TypeMatchups = { x4: [], x2: [], x05: ['normal'], x025: [], x0: [] };
    expect(matchupSummary('X', ['normal'], m, 'es')).toContain('no tiene debilidades por tipo.');
    expect(matchupSummary('X', ['normal'], m, 'en')).toContain('has no type weaknesses.');
  });

  it('omits the resistance and immunity sentences when there are none', () => {
    const m: TypeMatchups = { x4: [], x2: ['fighting'], x05: [], x025: [], x0: [] };
    expect(matchupSummary('X', ['normal'], m, 'en')).toBe('X (Normal) takes ×2 damage from Fighting.');
  });

  it('a x0.5-only list longer than five collapses to a count, without "other"', () => {
    const m: TypeMatchups = { x4: [], x2: ['rock'], x05: ['fire', 'water', 'grass', 'ice', 'bug', 'fairy'], x025: [], x0: [] };
    expect(matchupSummary('X', ['steel'], m, 'es')).toContain('Resiste 6 tipos (×½).');
    expect(matchupSummary('X', ['steel'], m, 'en')).toContain('It resists 6 types (×½).');
  });

  it('never claims an ability-based immunity: wording stays about types', () => {
    for (const m of [CORVIKNIGHT, GYARADOS]) {
      const text = matchupSummary('X', ['steel', 'flying'], m, 'es') + matchupSummary('X', ['steel', 'flying'], m, 'en');
      expect(text).not.toMatch(/levitaci|levitate|absorb|flash fire|habilidad|ability/i);
    }
  });

  it('typingLabel localizes the types', () => {
    expect(typingLabel(['steel', 'flying'], 'es')).toBe('Acero/Volador');
    expect(typingLabel(['steel', 'flying'], 'en')).toBe('Steel/Flying');
  });
});

describe('title and description', () => {
  it('title puts the facts users search for first (ES/EN)', () => {
    expect(matchupTitle('Corviknight', 'es')).toBe('Corviknight: Debilidades, Stats y Movimientos');
    expect(matchupTitle('Corviknight', 'en')).toBe('Corviknight Weaknesses, Stats & Moves');
  });

  it('description — Corviknight ES/EN', () => {
    expect(matchupDescription('Corviknight', ['steel', 'flying'], CORVIKNIGHT, 495, 'es')).toBe(
      'Corviknight (Acero/Volador): débil a Fuego y Eléctrico (×2), inmune a Veneno y Tierra. Stats base (495), habilidades, evolución y movimientos.',
    );
    expect(matchupDescription('Corviknight', ['steel', 'flying'], CORVIKNIGHT, 495, 'en')).toBe(
      'Corviknight (Steel/Flying): weak to Fire and Electric (×2), immune to Poison and Ground. Base stats (495), abilities, evolution and moves.',
    );
  });

  it('description — x4 and x2 are both stated with their multiplier', () => {
    expect(matchupDescription('Gyarados', ['water', 'flying'], GYARADOS, 540, 'es')).toContain('débil a Eléctrico (×4) y Roca (×2)');
  });

  it('description is never longer than 160 characters, for every typing and a worst-case name', () => {
    const longName = 'Xxxxxxxxxxxxxxxxxxxx'; // 20 chars
    const all: TypeName[][] = [];
    for (const a of TYPE_NAMES) all.push([a]);
    for (let i = 0; i < 18; i++) for (let j = i + 1; j < 18; j++) all.push([TYPE_NAMES[i], TYPE_NAMES[j]]);
    for (const typing of all) {
      const m = matchupsFor(typing)!;
      for (const lang of ['es', 'en']) {
        const d = matchupDescription(longName, typing, m, 680, lang);
        expect(d.length, `${typing.join('/')} ${lang}: ${d.length} chars`).toBeLessThanOrEqual(160);
        expect(d).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('full <title> (with the brand suffix) stays at most 70 characters for every treatment species (ES/EN, real names)', () => {
    for (const slug of MATCHUP_TREATMENT) {
      for (const [entries, lang] of [[es, 'es'], [en, 'en']] as const) {
        const full = `${matchupTitle(nameOf(entries, slug), lang)} | Pokepedia.app`;
        expect(full.length, full).toBeLessThanOrEqual(70);
      }
    }
  });
});

describe('pokemonSeoCopy: treatment gets the experiment, everything else is byte-identical to before', () => {
  const base = (slug: string, lang: string, name = 'Nombre', types: string[] = ['steel', 'flying']) =>
    pokemonSeoCopy({ slug, lang, name, types, totalStats: 495 });

  it('treatment species: matchups, summary, new title and description', () => {
    const copy = base('corviknight', 'es', 'Corviknight');
    expect(copy.matchups).not.toBeNull();
    expect(copy.summary).toContain('Corviknight (Acero/Volador)');
    expect(copy.title).toBe('Corviknight: Debilidades, Stats y Movimientos');
    expect(copy.description).toContain('débil a Fuego y Eléctrico (×2)');
  });

  it.each(MATCHUP_CONTROL)('control species %s: exactly the legacy copy, no matchups', (slug) => {
    for (const lang of ['es', 'en']) {
      const copy = base(slug, lang, 'Nombre');
      expect(copy).toEqual({ ...legacyPokemonSeo('Nombre', 495, lang), matchups: null, summary: null });
    }
  });

  it('legacy copy is exactly the strings the template used before the experiment', () => {
    expect(legacyPokemonSeo('Garchomp', 600, 'es')).toEqual({
      title: 'Garchomp: Stats, Movimientos y Habilidades',
      description: 'Ficha de Garchomp: tipos, estadísticas base (600), habilidades, evolución y movimientos que aprende.',
    });
    expect(legacyPokemonSeo('Garchomp', 600, 'en')).toEqual({
      title: 'Garchomp: Stats, Moves & Abilities',
      description: 'Garchomp profile: types, base stats (600), abilities, evolution and the moves it learns.',
    });
  });

  it('forms and any other species are untouched (no matchups, legacy copy)', () => {
    for (const slug of ['garchomp', 'corviknight-gmax', 'charizard-mega-x', 'pikachu']) {
      const copy = base(slug, 'en', 'X');
      expect(copy.matchups).toBeNull();
      expect(copy.title).toBe('X: Stats, Moves & Abilities');
    }
  });

  it('a treatment species with an unrecognised typing stays as it was (nothing untrustworthy is claimed)', () => {
    const copy = base('corviknight', 'es', 'Corviknight', ['stellar']);
    expect(copy.matchups).toBeNull();
    expect(copy.title).toBe('Corviknight: Stats, Movimientos y Habilidades');
  });

  it('every treatment species renders valid copy with its real typing and real ES/EN names', () => {
    for (const slug of MATCHUP_TREATMENT) {
      const types = speciesTypes[slug];
      expect(types, slug).toBeDefined();
      for (const [entries, lang] of [[es, 'es'], [en, 'en']] as const) {
        const copy = pokemonSeoCopy({ slug, lang, name: nameOf(entries, slug), types, totalStats: 500 });
        expect(copy.matchups, `${slug} ${lang}`).not.toBeNull();
        expect(copy.description.length).toBeLessThanOrEqual(160);
        expect(copy.summary).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });
});
