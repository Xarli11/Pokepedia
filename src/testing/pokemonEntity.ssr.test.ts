import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PokemonPage from '../pages/[lang]/pokemon/[name].astro';
import { SITE_URL } from '../utils/seo';

// Fase 2B: the Pokémon page's new encyclopedic sections (training, breeding,
// classification, regional Pokédex numbers) render from data already in the
// pokemon/species responses — no new PokeAPI request. One fixture per
// notable real case (see docs/architecture/pokemon-entity.md).

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

const baseStats = (effort: number[] = [0, 0, 0, 0, 0, 0]) =>
  ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((s, i) => ({ base_stat: 100, effort: effort[i], stat: { name: s } }));

function fixturesFor(opts: {
  id: number; name: string; base_experience?: number | null;
  effort?: number[];
  capture_rate: number; base_happiness: number | null; hatch_counter: number | null; gender_rate: number;
  growth_rate: string; egg_groups: string[]; pokedex_numbers?: { entry_number: number; pokedex: string }[];
  is_baby?: boolean; is_legendary?: boolean; is_mythical?: boolean;
  genera?: { genus: string; language: string }[];
  /** Fase 2E: version groups this Pokémon has moves data for — the raw
   * material Game Context is derived from. Empty by default (matches every
   * pre-2E fixture in this file, which never exercised Game Context: no
   * available context means the regional dex section stays unfiltered). */
  moveVersionGroups?: string[];
}) {
  const detail = {
    id: opts.id, name: opts.name, height: 10, weight: 100,
    base_experience: opts.base_experience ?? 100,
    species: { name: opts.name, url: `${API}/pokemon-species/${opts.id}/` },
    types: [{ slot: 1, type: { name: 'normal' } }],
    stats: baseStats(opts.effort),
    abilities: [],
    moves: (opts.moveVersionGroups ?? []).map((vg) => ({
      move: { name: 'tackle', url: `${API}/move/tackle/` },
      version_group_details: [{ level_learned_at: 1, move_learn_method: { name: 'level-up' }, version_group: { name: vg } }],
    })),
    sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
  };
  const species = {
    name: opts.name, names: [], flavor_text_entries: [],
    varieties: [{ is_default: true, pokemon: { name: opts.name, url: `${API}/pokemon/${opts.name}/` } }],
    genera: (opts.genera ?? []).map((g) => ({ genus: g.genus, language: { name: g.language } })),
    capture_rate: opts.capture_rate, base_happiness: opts.base_happiness, hatch_counter: opts.hatch_counter,
    gender_rate: opts.gender_rate, growth_rate: { name: opts.growth_rate },
    egg_groups: opts.egg_groups.map((name) => ({ name })),
    pokedex_numbers: (opts.pokedex_numbers ?? []).map((p) => ({ entry_number: p.entry_number, pokedex: { name: p.pokedex } })),
    is_baby: opts.is_baby ?? false, is_legendary: opts.is_legendary ?? false, is_mythical: opts.is_mythical ?? false,
  };
  return {
    [SHOWDOWN]: {},
    [`${API}/pokemon/${opts.name}`]: detail,
    [`${API}/pokemon/${opts.id}`]: detail,
    [`${API}/pokemon-species/${opts.id}`]: species,
    [`${API}/ability?limit=100000`]: { count: 0, next: null, results: [] },
  };
}

let fixtures: Record<string, unknown> = {};
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input).replace(/\/$/, '');
    const data = fixtures[url];
    if (data === undefined) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

const render = async (name: string, lang = 'es') =>
  (await AstroContainer.create()).renderToString(PokemonPage, {
    params: { lang, name },
    request: new Request(`${SITE_URL}/${lang}/pokemon/${name}/`),
  });

describe('Pokémon page: factual sections (Fase 2B)', () => {
  it('Garchomp: training, breeding, EV yield, genus and regional dex numbers, ES and EN', async () => {
    fixtures = fixturesFor({
      id: 445, name: 'garchomp', base_experience: 270, effort: [0, 0, 0, 0, 0, 3],
      capture_rate: 45, base_happiness: 70, hatch_counter: 40, gender_rate: 4,
      growth_rate: 'slow', egg_groups: ['monster', 'dragon'],
      pokedex_numbers: [{ entry_number: 445, pokedex: 'national' }, { entry_number: 109, pokedex: 'extended-sinnoh' }],
      genera: [{ genus: 'Pokémon Mach', language: 'es' }, { genus: 'Mach Pokémon', language: 'en' }],
    });
    const es = await render('garchomp', 'es');
    expect(es).toContain('Pokémon Mach');
    expect(es).toContain('270'); // base experience
    expect(es).toContain('45'); // capture rate
    expect(es).toContain('Lento'); // growth rate (slow)
    expect(es).toContain('3 Velocidad'); // EV yield
    expect(es).toContain('♂ 50%'); // 50/50 gender
    expect(es).toContain('Nacional');
    expect(es).toContain('#445');
    expect(es).toContain('Sinnoh Extendido');
    expect(es).toContain('#109');

    const en = await render('garchomp', 'en');
    expect(en).toContain('Mach Pokémon');
    expect(en).toContain('Slow');
    expect(en).toContain('3 Speed');
    expect(en).toContain('National');
    expect(en).toContain('Extended Sinnoh');
  });

  it('Ditto: genderless, single egg group, no classification badge', async () => {
    fixtures = fixturesFor({
      id: 132, name: 'ditto', capture_rate: 35, base_happiness: 70, hatch_counter: 10,
      gender_rate: -1, growth_rate: 'medium', egg_groups: ['ditto'],
    });
    const html = await render('ditto', 'es');
    expect(html).toContain('Sin género');
    expect(html).toContain('Ditto');
    expect(html).not.toContain('Legendario');
    expect(html).not.toContain('Mítico');
  });

  it('a legendary Pokémon shows the Legendary badge and tolerates null happiness/hatch counter', async () => {
    fixtures = fixturesFor({
      id: 145, name: 'zapdos', capture_rate: 3, base_happiness: null, hatch_counter: null,
      gender_rate: -1, growth_rate: 'slow', egg_groups: ['no-eggs'], is_legendary: true,
    });
    const html = await render('zapdos', 'es');
    expect(html).toContain('Legendario');
    expect(html).not.toContain('Amistad base'); // base_happiness omitted when null
  });

  it('a mythical Pokémon shows the Mythical badge', async () => {
    fixtures = fixturesFor({
      id: 151, name: 'mew', capture_rate: 45, base_happiness: 100, hatch_counter: 120,
      gender_rate: -1, growth_rate: 'medium-slow', egg_groups: ['no-eggs'], is_mythical: true,
    });
    const html = await render('mew', 'es');
    expect(html).toContain('Mítico');
  });

  it('a baby Pokémon shows the Baby badge', async () => {
    fixtures = fixturesFor({
      id: 172, name: 'pichu', capture_rate: 190, base_happiness: 70, hatch_counter: 10,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['undiscovered'], is_baby: true,
    });
    const html = await render('pichu', 'es');
    expect(html).toContain('Bebé');
  });

  it('drops non-main-series pokedexes (Champions/Conquest) from the regional dex list', async () => {
    fixtures = fixturesFor({
      id: 1, name: 'bulbasaur', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 1, growth_rate: 'medium-slow', egg_groups: ['monster', 'plant'],
      pokedex_numbers: [{ entry_number: 1, pokedex: 'national' }, { entry_number: 999, pokedex: 'champions' }],
    });
    const html = await render('bulbasaur', 'es');
    expect(html).toContain('Nacional');
    expect(html).not.toContain('#999');
  });

  it('UX polish: long regional Pokédex names render complete, not truncated, and the category is contextualized', async () => {
    // A different id/name than the other Garchomp fixtures in this file: the
    // fetch layer caches by URL, and reusing one would silently serve a
    // previous test's response instead of this one's.
    fixtures = fixturesFor({
      id: 99445, name: 'garchomp-uxcheck', capture_rate: 45, base_happiness: 70, hatch_counter: 40,
      gender_rate: 4, growth_rate: 'slow', egg_groups: ['monster', 'dragon'],
      pokedex_numbers: [
        { entry_number: 445, pokedex: 'national' },
        { entry_number: 210, pokedex: 'lumiose-city' },
        { entry_number: 88, pokedex: 'crown-tundra' },
      ],
      genera: [{ genus: 'Pokémon Mach', language: 'es' }, { genus: 'Mach Pokémon', language: 'en' }],
    });
    const es = await render('garchomp-uxcheck', 'es');
    // Full labels present, not cut short (no ellipsis / partial word).
    expect(es).toContain('Ciudad Luminalia');
    expect(es).toContain('Nieves de la Corona');
    expect(es).not.toContain('Ciudad L...');
    expect(es).not.toContain('Nieves de la C...');
    // No CSS truncate class on the pokedex-number label anymore.
    const pokedexSection = es.slice(es.indexOf('Números de Pokédex'), es.indexOf('Números de Pokédex') + 2000);
    expect(pokedexSection).not.toContain('truncate');
    // Category is contextualized, not a bare unexplained value.
    expect(es).toContain('Categoría');
    expect(es).toMatch(/Categoría:?<\/span>\s*Pokémon Mach/);

    const en = await render('garchomp-uxcheck', 'en');
    expect(en).toContain('Lumiose');
    expect(en).toContain('Crown Tundra');
    expect(en).toContain('Category');
    expect(en).toMatch(/Category:?<\/span>\s*Mach Pokémon/);
  });

  it('omits the regional dex section entirely when there are no main-series entries', async () => {
    // Different id/name than the earlier fixtures: the fetch layer caches by
    // URL, and reusing one would silently serve a previous test's response.
    fixtures = fixturesFor({
      id: 7, name: 'squirtle', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 1, growth_rate: 'medium-slow', egg_groups: ['monster', 'water1'],
      pokedex_numbers: [],
    });
    const html = await render('squirtle', 'es');
    expect(html).not.toContain('Números de Pokédex');
  });
});

// Fase 2E: regional Pokédex numbers filtered by the page's Game Context.
// Real dexes (verified live against PokeAPI, see pokedexes.ts): paldea ->
// scarlet-violet, kitakami -> scarlet-violet + the-teal-mask, galar ->
// sword-shield, national -> global.
describe('Pokémon page: regional Pokédex contextualized by Game Context (Fase 2E)', () => {
  it('SSR shows only the default Game Context\'s dex numbers, plus the global one, and reports the historical total', async () => {
    fixtures = fixturesFor({
      id: 99001, name: 'contextmon', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['monster'],
      pokedex_numbers: [
        { entry_number: 1, pokedex: 'national' },
        { entry_number: 2, pokedex: 'galar' },
        { entry_number: 3, pokedex: 'paldea' },
      ],
      // Scarlet/Violet is the most recent -> the SSR default context.
      moveVersionGroups: ['sword-shield', 'scarlet-violet'],
    });
    const html = await render('contextmon', 'es');
    // Default context (Scarlet/Violet): Paldea + the global National dex —
    // Galar (Sword/Shield-only) is not shown by default.
    expect(html).toContain('Paldea');
    expect(html).toContain('Nacional');
    expect(html).not.toContain('Galar');
    // 2 shown (Paldea + National) vs. 3 historical: the indicator is visible.
    const historicalSpan = html.match(/<span id="regional-dex-historical"[^>]*>([^<]*)<\/span>/);
    expect(historicalSpan?.[0]).not.toMatch(/\bhidden\b/);
    expect(historicalSpan?.[1]).toContain('3');
  });

  it('a DLC revision (Kitakami/Teal Mask) is included in its base context, not lost', async () => {
    fixtures = fixturesFor({
      id: 99002, name: 'dlcmon', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['monster'],
      pokedex_numbers: [{ entry_number: 1, pokedex: 'national' }, { entry_number: 2, pokedex: 'kitakami' }],
      moveVersionGroups: ['scarlet-violet', 'the-teal-mask'],
    });
    const html = await render('dlcmon', 'es');
    expect(html).toContain('Kitakami');
  });

  it('"Total histórico" is present but hidden when the default context already shows every entry', async () => {
    fixtures = fixturesFor({
      id: 99003, name: 'nohiddendiff', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['monster'],
      pokedex_numbers: [{ entry_number: 1, pokedex: 'national' }, { entry_number: 2, pokedex: 'paldea' }],
      moveVersionGroups: ['scarlet-violet'],
    });
    const html = await render('nohiddendiff', 'es');
    const historicalSpan = html.match(/<span id="regional-dex-historical"[^>]*>/);
    expect(historicalSpan?.[0]).toMatch(/\bhidden\b/);
  });

  it('no available Game Context (no move version-group data): every historical entry shows, unfiltered', async () => {
    fixtures = fixturesFor({
      id: 99004, name: 'nocontextmon', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['monster'],
      pokedex_numbers: [{ entry_number: 1, pokedex: 'national' }, { entry_number: 2, pokedex: 'galar' }],
      moveVersionGroups: [],
    });
    const html = await render('nocontextmon', 'es');
    expect(html).toContain('Nacional');
    expect(html).toContain('Galar');
  });

  it('EN: labels and "Total historical" render in English', async () => {
    fixtures = fixturesFor({
      id: 99005, name: 'englishmon', capture_rate: 45, base_happiness: 70, hatch_counter: 20,
      gender_rate: 4, growth_rate: 'medium', egg_groups: ['monster'],
      pokedex_numbers: [
        { entry_number: 1, pokedex: 'national' },
        { entry_number: 2, pokedex: 'galar' },
        { entry_number: 3, pokedex: 'paldea' },
      ],
      moveVersionGroups: ['sword-shield', 'scarlet-violet'],
    });
    const html = await render('englishmon', 'en');
    expect(html).toContain('Paldea');
    expect(html).toContain('National');
    expect(html).not.toContain('Galar');
    expect(html).toContain('Total historical');
  });

  it('client script: rebuilds the regional dex list from the same pure filter used server-side, and never a second Game Context selector', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../pages/[lang]/pokemon/[name].astro', import.meta.url), 'utf8');
    const script = source.slice(source.lastIndexOf('<script>\n    // Fase 2E'));
    expect(script).toMatch(/import \{ regionalDexEntriesForContext[^}]*\} from '..\/..\/..\/utils\/pokemonFacts'/);
    expect(script).toMatch(/document\.addEventListener\('pokepedia:game-context-change', onGameContextChange\)/);
    // No <select> is created by this script — it only ever reads
    // MovesTable's broadcast / localStorage, never renders its own control.
    expect(script).not.toMatch(/createElement\('select'\)/);
    expect(script).not.toContain('<select');
  });
});
