import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync } from 'node:fs';
import moves from '../data/generated/moves.es.json';
import abilities from '../data/generated/abilities.es.json';
import items from '../data/generated/items.es.json';
import { SITE_URL } from '../utils/seo';

// Catalog indexes (/movimientos/, /habilidades/, /objetos/): the primary fields
// of every entry are server-rendered from the generated catalogs. Before, they
// started empty / as skeletons and one PokeAPI request per visible row filled
// them in from the browser (937 / 374 / 2222 entries).

const API = 'https://pokeapi.co/api/v2';
const UNKNOWN = 'brand-new-entry'; // in PokeAPI's list, not in the catalog yet
const list = (resource: string, slugs: string[]) => ({
  count: slugs.length, next: null,
  results: slugs.map((name, i) => ({ name, url: `${API}/${resource}/${i + 1}/` })),
});
const slugsOf = (rows: unknown[][]) => rows.map((r) => r[0] as string);

let fetched: string[] = [];
function mockUpstream() {
  fetched = [];
  const bodies: [string, unknown][] = [
    ['/move?', list('move', [...slugsOf(moves.rows), UNKNOWN])],
    ['/ability?', list('ability', [...slugsOf(abilities.rows), UNKNOWN])],
    ['/item?', list('item', [...slugsOf(items.rows), UNKNOWN])],
  ];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    fetched.push(url);
    const hit = bodies.find(([k]) => url.includes(k));
    if (!hit) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' } as unknown as Response;
    return { ok: true, status: 200, headers: new Headers(), json: async () => hit[1], text: async () => JSON.stringify(hit[1]) } as unknown as Response;
  }));
}

async function render(page: string, lang: string, path: string) {
  vi.resetModules();
  const Page = (await import(/* @vite-ignore */ page)).default;
  const html = await (await AstroContainer.create()).renderToString(Page, { params: { lang }, request: new Request(`${SITE_URL}${path}`) });
  // The test compiler adds dev-only source attributes that production HTML doesn't have.
  return html.replace(/ data-astro-source-(?:file|loc)="[^"]*"/g, '');
}

const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));

describe('catalog indexes render their primary data server-side', () => {
  beforeEach(mockUpstream);
  afterEach(() => vi.unstubAllGlobals());

  it('/movimientos/: name, type, category, priority, power, accuracy and PP are in the HTML', async () => {
    const es = await render('../pages/[lang]/movimientos/index.astro', 'es', '/es/movimientos/');
    const row = es.match(/<tr class="move-row" data-name="earthquake"[\s\S]*?<\/tr>/)![0];
    expect(row).toContain('data-type="ground"');
    expect(row).toContain('>Terremoto</a>');
    expect(row).toContain('>Tierra</span>');
    expect(row).toContain('>Físico</span>');
    expect(row).toMatch(/mi-prio[^>]*>0<\/td>/);
    expect(row).toMatch(/mi-pow">100<\/td>/);
    expect(row).toMatch(/mi-acc">100%<\/td>/);
    expect(row).toMatch(/mi-pp">10<\/td>/);
    expect(row).toContain('href="/es/movimientos/earthquake/"');

    const en = await render('../pages/[lang]/movimientos/index.astro', 'en', '/en/movimientos/');
    const enRow = en.match(/<tr class="move-row" data-name="earthquake"[\s\S]*?<\/tr>/)![0];
    expect(enRow).toContain('>Earthquake</a>');
    expect(enRow).toContain('>Ground</span>');
    expect(enRow).toContain('>Physical</span>');

    // status moves have no power / accuracy: an explicit dash, not an empty cell
    const swords = es.match(/<tr class="move-row" data-name="swords-dance"[\s\S]*?<\/tr>/)![0];
    expect(swords).toMatch(/mi-pow">—<\/td>/);
    expect(swords).toMatch(/mi-acc">—<\/td>/);
    // priority is signed and coloured by data attribute
    expect(es.match(/<tr class="move-row" data-name="protect"[\s\S]*?<\/tr>/)![0]).toMatch(/data-p="up">\+4<\/td>/);
  });

  it('/movimientos/: no skeleton, no per-row fetch, an unknown move keeps its link', async () => {
    const html = await render('../pages/[lang]/movimientos/index.astro', 'es', '/es/movimientos/');
    expect(between(html, 'id="move-table-body"', '</tbody>')).not.toContain('animate-pulse');
    expect(fetched.filter((u) => u.includes('/move/'))).toEqual([]);
    expect(html).toContain(`<a href="/es/movimientos/${UNKNOWN}/">Brand New Entry</a>`);
    const hrefs = [...html.matchAll(/<a href="(\/es\/movimientos\/[a-z0-9-]+\/)"/g)].map((m) => m[1]);
    expect(new Set(hrefs).size).toBe(moves.rows.length + 1);
  });

  it('/habilidades/: localized name and description are in the HTML, no skeleton', async () => {
    const es = await render('../pages/[lang]/habilidades/index.astro', 'es', '/es/habilidades/');
    const card = es.match(/<a href="\/es\/habilidades\/rough-skin\/"[\s\S]*?<\/a>/)![0];
    expect(card).toContain('>Piel Tosca</h3>');
    expect(card).toContain('Hiere con su piel áspera');
    expect(between(es, 'id="ability-grid"', '</style>')).not.toContain('animate-pulse');
    expect(es).not.toContain('data-ability-url');
    expect(es).not.toContain('data-ability-desc-url');
    expect(fetched.filter((u) => u.includes('/ability/'))).toEqual([]);
    expect(es).toContain(`href="/es/habilidades/${UNKNOWN}/"`);
    const en = await render('../pages/[lang]/habilidades/index.astro', 'en', '/en/habilidades/');
    expect(en).toMatch(/<a href="\/en\/habilidades\/rough-skin\/"[\s\S]*?>Rough Skin<\/h3>/);
  });

  it('/objetos/: name, category and description are in the HTML; sprite-less items have no <img>', async () => {
    const es = await render('../pages/[lang]/objetos/index.astro', 'es', '/es/objetos/');
    const card = es.match(/<a href="\/es\/objetos\/choice-scarf\/"[\s\S]*?<\/a>/)![0];
    expect(card).toContain('data-c="held-items"');
    expect(card).toContain('>Pañuelo Elección</h3>');
    expect(card).toContain('<span class="oi-cat">');
    expect(card).toContain('Potencia la Velocidad');
    expect(card).toContain('sprites/items/choice-scarf.png');
    expect(between(es, 'id="item-grid"', '</style>')).not.toContain('animate-pulse');
    expect(fetched.filter((u) => u.includes('/item/'))).toEqual([]);

    const noSprite = items.rows.find((r) => !r[4])![0] as string;
    const noSpriteCard = es.match(new RegExp(`<a href="/es/objetos/${noSprite}/"[\\s\\S]*?</a>`))![0];
    expect(noSpriteCard).toContain('oi-noimg');
    expect(noSpriteCard).not.toContain('<img');

    expect(es).toContain(`href="/es/objetos/${UNKNOWN}/"`);
    const en = await render('../pages/[lang]/objetos/index.astro', 'en', '/en/objetos/');
    expect(en.match(/<a href="\/en\/objetos\/choice-scarf\/"[\s\S]*?<\/a>/)![0]).toContain('>Choice Scarf</h3>');
  });

  it('every entry keeps exactly one real anchor (crawlability unchanged)', async () => {
    const html = await render('../pages/[lang]/objetos/index.astro', 'es', '/es/objetos/');
    const hrefs = [...html.matchAll(/<a href="(\/es\/objetos\/[a-z0-9-]+\/)"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(items.rows.length + 1);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('page weight stays bounded with the data included (per entry and total)', async () => {
    const m = await render('../pages/[lang]/movimientos/index.astro', 'es', '/es/movimientos/');
    const a = await render('../pages/[lang]/habilidades/index.astro', 'es', '/es/habilidades/');
    const i = await render('../pages/[lang]/objetos/index.astro', 'es', '/es/objetos/');
    expect(between(m, 'id="move-table-body"', '</tbody>').length / moves.rows.length).toBeLessThan(450);
    expect(between(a, 'id="ability-grid"', '</style>').length / abilities.rows.length).toBeLessThan(700);
    expect(between(i, 'id="item-grid"', '</style>').length / items.rows.length).toBeLessThan(900);
    // measured after: moves 0.39 MB (was 0.30), abilities 0.20 MB (was 0.52), items 0.94 MB (was 0.96)
    expect(m.length).toBeLessThan(450_000);
    expect(a.length).toBeLessThan(260_000);
    expect(i.length).toBeLessThan(1_050_000);
  });
});

describe('the three index pages make no browser requests to PokeAPI', () => {
  it.each(['movimientos', 'habilidades', 'objetos'])('%s/index.astro has no client fetch, observer or skeleton code', (dir) => {
    const src = readFileSync(new URL(`../pages/[lang]/${dir}/index.astro`, import.meta.url), 'utf8');
    expect(src).not.toMatch(/fetchPokeApiJson|pokeapi\.co\/api|IntersectionObserver|animate-pulse/);
  });
});
