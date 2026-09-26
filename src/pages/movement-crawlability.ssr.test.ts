import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PokemonPage from './[lang]/pokemon/[name].astro';
import MovePage from './[lang]/movimientos/[name].astro';
import MovesIndexPage from './[lang]/movimientos/index.astro';
import AbilityPage from './[lang]/habilidades/[name].astro';
import { SITE_URL } from '../utils/seo';
import { renderRoute } from '../testing/renderRoute';

// Phase 3 regression net: crawlable move links in the initial HTML (index and
// Pokémon MovesTable), move-page metadata, move -> type / learned-by links,
// and Showdown ability names resolved to real PokeAPI slugs.

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

function pokemonDetail(id: number, name: string, moves: unknown[] = [], abilities: unknown[] = []) {
  return {
    id,
    name,
    height: 10,
    weight: 100,
    species: { name, url: `${API}/pokemon-species/${id}/` },
    types: [{ slot: 1, type: { name: 'water', url: `${API}/type/11/` } }],
    stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({ base_stat: 80, stat: { name: stat } })),
    abilities,
    moves,
    sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
  };
}

const learn = (slug: string, level: number, method: string, version: string) => ({
  move: { name: slug, url: `${API}/move/${slug}/` },
  version_group_details: [{ level_learned_at: level, move_learn_method: { name: method }, version_group: { name: version } }],
});

function moveFixture(id: number, name: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name,
    names: [{ name, language: { name: 'es' } }, { name, language: { name: 'en' } }],
    type: { name: 'water' },
    damage_class: { name: 'special' },
    power: 90,
    accuracy: 100,
    pp: 15,
    priority: 0,
    flavor_text_entries: [],
    learned_by_pokemon: [],
    ...over,
  };
}

// 45 learners: more than the page's 40-card cap.
const MANY = Array.from({ length: 45 }, (_, i) => ({ name: `mon${i}`, url: `${API}/pokemon/${900 + i}/` }));

const FIXTURES: Record<string, unknown> = {
  '/move?limit=100000': {
    count: 3,
    next: null,
    results: [
      { name: 'surf', url: `${API}/move/57/` },
      { name: 'swords-dance', url: `${API}/move/14/` },
      { name: 'protect', url: `${API}/move/182/` },
    ],
  },
  '/ability?limit=100000': {
    count: 4,
    next: null,
    results: ['torrent', 'minds-eye', 'levitate', 'dragons-maw'].map((n, i) => ({ name: n, url: `${API}/ability/${i + 1}/` })),
  },
  '/pokemon/feraligatr': pokemonDetail(
    160,
    'feraligatr',
    [
      learn('surf', 0, 'machine', 'gold-silver'),
      learn('swords-dance', 0, 'machine', 'gold-silver'),
      learn('protect', 1, 'level-up', 'gold-silver'),
      learn('only-in-red-blue', 5, 'level-up', 'red-blue'),
    ],
    [{ ability: { name: 'torrent', url: `${API}/ability/1/` }, is_hidden: false, slot: 1 }]
  ),
  '/pokemon/160': 'alias:/pokemon/feraligatr',
  '/pokemon/pikachu': pokemonDetail(25, 'pikachu'),
  '/pokemon/25': 'alias:/pokemon/pikachu',
  '/pokemon/gengar': pokemonDetail(94, 'gengar'),
  '/pokemon/94': 'alias:/pokemon/gengar',
  '/pokemon-species/160': { name: 'feraligatr', names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } }] },
  '/pokemon-species/25': { name: 'pikachu', names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: 'pikachu', url: `${API}/pokemon/25/` } }] },
  '/pokemon-species/94': { name: 'gengar', names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: 'gengar', url: `${API}/pokemon/94/` } }] },
  '/ability/minds-eye': { id: 2, name: 'minds-eye', names: [{ name: 'Ojo Mental', language: { name: 'es' } }], flavor_text_entries: [{ flavor_text: 'Ignora evasión.', language: { name: 'es' } }], effect_entries: [], pokemon: [] },
  '/ability/torrent': { id: 1, name: 'torrent', names: [{ name: 'Torrente', language: { name: 'es' } }], flavor_text_entries: [], effect_entries: [], pokemon: [] },
  '/ability/levitate': { id: 3, name: 'levitate', names: [{ name: 'Levitación', language: { name: 'es' } }], flavor_text_entries: [], effect_entries: [], pokemon: [] },
  '/move/surf': moveFixture(57, 'surf', {
    names: [{ name: 'Surf', language: { name: 'es' } }, { name: 'Surf', language: { name: 'en' } }],
    flavor_text_entries: [{ flavor_text: 'Una gran ola.', language: { name: 'es' } }],
    learned_by_pokemon: MANY,
  }),
  '/move/57': 'alias:/move/surf',
  // No Spanish text at all: must fall back to the factual sentence, not English.
  '/move/swords-dance': moveFixture(14, 'swords-dance', {
    names: [{ name: 'Danza Espada', language: { name: 'es' } }, { name: 'Swords Dance', language: { name: 'en' } }],
    type: { name: 'normal' },
    damage_class: { name: 'status' },
    power: null,
    accuracy: null,
    pp: 20,
    flavor_text_entries: [{ flavor_text: 'A frenetic dance.', language: { name: 'en' } }],
    learned_by_pokemon: [{ name: 'feraligatr', url: `${API}/pokemon/160/` }],
  }),
  '/move/protect': moveFixture(182, 'protect', {
    names: [{ name: 'Protect', language: { name: 'en' } }],
    type: { name: 'normal' },
    damage_class: { name: 'status' },
    power: null,
    accuracy: null,
    pp: 10,
    priority: 4,
  }),
  // Type with no Pokepedia page.
  '/move/shadow-rush': moveFixture(10001, 'shadow-rush', { names: [{ name: 'Shadow Rush', language: { name: 'en' } }], type: { name: 'shadow' }, damage_class: { name: 'physical' }, power: 55, accuracy: 100, pp: 5 }),
};
MANY.forEach((_, i) => {
  FIXTURES[`/pokemon/${900 + i}`] = pokemonDetail(900 + i, `mon${i}`);
});

const POKEDEX = {
  feraligatr: { abilities: { 0: 'Torrent', H: "Mind's Eye" } },
  gengar: { abilities: { 0: "Mind's Eye", 1: 'Persistent', H: 'Levitate' } },
};

function fixtureFor(url: string): unknown {
  if (url === SHOWDOWN) return POKEDEX;
  const path = url.replace(API, '').replace(/\/$/, '');
  const hit = FIXTURES[path];
  if (typeof hit === 'string' && hit.startsWith('alias:')) return FIXTURES[hit.slice('alias:'.length)];
  return hit;
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const data = fixtureFor(String(input));
      if (data === undefined) {
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
    })
  );
}

async function render(component: any, params: Record<string, string>, path: string) {
  const container = await AstroContainer.create();
  return container.renderToString(component, { params, request: new Request(`${SITE_URL}${path}`) });
}

function tbodyOf(html: string): string {
  const m = html.match(/<tbody id="movesTableBody"[^>]*>([\s\S]*?)<\/tbody>/);
  expect(m, 'MovesTable tbody present').toBeTruthy();
  return m![1];
}

function moveHrefs(html: string, lang: string): string[] {
  return [...html.matchAll(new RegExp(`<a[^>]*href="(/${lang}/movimientos/[^"/]+/?[^"]*)"`, 'g'))].map((m) => m[1]);
}

function expectCanonicalMoveHref(href: string, lang: string) {
  expect(href).toMatch(new RegExp(`^/${lang}/movimientos/[a-z0-9-]+/$`));
  expect(href).not.toMatch(/\/\d+\/$/);
  expect(href).not.toMatch(/https?:/);
}

const meta = (html: string, name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];

describe('move crawlability (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  for (const lang of ['es', 'en']) {
    it(`/${lang}/movimientos/ links every catalog move with a real <a href>, without onclick`, async () => {
      const html = await render(MovesIndexPage, { lang }, `/${lang}/movimientos/`);
      const hrefs = moveHrefs(html, lang);
      hrefs.forEach((h) => expectCanonicalMoveHref(h, lang));
      expect([...new Set(hrefs)].sort()).toEqual(['protect', 'surf', 'swords-dance'].map((s) => `/${lang}/movimientos/${s}/`));
      expect(html).not.toContain('onclick=');
    });

    it(`Pokémon page (${lang}): MovesTable rows for the initial version exist in the SSR HTML`, async () => {
      const html = await render(PokemonPage, { lang, name: 'feraligatr' }, `/${lang}/pokemon/feraligatr/`);
      const tbody = tbodyOf(html);
      expect(tbody.trim()).not.toBe('');
      // gold-silver is the initial version (most recent of the two): 3 of the 4 fixture moves.
      expect(tbody.match(/<tr/g) ?? []).toHaveLength(3);
      const hrefs = moveHrefs(tbody, lang);
      expect([...hrefs].sort()).toEqual(['protect', 'surf', 'swords-dance'].map((s) => `/${lang}/movimientos/${s}/`));
      hrefs.forEach((h) => expectCanonicalMoveHref(h, lang));
      // A move that belongs to another version group is not in the initial rows.
      expect(tbody).not.toContain('only-in-red-blue');
      // Same order as the client render: by level ascending.
      expect(tbody.indexOf('/movimientos/protect/')).toBeGreaterThan(tbody.indexOf('/movimientos/surf/'));
    });
  }

  it('a Pokémon with no moves renders an empty tbody (no fake rows)', async () => {
    const html = await render(PokemonPage, { lang: 'es', name: 'pikachu' }, '/es/pokemon/pikachu/');
    expect(tbodyOf(html).trim()).toBe('');
  });

  it('every move linked from the Pokémon table answers a valid 200 page', async () => {
    const html = await render(PokemonPage, { lang: 'es', name: 'feraligatr' }, '/es/pokemon/feraligatr/');
    const hrefs = [...new Set(moveHrefs(tbodyOf(html), 'es'))];
    expect(hrefs.length).toBe(3);
    for (const href of hrefs) {
      const response = await renderRoute(MovePage, {
        routePattern: '/[lang]/movimientos/[name]',
        params: { lang: 'es', name: href.split('/')[3] },
        path: href,
      });
      expect(response.status, href).toBe(200);
    }
  });

  it('client-side row template keeps canonical <a> links after any re-render', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../components/MovesTable.astro', import.meta.url), 'utf8');
    const script = source.slice(source.indexOf('<script>'));
    expect(script).toMatch(/<a href="\$\{pagePath\(lang, 'movimientos', m\.slug\)\}"[^>]*data-move-url/);
    // The name cell is no longer a bare text cell that hydration flattens.
    expect(script).not.toMatch(/<td[^>]*data-move-url/);
  });
});

describe('move page metadata and entity links (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('uses real localized flavor text for the description and a factual title', async () => {
    const html = await render(MovePage, { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');
    expect(titleOf(html)).toBe('Surf — Movimiento especial de tipo Agua | Pokepedia.app');
    expect(meta(html, 'description')).toBe('Una gran ola.');
  });

  it('ES page without Spanish text falls back to a Spanish factual description, not English', async () => {
    const html = await render(MovePage, { lang: 'es', name: 'swords-dance' }, '/es/movimientos/swords-dance/');
    const description = meta(html, 'description')!;
    expect(description).toBe('Danza Espada es un movimiento de tipo Normal y categoría Estado. Tiene 20 PP.');
    expect(html).not.toContain('A frenetic dance.');
    expect(html).toContain(description); // the visible description is the same text
    expect(html).not.toContain('Tu enciclopedia Pokémon técnica y definitiva.');
  });

  it('EN page uses EN real text when present, else an EN factual sentence', async () => {
    const withText = await render(MovePage, { lang: 'en', name: 'swords-dance' }, '/en/movimientos/swords-dance/');
    expect(meta(withText, 'description')).toBe('A frenetic dance.');
    const facts = await render(MovePage, { lang: 'en', name: 'protect' }, '/en/movimientos/protect/');
    expect(meta(facts, 'description')).toBe('Protect is a Normal-type Status move with 10 PP and +4 priority.');
    expect(titleOf(facts)).toBe('Protect — Normal-type Status Move | Pokepedia.app');
  });

  it('move -> type: the badge links to the Pokepedia type page', async () => {
    const es = await render(MovePage, { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');
    expect(es).toMatch(/<a[^>]*href="\/es\/tipo\/water\/"[^>]*>\s*Agua\s*<\/a>/);
    const en = await render(MovePage, { lang: 'en', name: 'surf' }, '/en/movimientos/surf/');
    expect(en).toMatch(/<a[^>]*href="\/en\/tipo\/water\/"[^>]*>\s*Water\s*<\/a>/);
  });

  it('a type without a Pokepedia page (shadow) is not linked', async () => {
    const html = await render(MovePage, { lang: 'en', name: 'shadow-rush' }, '/en/movimientos/shadow-rush/');
    expect(html).not.toContain('/tipo/shadow/');
    expect(titleOf(html)).toContain('Shadow-type Physical Move');
  });

  it('learned-by counter reports the real total, not the capped card count', async () => {
    const html = await render(MovePage, { lang: 'en', name: 'surf' }, '/en/movimientos/surf/');
    expect(html).toMatch(/>45<\/span>/);
    expect(html).toContain('Showing 40');
    const hrefs = [...html.matchAll(/href="(\/en\/pokemon\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((h) => expect(h).toMatch(/^\/en\/pokemon\/[a-z0-9-]+\/$/));
  });
});

describe('Showdown ability names -> PokeAPI slugs on the Pokémon page (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it("Mind's Eye links /habilidades/minds-eye/, never mind's-eye", async () => {
    const html = await render(PokemonPage, { lang: 'es', name: 'feraligatr' }, '/es/pokemon/feraligatr/');
    expect(html).toContain('href="/es/habilidades/minds-eye/"');
    expect(html).toContain('href="/es/habilidades/torrent/"');
    expect(html).not.toContain("mind's-eye");
    expect(html).not.toContain('mind%27s-eye');
  });

  it('a name with no PokeAPI ability is shown but not linked', async () => {
    const html = await render(PokemonPage, { lang: 'en', name: 'gengar' }, '/en/pokemon/gengar/');
    expect(html).toContain('href="/en/habilidades/levitate/"');
    expect(html).toContain('Persistent');
    expect(html).not.toMatch(/href="\/en\/habilidades\/persistent/i);
  });

  it('the resolved ability page answers 200', async () => {
    const response = await renderRoute(AbilityPage, {
      routePattern: '/[lang]/habilidades/[name]',
      params: { lang: 'es', name: 'minds-eye' },
      path: '/es/habilidades/minds-eye/',
    });
    expect(response.status).toBe(200);
  });
});
