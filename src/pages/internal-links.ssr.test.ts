import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import HomePage from './[lang]/index.astro';
import PokemonPage from './[lang]/pokemon/[name].astro';
import MovePage from './[lang]/movimientos/[name].astro';
import AbilityPage from './[lang]/habilidades/[name].astro';
import ItemPage from './[lang]/objetos/[name].astro';
import MovesIndexPage from './[lang]/movimientos/index.astro';
import AbilitiesIndexPage from './[lang]/habilidades/index.astro';
import ItemsIndexPage from './[lang]/objetos/index.astro';
import { SITE_URL } from '../utils/seo';

// Anti-regression for the trailing-slash URL convention: every internal page
// link rendered server-side must be the canonical form (`/es/pokemon/x/`),
// never the no-slash variant that costs a 301 and competes with the canonical
// in Google. Hand-built `/${lang}/…` template literals across ~40 call sites
// used to emit the no-slash form; all of them now go through pagePath().

const API = 'https://pokeapi.co/api/v2';

function pokemonDetail(id: number, name: string, speciesId = id) {
  return {
    id,
    name,
    height: 23,
    weight: 888,
    species: { name, url: `${API}/pokemon-species/${speciesId}/` },
    types: [{ slot: 1, type: { name: 'water', url: `${API}/type/11/` } }],
    stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((stat) => ({
      base_stat: 80,
      stat: { name: stat },
    })),
    abilities: [{ ability: { name: 'torrent', url: `${API}/ability/67/` }, is_hidden: false, slot: 1 }],
    moves: [],
    sprites: {
      front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
      other: { 'official-artwork': { front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` } },
    },
  };
}

const FIXTURES: Record<string, unknown> = {
  // Pokémon page: feraligatr + its species, evolution chain, prev/next, form.
  '/pokemon/feraligatr': pokemonDetail(160, 'feraligatr'),
  '/pokemon/159': pokemonDetail(159, 'croconaw'),
  '/pokemon/161': pokemonDetail(161, 'sentret'),
  '/pokemon/10300': pokemonDetail(10300, 'feraligatr-mega', 160),
  '/pokemon-species/160': {
    name: 'feraligatr',
    names: [{ name: 'Feraligatr', language: { name: 'es' } }],
    flavor_text_entries: [{ flavor_text: 'Descripción.', language: { name: 'es' } }],
    evolution_chain: { url: `${API}/evolution-chain/74/` },
    generation: { name: 'generation-ii', url: `${API}/generation/2/` },
    varieties: [
      { is_default: true, pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } },
      { is_default: false, pokemon: { name: 'feraligatr-mega', url: `${API}/pokemon/10300/` } },
    ],
  },
  '/evolution-chain/74': {
    chain: {
      species: { name: 'totodile', url: `${API}/pokemon-species/158/` },
      evolution_details: [],
      evolves_to: [
        {
          species: { name: 'croconaw', url: `${API}/pokemon-species/159/` },
          evolution_details: [{ min_level: 18, trigger: { name: 'level-up' } }],
          evolves_to: [
            {
              species: { name: 'feraligatr', url: `${API}/pokemon-species/160/` },
              evolution_details: [{ min_level: 30, trigger: { name: 'level-up' } }],
              evolves_to: [],
            },
          ],
        },
      ],
    },
  },
  // Ability / move / item detail pages (and the Pokémon page's ability card).
  '/ability/67': {
    id: 67,
    name: 'torrent',
    names: [{ name: 'Torrente', language: { name: 'es' } }],
    flavor_text_entries: [{ flavor_text: 'Potencia ataques de agua.', language: { name: 'es' } }],
    effect_entries: [],
    pokemon: [{ pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` }, is_hidden: false, slot: 1 }],
  },
  '/ability/torrent': 'alias:/ability/67',
  '/pokemon/160': 'alias:/pokemon/feraligatr',
  '/move/surf': {
    id: 57,
    name: 'surf',
    names: [{ name: 'Surf', language: { name: 'es' } }],
    type: { name: 'water' },
    damage_class: { name: 'special' },
    power: 90,
    accuracy: 100,
    pp: 15,
    priority: 0,
    flavor_text_entries: [{ flavor_text: 'Una gran ola.', language: { name: 'es' } }],
    learned_by_pokemon: [{ name: 'feraligatr', url: `${API}/pokemon/160/` }],
  },
  '/item/tm03': {
    name: 'tm03',
    names: [{ name: 'MT03', language: { name: 'es' } }],
    category: { name: 'all-machines' },
    cost: 0,
    effect_entries: [{ effect: 'Teaches a move.', short_effect: 'Teaches a move.', language: { name: 'en' } }],
    flavor_text_entries: [],
    sprites: { default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-water.png' },
    machines: [{ machine: { url: `${API}/machine/1/` }, version_group: { name: 'x-y' } }],
    held_by_pokemon: [{ pokemon: { name: 'feraligatr', url: `${API}/pokemon/160/` } }],
  },
  '/machine/1': { move: { name: 'surf', url: `${API}/move/surf/` } },
  // Listings.
  '/move?limit=1000': { results: [{ name: 'surf', url: `${API}/move/57/` }] },
  '/ability?limit=500': { results: [{ name: 'torrent', url: `${API}/ability/67/` }] },
  '/item?limit=2000': { results: [{ name: 'leftovers', url: `${API}/item/211/` }] },
  // Homepage (?gen=gen1 default -> generation/1).
  '/generation/1': {
    pokemon_species: [
      { name: 'bulbasaur', url: `${API}/pokemon-species/1/` },
      { name: 'charizard', url: `${API}/pokemon-species/6/` },
    ],
  },
};

function fixtureFor(url: string): unknown {
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

// Static assets are files, not pages — the trailing-slash rule doesn't apply.
const ASSET_PREFIXES = ['/_astro/', '/og/', '/fonts/', '/api/'];
const ASSET_FILES = /\.(png|ico|json|css|js|svg|webp|txt|xml)(\?|$)/;

/** Every root-relative URL the page links or navigates to, server-rendered. */
function internalUrls(html: string): string[] {
  const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  const onclicks = [...html.matchAll(/window\.location\.href='(\/[^']*)'/g)].map((m) => m[1]);
  return [...hrefs, ...onclicks].filter(
    (url) => !ASSET_PREFIXES.some((p) => url.startsWith(p)) && !ASSET_FILES.test(url)
  );
}

function pathWithoutQuery(url: string): string {
  return url.split('#')[0].split('?')[0];
}

function expectAllCanonicalForm(html: string) {
  const urls = internalUrls(html);
  expect(urls.length).toBeGreaterThan(0);
  const noSlash = urls.filter((u) => !pathWithoutQuery(u).endsWith('/'));
  expect(noSlash).toEqual([]);
  for (const url of urls) {
    expect(url).not.toMatch(/\/\//);
    expect(url).not.toContain('${');
    expect(url).toMatch(/^\/(es|en)\//);
  }
}

async function render(component: any, params: Record<string, string>, path: string) {
  const container = await AstroContainer.create();
  return container.renderToString(component, { params, request: new Request(`${SITE_URL}${path}`) });
}

describe('internal links use the trailing-slash canonical form (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('homepage', async () => {
    const html = await render(HomePage, { lang: 'es' }, '/es/');
    expectAllCanonicalForm(html);
    expect(html).toContain('href="/es/pokemon/bulbasaur/"');
    expect(html).toContain('href="/es/comparar/charizard/venusaur/"');
    // Header/footer navigation from Layout.astro.
    expect(html).toContain('href="/es/movimientos/"');
    expect(html).toContain('href="/es/habilidades/"');
    expect(html).toContain('href="/es/objetos/"');
    expect(html).toContain('href="/es/tipos/"');
    expect(html).toContain('href="/es/generaciones/"');
    expect(html).toContain('href="/es/fuentes/"');
    expect(html).toContain('href="/es/?gen=favorites"');
  });

  it('Pokémon detail page, including its evolution chain, forms and prev/next', async () => {
    const html = await render(PokemonPage, { lang: 'es', name: 'feraligatr' }, '/es/pokemon/feraligatr/');
    expectAllCanonicalForm(html);
    // Evolution chain (EvolutionChain.astro), self-link included.
    expect(html).toContain('href="/es/pokemon/totodile/"');
    expect(html).toContain('href="/es/pokemon/croconaw/"');
    expect(html).toContain('href="/es/pokemon/feraligatr/"');
    expect(html).not.toContain('href="/es/pokemon/feraligatr"');
    // Prev/next, forms, ability, type, generation.
    expect(html).toContain('href="/es/pokemon/sentret/"');
    expect(html).toContain('href="/es/pokemon/feraligatr-mega/"');
    expect(html).toContain('href="/es/habilidades/torrent/"');
    expect(html).toContain('href="/es/tipo/water/"');
    expect(html).toContain('href="/es/generacion/2/"');
    // Canonical and hreflang agree with the link convention.
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/es/pokemon/feraligatr/">`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/en/pokemon/feraligatr/">`);
  });

  it('English Pokémon detail page', async () => {
    const html = await render(PokemonPage, { lang: 'en', name: 'feraligatr' }, '/en/pokemon/feraligatr/');
    expectAllCanonicalForm(html);
    expect(html).toContain('href="/en/pokemon/croconaw/"');
    // The only Spanish link on an English page is the language switcher.
    const esLinks = [...html.matchAll(/<a[^>]*href="\/es\/[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(esLinks).toHaveLength(1);
    expect(esLinks[0]).toContain('id="lang-switch-btn"');
    expect(esLinks[0]).toContain('href="/es/pokemon/feraligatr/"');
  });

  it('move detail page', async () => {
    const html = await render(MovePage, { lang: 'es', name: 'surf' }, '/es/movimientos/surf/');
    expectAllCanonicalForm(html);
    expect(html).toContain('href="/es/pokemon/feraligatr/"');
    expect(html).toContain('href="/es/movimientos/"');
  });

  it('ability detail page', async () => {
    const html = await render(AbilityPage, { lang: 'es', name: 'torrent' }, '/es/habilidades/torrent/');
    expectAllCanonicalForm(html);
    expect(html).toContain('href="/es/pokemon/feraligatr/"');
    expect(html).toContain('href="/es/habilidades/"');
  });

  it('item detail page, including the TM -> move link', async () => {
    const html = await render(ItemPage, { lang: 'es', name: 'tm03' }, '/es/objetos/tm03/');
    expectAllCanonicalForm(html);
    expect(html).toContain('href="/es/movimientos/surf/"');
    expect(html).toContain('href="/es/pokemon/feraligatr/"');
    expect(html).toContain('href="/es/objetos/"');
  });

  it('listing pages (moves, abilities, items)', async () => {
    const moves = await render(MovesIndexPage, { lang: 'es' }, '/es/movimientos/');
    expectAllCanonicalForm(moves);
    expect(moves).toContain("window.location.href='/es/movimientos/surf/'");

    const abilities = await render(AbilitiesIndexPage, { lang: 'en' }, '/en/habilidades/');
    expectAllCanonicalForm(abilities);
    expect(abilities).toContain('href="/en/habilidades/torrent/"');

    const items = await render(ItemsIndexPage, { lang: 'es' }, '/es/objetos/');
    expectAllCanonicalForm(items);
    expect(items).toContain('href="/es/objetos/leftovers/"');
  });

  it('a missing entity is a real 404, not a redirect to the listing', async () => {
    const container = await AstroContainer.create();
    const response = await container.renderToResponse(MovePage, {
      params: { lang: 'es', name: 'does-not-exist' },
      request: new Request(`${SITE_URL}/es/movimientos/does-not-exist/`),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });
});
