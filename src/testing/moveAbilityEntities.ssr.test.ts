import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import MovePage from '../pages/[lang]/movimientos/[name].astro';
import AbilityPage from '../pages/[lang]/habilidades/[name].astro';
import { SITE_URL } from '../utils/seo';

// Fase 2C: mechanics, generation link, machines (MT/HM/TR), historical
// changes and the lightweight relation list on move/ability pages — all
// from fields already fetched, or the zero-runtime-cost machines dataset.
//
// Fase 2D: the move page's learned-by list itself moved off
// learned_by_pokemon to services/moveLearnsets (offline dataset, opt-in
// generator — see docs/architecture/move-learnset-relations.md), mocked
// below since that dataset isn't part of this test run.
let learnsetRelations: { pokemonId: number; method: string; versionGroup: string; level: number }[] = [];
vi.mock('../services/moveLearnsets', () => ({
  getMoveLearnsetRelations: async () => learnsetRelations,
}));

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

function learner(id: number, name: string) {
  return {
    [`${API}/pokemon/${name}`]: {
      id, name, height: 10, weight: 100,
      species: { name, url: `${API}/pokemon-species/${id}/` },
      types: [{ slot: 1, type: { name: 'normal' } }],
      sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
    },
  };
}

function moveFixtures(opts: {
  name: string; type?: string; category?: string; power?: number | null; accuracy?: number | null;
  target?: string; meta?: any; statChanges?: any[]; pastValues?: any[]; generation?: string;
  learners?: { id: number; name: string }[];
}) {
  const learners = opts.learners ?? [{ id: 1, name: 'mon1' }];
  const move = {
    id: 1, name: opts.name, names: [], type: { name: opts.type ?? 'normal' },
    damage_class: { name: opts.category ?? 'physical' }, power: opts.power ?? 80, accuracy: opts.accuracy ?? 100,
    pp: 10, priority: 0, flavor_text_entries: [],
    learned_by_pokemon: learners.map((l) => ({ name: l.name, url: `${API}/pokemon/${l.name}/` })),
    generation: { name: opts.generation ?? 'generation-i', url: `${API}/generation/1/` },
    target: { name: opts.target ?? 'selected-pokemon' },
    meta: opts.meta ?? null,
    stat_changes: opts.statChanges ?? [],
    past_values: opts.pastValues ?? [],
  };
  return {
    [SHOWDOWN]: {},
    [`${API}/move/${opts.name}`]: move,
    [`${API}/ability?limit=100000`]: { count: 0, next: null, results: [] },
    ...Object.assign({}, ...learners.map((l) => learner(l.id, l.name))),
  };
}

let fixtures: Record<string, unknown> = {};
beforeEach(() => {
  learnsetRelations = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input).replace(/\/$/, '');
    const data = fixtures[url];
    if (data === undefined) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

const renderMove = async (name: string, lang = 'es') =>
  (await AstroContainer.create()).renderToString(MovePage, { params: { lang, name }, request: new Request(`${SITE_URL}/${lang}/movimientos/${name}/`) });

describe('Move page mechanics', () => {
  it('Earthquake-like: no notable meta -> no Mechanics section, generation link present, TM26 machine section (real generated data)', async () => {
    fixtures = moveFixtures({ name: 'groundquake', type: 'ground', target: 'all-other-pokemon', generation: 'generation-i' });
    const html = await renderMove('groundquake');
    expect(html).not.toContain('>Mecánicas<');
    expect(html).toContain('Generación I');
    expect(html).toContain('href="/es/generacion/1/"');
  });

  it('a recoil move reports recoil, not drain', async () => {
    fixtures = moveFixtures({ name: 'doubleedge-like', meta: { ailment: { name: 'none' }, drain: -33, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, min_hits: null, max_hits: null, min_turns: null, max_turns: null, stat_chance: 0 } });
    const html = await renderMove('doubleedge-like');
    expect(html).toContain('Retroceso');
    expect(html).toContain('33%');
    expect(html).not.toContain('>Drenaje<');
  });

  it('a draining move reports drain, not recoil', async () => {
    fixtures = moveFixtures({ name: 'gigadrain-like', meta: { ailment: { name: 'none' }, drain: 50, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, min_hits: null, max_hits: null, min_turns: null, max_turns: null, stat_chance: 0 } });
    const html = await renderMove('gigadrain-like');
    expect(html).toContain('Drenaje');
    expect(html).toContain('50%');
    expect(html).not.toContain('>Retroceso<');
  });

  it('a multi-hit move reports the hit range', async () => {
    fixtures = moveFixtures({ name: 'furyswipes-like', meta: { ailment: { name: 'none' }, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, min_hits: 2, max_hits: 5, min_turns: null, max_turns: null, stat_chance: 0 } });
    const html = await renderMove('furyswipes-like');
    expect(html).toContain('Golpes');
    expect(html).toContain('2–5');
  });

  it('a status move causing paralysis with a chance reports it', async () => {
    fixtures = moveFixtures({
      name: 'bodyslam-like', category: 'physical',
      meta: { ailment: { name: 'paralysis' }, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 30, flinch_chance: 0, min_hits: null, max_hits: null, min_turns: null, max_turns: null, stat_chance: 0 },
    });
    const html = await renderMove('bodyslam-like');
    expect(html).toContain('Parálisis');
    expect(html).toContain('30%');
  });

  it('a stat-lowering move reports the stat changes and chance', async () => {
    fixtures = moveFixtures({
      name: 'crunch-like',
      meta: { ailment: { name: 'none' }, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, min_hits: null, max_hits: null, min_turns: null, max_turns: null, stat_chance: 20 },
      statChanges: [{ change: -1, stat: { name: 'defense' } }],
    });
    const html = await renderMove('crunch-like');
    expect(html).toContain('Cambia estadísticas');
    expect(html).toMatch(/Defensa -1/);
    expect(html).toContain('(20%)');
  });

  it('a move with past_values shows the historical changes section', async () => {
    fixtures = moveFixtures({
      name: 'tackle-like',
      pastValues: [{ power: 35, accuracy: 95, pp: null, effect_chance: null, type: null, version_group: { name: 'black-white' } }],
    });
    const html = await renderMove('tackle-like');
    expect(html).toContain('Cambios históricos');
    expect(html).toContain('Negro / Blanco');
    expect(html).toMatch(/95%/);
  });

  it('a move with no notable past values shows no historical section', async () => {
    fixtures = moveFixtures({ name: 'plainmove' });
    const html = await renderMove('plainmove');
    expect(html).not.toContain('Cambios históricos');
  });

  it('Earthquake itself: real generated machines dataset shows TM26', async () => {
    fixtures = moveFixtures({ name: 'earthquake', type: 'ground' });
    const html = await renderMove('earthquake');
    expect(html).toContain('MT / MO / TR');
    expect(html).toMatch(/MT26/);
  });

  it('a move with no learnset data (yet) renders the "no results" message server-side, not a silent empty grid', async () => {
    fixtures = moveFixtures({ name: 'nolearners' });
    learnsetRelations = [];
    const html = await renderMove('nolearners');
    const emptyDiv = html.match(/<div id="learnset-empty"[^>]*>([^<]*)<\/div>/);
    expect(emptyDiv?.[0]).not.toContain('hidden');
    expect(emptyDiv?.[1]).toContain('No hay Pokémon que aprendan este movimiento');
  });

  it('a move with many learners: counter reports the real total, list uses the lightweight relation component', async () => {
    fixtures = moveFixtures({ name: 'popularmove' });
    learnsetRelations = Array.from({ length: 70 }, (_, i) => ({ pokemonId: 900 + i, method: 'level-up', versionGroup: 'scarlet-violet', level: 10 }));
    const html = await renderMove('popularmove');
    expect(html).toMatch(/>70<\/span>/);
    expect(html).not.toMatch(/tier-badge/);
  });

  describe('Game Context method selector (Outrage bug: Tutor never appeared after switching to Platinum)', () => {
    it("Scarlet/Violet (the SSR default) has no Tutor, but the client payload carries Platinum's Tutor relation so the fix can rebuild the selector after a context switch", async () => {
      fixtures = moveFixtures({ name: 'outragelike' });
      learnsetRelations = [
        { pokemonId: 3, method: 'level-up', versionGroup: 'scarlet-violet', level: 50 },
        { pokemonId: 6, method: 'machine', versionGroup: 'scarlet-violet', level: 0 },
        { pokemonId: 6, method: 'tutor', versionGroup: 'platinum', level: 0 },
        { pokemonId: 149, method: 'level-up', versionGroup: 'platinum', level: 64 },
      ];
      const html = await renderMove('outragelike');
      // SSR default (Scarlet/Violet): method wrapper visible (2 methods:
      // level-up, machine), but Tutor is not one of its options.
      const wrapper = html.match(/<div id="learnset-method-wrapper"[^>]*>/)?.[0] ?? '';
      expect(wrapper).not.toContain('hidden');
      const selectHtml = html.match(/<select id="learnset-method"[\s\S]*?<\/select>/)?.[0] ?? '';
      expect(selectHtml).not.toMatch(/>Tutor</);
      // The compact client payload still carries the Platinum/Tutor
      // relation — the data was never the problem, only the selector never
      // being rebuilt for it (see the source-pattern regression in
      // movement-crawlability.ssr.test.ts for the fix itself).
      const payloadMatch = html.match(/<script type="application\/json" id="learnset-data"[^>]*>([\s\S]*?)<\/script>/);
      expect(payloadMatch).toBeTruthy();
      const payload = JSON.parse(payloadMatch![1]);
      const { learnMethodIndex } = await import('../utils/moveLearnMethods');
      const tutorIndex = learnMethodIndex('tutor');
      expect(payload.relations.some((r: number[]) => r[1] === tutorIndex)).toBe(true);
      expect(payload.contexts.some((c: { id: string }) => c.id === 'platinum')).toBe(true);
    });

    it('a context with a single method hides the method wrapper server-side', async () => {
      fixtures = moveFixtures({ name: 'onemethodmove' });
      learnsetRelations = [{ pokemonId: 1, method: 'level-up', versionGroup: 'scarlet-violet', level: 5 }];
      const html = await renderMove('onemethodmove');
      const wrapper = html.match(/<div id="learnset-method-wrapper"[^>]*>/)?.[0] ?? '';
      expect(wrapper).toMatch(/\bhidden\b/);
    });

    it('a context with several methods shows the method wrapper server-side, with every method present as an option', async () => {
      fixtures = moveFixtures({ name: 'twomethodmove' });
      learnsetRelations = [
        { pokemonId: 1, method: 'level-up', versionGroup: 'scarlet-violet', level: 5 },
        { pokemonId: 2, method: 'egg', versionGroup: 'scarlet-violet', level: 0 },
      ];
      const html = await renderMove('twomethodmove');
      const wrapper = html.match(/<div id="learnset-method-wrapper"[^>]*>/)?.[0] ?? '';
      expect(wrapper).not.toMatch(/\bhidden\b/);
      const selectHtml = html.match(/<select id="learnset-method"[\s\S]*?<\/select>/)?.[0] ?? '';
      expect(selectHtml).toMatch(/>Nivel</);
      expect(selectHtml).toMatch(/>Huevo</);
    });
  });

  describe('"Total histórico" (context total vs all-time total)', () => {
    it('hidden (present but class="hidden") when the default context count equals the historical total', async () => {
      fixtures = moveFixtures({ name: 'nohistoricaldiff' });
      learnsetRelations = [{ pokemonId: 1, method: 'level-up', versionGroup: 'scarlet-violet', level: 5 }];
      const html = await renderMove('nohistoricaldiff');
      const span = html.match(/<span id="learnset-historical"[^>]*>/)?.[0] ?? '';
      expect(span).toMatch(/\bhidden\b/);
    });

    it('visible (no "hidden" class) when the default context count is lower than the historical total', async () => {
      fixtures = moveFixtures({ name: 'historicaldiff' });
      learnsetRelations = [
        { pokemonId: 1, method: 'level-up', versionGroup: 'scarlet-violet', level: 5 },
        { pokemonId: 2, method: 'level-up', versionGroup: 'red-blue', level: 5 }, // only ever in an old context
      ];
      const html = await renderMove('historicaldiff');
      const span = html.match(/<span id="learnset-historical"[^>]*>/)?.[0] ?? '';
      expect(span).not.toMatch(/\bhidden\b/);
      expect(html).toContain('Total histórico: 2');
    });
  });
});

function abilityFixtures(opts: {
  name: string; effectEs?: string; effectEn?: string; flavorEn?: string;
  effectChanges?: any[]; isMainSeries?: boolean; generation?: string;
  pokemon?: { name: string; is_hidden: boolean }[];
}) {
  const pokemonRel = opts.pokemon ?? [{ name: 'mon1', is_hidden: false }];
  const ability = {
    id: 1, name: opts.name, names: [],
    flavor_text_entries: opts.flavorEn ? [{ flavor_text: opts.flavorEn, language: { name: 'en' } }] : [],
    effect_entries: [
      ...(opts.effectEs ? [{ effect: opts.effectEs, language: { name: 'es' } }] : []),
      ...(opts.effectEn ? [{ effect: opts.effectEn, language: { name: 'en' } }] : []),
    ],
    pokemon: pokemonRel.map((p, i) => ({ pokemon: { name: p.name, url: `${API}/pokemon/${p.name}/` }, is_hidden: p.is_hidden, slot: i + 1 })),
    generation: { name: opts.generation ?? 'generation-iii', url: `${API}/generation/3/` },
    is_main_series: opts.isMainSeries ?? true,
    effect_changes: opts.effectChanges ?? [],
  };
  return {
    [SHOWDOWN]: {},
    [`${API}/ability/${opts.name}`]: ability,
    ...Object.assign({}, ...pokemonRel.map((p, i) => learner(500 + i, p.name))),
  };
}

const renderAbility = async (name: string, lang = 'es') =>
  (await AstroContainer.create()).renderToString(AbilityPage, { params: { lang, name }, request: new Request(`${SITE_URL}/${lang}/habilidades/${name}/`) });

describe('Ability page facts', () => {
  it('Rough-Skin-like: mechanical effect shown, generation link present', async () => {
    fixtures = abilityFixtures({ name: 'roughskin-like', effectEs: 'Daña al atacante al hacer contacto.', generation: 'generation-iii' });
    const html = await renderAbility('roughskin-like');
    expect(html).toContain('Daña al atacante al hacer contacto.');
    expect(html).toContain('Efecto');
    expect(html).toContain('Generación III');
  });

  it('an ability with only flavor text is honestly labelled as such, not as an effect', async () => {
    fixtures = abilityFixtures({ name: 'flavoronly', flavorEn: 'A mysterious power.' });
    const html = await renderAbility('flavoronly');
    expect(html).toContain('A mysterious power.');
    expect(html).toContain('Descripción de juego');
    expect(html).not.toMatch(/>Efecto<\/p>/);
  });

  it('Intimidate-like: effect_changes render as historical changes', async () => {
    fixtures = abilityFixtures({
      name: 'intimidate-like', effectEs: 'Baja el Ataque del rival al entrar en combate.',
      effectChanges: [{ version_group: { name: 'sun-moon' }, effect_entries: [{ effect: 'Antes solo bajaba una etapa a un rival.', language: { name: 'es' } }] }],
    });
    const html = await renderAbility('intimidate-like');
    expect(html).toContain('Cambios históricos');
    expect(html).toContain('Antes solo bajaba una etapa a un rival.');
  });

  it('a hidden ability relation is labelled "Oculta"', async () => {
    fixtures = abilityFixtures({ name: 'hiddenexample', effectEs: 'x', pokemon: [{ name: 'mon1', is_hidden: true }, { name: 'mon2', is_hidden: false }] });
    const html = await renderAbility('hiddenexample');
    expect(html).toContain('Oculta');
  });

  it('an ability with many Pokémon reports the real total, not the capped count', async () => {
    const pokemon = Array.from({ length: 70 }, (_, i) => ({ name: `mon${i}`, is_hidden: false }));
    fixtures = abilityFixtures({ name: 'popularability', effectEs: 'x', pokemon });
    const html = await renderAbility('popularability');
    expect(html).toMatch(/>70<\/span>/);
    expect(html).toContain('Mostrando 60');
  });

  it('a non-main-series ability shows the "not main series" badge', async () => {
    fixtures = abilityFixtures({ name: 'sidegame-ability', effectEs: 'x', isMainSeries: false });
    const html = await renderAbility('sidegame-ability');
    expect(html).toContain('No es de la serie principal');
  });
});
