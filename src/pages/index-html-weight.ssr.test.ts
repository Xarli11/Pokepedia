import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { SITE_URL } from '../utils/seo';

// Phase 5: the two huge index pages keep ONE real <a href> per entity in the
// initial HTML, and carry no per-row payload beyond what those links need.
// (Measured before: /objetos/ ~2.5 KB and /movimientos/ ~1.4 KB per entity.)

const API = 'https://pokeapi.co/api/v2';
const N_ITEMS = 300;
const N_MOVES = 200;
const list = (resource: string, n: number) => ({
  count: n,
  next: null,
  results: Array.from({ length: n }, (_, i) => ({ name: `${resource}-number-${i}`, url: `${API}/${resource}/${i + 1}/` })),
});

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      const body = url.includes('/item?') ? list('item', N_ITEMS) : url.includes('/move?') ? list('move', N_MOVES) : undefined;
      if (!body) return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) } as unknown as Response;
      return { ok: true, status: 200, headers: new Headers(), json: async () => body } as unknown as Response;
    })
  );
}

async function render(page: string, lang: string, path: string) {
  vi.resetModules();
  const Page = (await import(/* @vite-ignore */ page)).default;
  const html = await (await AstroContainer.create()).renderToString(Page, { params: { lang }, request: new Request(`${SITE_URL}${path}`) });
  // The test compiler adds dev-only source attributes that production HTML doesn't have.
  return html.replace(/ data-astro-source-(?:file|loc)="[^"]*"/g, '');
}

describe('index pages: crawlable and light (SSR)', () => {
  beforeEach(() => mockFetch());
  afterEach(() => vi.unstubAllGlobals());

  for (const lang of ['es', 'en']) {
    it(`/${lang}/objetos/: one real anchor per item, no per-card payload`, async () => {
      const html = await render('./[lang]/objetos/index.astro', lang, `/${lang}/objetos/`);
      const hrefs = [...html.matchAll(new RegExp(`<a href="(/${lang}/objetos/[a-z0-9-]+/)"`, 'g'))].map((m) => m[1]);
      expect(new Set(hrefs).size).toBe(N_ITEMS);
      expect(hrefs).toHaveLength(N_ITEMS);
      // The redundant per-card data that used to dominate the page:
      expect(html).not.toContain('onerror=');
      expect(html).not.toContain('data-item-url');
      expect(html).not.toContain('data-item-desc-url');
      expect(html).not.toContain('data-item-category-url');
      expect(html).not.toContain('data-super-category');
      expect(html).not.toContain('style="content-visibility');
      expect(html).not.toContain('<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7');
      // Weight per entity (was ~2.5 KB): budget with headroom.
      const grid = html.slice(html.indexOf('id="item-grid"'), html.indexOf('</style>'));
      expect(grid.length / N_ITEMS).toBeLessThan(900);
    });

    it(`/${lang}/movimientos/: one real anchor per move, no per-row payload`, async () => {
      const html = await render('./[lang]/movimientos/index.astro', lang, `/${lang}/movimientos/`);
      const hrefs = [...html.matchAll(new RegExp(`<a href="(/${lang}/movimientos/[a-z0-9-]+/)"`, 'g'))].map((m) => m[1]);
      expect(new Set(hrefs).size).toBe(N_MOVES);
      expect(html).not.toContain('onclick=');
      expect(html).not.toContain('data-url=');
      expect(html).not.toMatch(/data-move-(name|type|cat|prio|pow|acc|pp)-url/);
      const body = html.slice(html.indexOf('id="move-table-body"'), html.indexOf('</tbody>'));
      expect(body.length / N_MOVES).toBeLessThan(500);
    });
  }
});
