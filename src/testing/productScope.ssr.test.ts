import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PokemonPage from '../pages/[lang]/pokemon/[name].astro';
import SmogonTier from '../components/SmogonTier.astro';
import Layout from '../layouts/Layout.astro';
import { uiTranslations } from '../utils/pokemon';
import { SITE_URL } from '../utils/seo';

// Product scope: Pokepedia is the encyclopedia. Strategy (sets, team building,
// calculators) belongs to PokeStudio / PokeTypes and must not creep back in.

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

const detail = {
  id: 445, name: 'garchomp', height: 19, weight: 950,
  species: { name: 'garchomp', url: `${API}/pokemon-species/445/` },
  types: [{ slot: 1, type: { name: 'dragon' } }, { slot: 2, type: { name: 'ground' } }],
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((s) => ({ base_stat: 100, stat: { name: s } })),
  abilities: [], moves: [],
  sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
};

const FIXTURES: Record<string, unknown> = {
  [SHOWDOWN]: { garchomp: { tier: 'OU', abilities: { 0: 'Sand Veil' } } },
  [`${API}/pokemon/garchomp`]: detail,
  [`${API}/pokemon/445`]: detail,
  [`${API}/pokemon-species/445`]: { name: 'garchomp', names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: 'garchomp', url: `${API}/pokemon/445/` } }] },
  [`${API}/ability?limit=100000`]: { count: 0, next: null, results: [] },
};

let requested: string[] = [];
beforeEach(() => {
  requested = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input).replace(/\/$/, '');
    requested.push(url);
    const data = FIXTURES[url];
    if (data === undefined) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

const render = async (lang: string) =>
  (await AstroContainer.create()).renderToString(PokemonPage, {
    params: { lang, name: 'garchomp' },
    request: new Request(`${SITE_URL}/${lang}/pokemon/garchomp/`),
  });

describe('Pokémon page product scope', () => {
  it.each(['es', 'en'])('(%s) shows the Smogon tier as attributed reference data, without sets or strategy', async (lang) => {
    const html = await render(lang);
    expect(html).toContain('data-smogon-tier="OU"');
    expect(html).toContain(uiTranslations[lang].source_competitive);
    expect(html).not.toContain('competitive_set_interaction');
    expect(html).not.toContain('competitive-content');
    expect(html).not.toMatch(/smogon\.com\/dex/);
    expect(html).not.toMatch(/estrat|strateg/i);
    // no Smogon *sets* request any more
    expect(requested.some((u) => u.includes('/smogon/data/sets/'))).toBe(false);
  });

  it('titles describe the entity, not strategy', async () => {
    const es = await render('es');
    const en = await render('en');
    expect(es).toMatch(/<title>Garchomp: Stats, Movimientos y Habilidades \| Pokepedia/i);
    expect(en).toMatch(/<title>Garchomp: Stats, Moves &amp; Abilities \| Pokepedia/i);
    const meta = (h: string) => `${h.match(/<title>[^<]*/)?.[0]} ${h.match(/<meta name="description" content="[^"]*/)?.[0]}`;
    expect(meta(es)).not.toMatch(/estrateg|competitiv|debilidad/i);
    expect(meta(en)).not.toMatch(/strateg|competitive|weakness/i);
  });

  it('keeps the PokeTypes deep link, and no PokeStudio link while it has no public URL', async () => {
    const html = await render('en');
    expect(html).toContain('poketypes.app');
    expect(html).not.toContain('data-track-target="pokestudio"');
  });
});

describe('SmogonTier', () => {
  it('renders nothing without a tier (no skeleton)', async () => {
    const html = await (await AstroContainer.create()).renderToString(SmogonTier, { props: { pokemonName: 'x', lang: 'es', tier: null } });
    expect(html.trim()).toBe('');
  });
  it('ships no client script', async () => {
    const html = await (await AstroContainer.create()).renderToString(SmogonTier, { props: { pokemonName: 'x', lang: 'en', tier: 'UU' } });
    expect(html).not.toContain('<script');
    expect(html).toContain('UU');
  });
});

describe('site-wide copy', () => {
  const banned = /calculadora|calculator|estrat[eé]gic|strateg|team.?build|debilidades|weakness/i;
  it.each(['es', 'en'])('(%s) home tagline is encyclopedic', (lang) => {
    const t = uiTranslations[lang];
    expect(t.desc_subtitle).not.toMatch(banned);
    expect(t.desc_subtitle.toLowerCase()).toMatch(/pok[eé]mon/);
    expect(t.desc_subtitle).toMatch(lang === 'es' ? /movimientos.*habilidades.*objetos/ : /moves.*abilities.*items/);
  });

  it.each(['es', 'en'])('(%s) layout default description has no strategy claims and no meta keywords', async (lang) => {
    const html = await (await AstroContainer.create()).renderToString(Layout, {
      props: { lang },
      request: new Request(`${SITE_URL}/${lang}/`),
      slots: { default: 'x' },
    });
    expect(html).not.toContain('name="keywords"');
    const desc = html.match(/<meta name="description" content="([^"]*)"/)![1];
    expect(desc).toBe(uiTranslations[lang].desc_subtitle);
    expect(html).not.toMatch(/Type Calculator|Weakness Chart|competitive integration/i);
  });
});
