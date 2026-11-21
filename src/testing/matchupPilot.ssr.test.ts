import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import PokemonPage from '../pages/[lang]/pokemon/[name].astro';
import { SITE_URL } from '../utils/seo';
import { uiTranslations } from '../utils/pokemon';

// F6 Experiment 1: the type-matchup block and its title/description appear
// ONLY on the treatment species. Control and every other page must render
// exactly as before. Fully deterministic: fixtures, no network.

// `gate.enabled = false` turns the experiment off for the same fixture, giving
// a same-page BASELINE to diff the treated render against.
const gate = vi.hoisted(() => ({ enabled: true }));
vi.mock('../utils/matchupPilot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/matchupPilot')>();
  return { ...actual, isMatchupTreatment: (slug: string) => gate.enabled && actual.isMatchupTreatment(slug) };
});

const API = 'https://pokeapi.co/api/v2';
const SHOWDOWN = 'https://play.pokemonshowdown.com/data/pokedex.json';

function fixturesFor(slug: string, id: number, types: string[]): Record<string, unknown> {
  const detail = {
    id, name: slug, height: 22, weight: 750,
    species: { name: slug, url: `${API}/pokemon-species/${id}/` },
    types: types.map((t, i) => ({ slot: i + 1, type: { name: t } })),
    stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((s) => ({ base_stat: 80, stat: { name: s } })),
    abilities: [], moves: [],
    sprites: { front_default: 'https://x/y.png', other: { 'official-artwork': { front_default: 'https://x/y.png' } } },
  };
  return {
    [SHOWDOWN]: { [slug]: { tier: 'OU', abilities: { 0: 'Pressure' } } },
    [`${API}/pokemon/${slug}`]: detail,
    [`${API}/pokemon/${id}`]: detail,
    [`${API}/pokemon-species/${id}`]: { name: slug, names: [], flavor_text_entries: [], varieties: [{ is_default: true, pokemon: { name: slug, url: `${API}/pokemon/${id}/` } }] },
    [`${API}/ability?limit=100000`]: { count: 0, next: null, results: [] },
  };
}

let FIXTURES: Record<string, unknown> = {};
let requested: string[] = [];
beforeEach(() => {
  requested = [];
  gate.enabled = true;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input).replace(/\/$/, '');
    requested.push(url);
    const data = FIXTURES[url];
    if (data === undefined) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => data, text: async () => JSON.stringify(data) } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function render(slug: string, lang: string) {
  const html = await (await AstroContainer.create()).renderToString(PokemonPage, {
    params: { lang, name: slug },
    request: new Request(`${SITE_URL}/${lang}/pokemon/${slug}/`),
  });
  // dev-only debugging attributes are not in the production HTML
  return html.replace(/ data-astro-source-(?:file|loc)="[^"]*"/g, '');
}

const SECTION = /\s*<section aria-labelledby="matchups-heading"[\s\S]*?<\/section>/;
const title = (h: string) => h.match(/<title>([^<]*)<\/title>/)![1];
const description = (h: string) => h.match(/<meta name="description" content="([^"]*)"/)![1];
const canonical = (h: string) => h.match(/<link rel="canonical" href="([^"]*)"/)![1];
const alternates = (h: string) => [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]*)"/g)].map((m) => `${m[1]} ${m[2]}`);

describe.each(['es', 'en'])('Pokémon page, treatment species (%s)', (lang) => {
  beforeEach(() => { FIXTURES = fixturesFor('corviknight', 823, ['steel', 'flying']); });

  it('renders the matchup block with a contextual H2, summary, table, type links and the PokeTypes link', async () => {
    const html = await render('corviknight', lang);
    expect(html).toContain('data-matchups');
    expect(html).toContain(uiTranslations[lang].matchups_heading.replace('{name}', 'corviknight'));
    expect(html).toContain(lang === 'es' ? 'recibe daño ×2 de Fuego y Eléctrico' : 'takes ×2 damage from Fire and Electric');
    expect(html).toContain(`href="/${lang}/tipo/fire/"`);
    expect(html).toContain('data-source-surface="pokemon_matchups"');
    expect(html).toContain('www.poketypes.app/?t1=steel&#38;t2=flying'.replace('&#38;', '&'));
    // the page's other sections are all still there
    expect(html).toContain(uiTranslations[lang].training);
    expect(html).toContain(uiTranslations[lang].base_stats);
  });

  it('has facts-first title and description, within limits', async () => {
    const html = await render('corviknight', lang);
    expect(title(html)).toBe(lang === 'es'
      ? 'corviknight: Debilidades, Stats y Movimientos | Pokepedia.app'
      : 'corviknight Weaknesses, Stats &amp; Moves | Pokepedia.app');
    const d = description(html).replace(/&#39;/g, "'");
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toContain(lang === 'es' ? 'débil a Fuego y Eléctrico (×2)' : 'weak to Fire and Electric (×2)');
    expect(d).toContain('(480)');
  });

  it('adds no PokeAPI (or any other) request: the exact same requests with the experiment off', async () => {
    await render('corviknight', lang);
    const treated = [...requested].sort();
    requested = [];
    gate.enabled = false;
    await render('corviknight', lang);
    expect(treated).toEqual([...requested].sort());
    expect(treated.length).toBeGreaterThan(0);
  });

  it('changes nothing else: removing the block leaves a page that differs from the baseline only in title/description tags', async () => {
    const treated = await render('corviknight', lang);
    gate.enabled = false;
    const baseline = await render('corviknight', lang);

    expect(treated).toMatch(SECTION);
    expect(baseline).not.toMatch(SECTION);

    // Whitespace between tags is not content: removing the block leaves a different run of it.
    const squash = (h: string) => h.replace(/>\s+</g, '><');
    const a = squash(treated.replace(SECTION, '')).split(/(?=<)/);
    const b = squash(baseline).split(/(?=<)/);
    expect(a.length).toBe(b.length);
    const allowed = /^<(title|meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description|og:image:alt|twitter:image:alt)")/;
    const differing = a.map((tok, i) => [tok, b[i]]).filter(([x, y]) => x !== y);
    for (const [x, y] of differing) {
      expect(`${x}`.match(allowed) ?? `${y}`.match(allowed), `unexpected difference:\n  treated : ${x.slice(0, 160)}\n  baseline: ${y.slice(0, 160)}`).toBeTruthy();
    }
    expect(differing.length).toBeGreaterThan(0);

    // canonical and hreflang are untouched
    expect(canonical(treated)).toBe(canonical(baseline));
    expect(alternates(treated)).toEqual(alternates(baseline));
    expect(canonical(treated)).toBe(`${SITE_URL}/${lang}/pokemon/corviknight/`);
    expect(treated).not.toMatch(/<meta name="robots"/);
  });

  it('keeps the HTML increase small: bounded raw and gzip size', async () => {
    const treated = await render('corviknight', lang);
    gate.enabled = false;
    const baseline = await render('corviknight', lang);
    const raw = Buffer.byteLength(treated) - Buffer.byteLength(baseline);
    const gz = gzipSync(treated).length - gzipSync(baseline).length;
    expect(raw, `raw +${raw} B`).toBeGreaterThan(0);
    expect(raw, `raw +${raw} B`).toBeLessThan(8 * 1024);
    expect(gz, `gzip +${gz} B`).toBeLessThan(3 * 1024);
  });

  it('renders the block before the training section and after the base stats, with a single H1', async () => {
    const html = await render('corviknight', lang);
    const iStats = html.indexOf(uiTranslations[lang].base_stats);
    const iBlock = html.indexOf('data-matchups');
    const iTraining = html.indexOf(`>${uiTranslations[lang].training}<`);
    expect(iStats).toBeGreaterThan(-1);
    expect(iBlock).toBeGreaterThan(iStats);
    expect(iTraining).toBeGreaterThan(iBlock);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});

describe.each(['es', 'en'])('Pokémon page, control and untouched species (%s) do not change', (lang) => {
  const CASES: [string, number, string[]][] = [
    ['archaludon', 1018, ['steel', 'dragon']], // control
    ['gardevoir', 282, ['psychic', 'fairy']], // control
    ['garchomp', 445, ['dragon', 'ground']], // not in the pilot at all
  ];

  it.each(CASES)('%s: no matchup block and the legacy title/description', async (slug, id, types) => {
    FIXTURES = fixturesFor(slug, id, types);
    const html = await render(slug, lang);
    expect(html).not.toContain('data-matchups');
    expect(html).not.toContain('matchups-heading');
    expect(html).not.toContain('pokemon_matchups');
    // The fixtures carry no localized names, so the page falls back to the slug (CSS capitalizes it).
    const name = slug;
    expect(title(html)).toBe(lang === 'es'
      ? `${name}: Stats, Movimientos y Habilidades | Pokepedia.app`
      : `${name}: Stats, Moves &amp; Abilities | Pokepedia.app`);
    expect(description(html)).toBe(lang === 'es'
      ? `Ficha de ${name}: tipos, estadísticas base (480), habilidades, evolución y movimientos que aprende.`
      : `${name} profile: types, base stats (480), abilities, evolution and the moves it learns.`);
  });

  it.each(CASES)('%s: byte-identical with the experiment on and off', async (slug, id, types) => {
    FIXTURES = fixturesFor(slug, id, types);
    const on = await render(slug, lang);
    gate.enabled = false;
    const off = await render(slug, lang);
    expect(on).toBe(off);
  });
});
