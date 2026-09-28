import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fase 2F post-review fix: real horizontal overflow at 320-430px viewports,
// traced to (1) a header with too many always-visible buttons, (2) large
// entity H1s with no smaller mobile breakpoint, (3) native <select>s sizing
// to their longest option, and (4) non-wrapping flex heading rows. These are
// source-pattern guards, not a browser layout re-measurement (Vitest has no
// real CSS box model) — they exist so the exact regressions found by manual
// browser testing can't silently come back.

function read(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf-8');
}

describe('mobile overflow regression guards (source patterns)', () => {
  it('Layout.astro: the random-Pokemon and favorites header buttons stay hidden below md (bottom nav is the mobile surface for both)', () => {
    const html = read('../layouts/Layout.astro');
    const randomButton = html.match(/id="random-pokemon-btn"[\s\S]{0,200}?class="([^"]*)"/)?.[1];
    // First `gen=favorites` link in the file is the header one; the mobile
    // bottom-nav duplicate (deliberately always visible there) comes later.
    const favoritesLink = html.match(/href=\{`\$\{pagePath\(lang\)\}\?gen=favorites`\}[\s\S]{0,200}?class="([^"]*)"/)?.[1];
    for (const classAttr of [randomButton, favoritesLink]) {
      expect(classAttr, 'expected to find the button/link and its class attribute').toBeTruthy();
      expect(classAttr).toMatch(/\bhidden\b/);
      expect(classAttr).toMatch(/\bmd:flex\b/);
    }
  });

  it('objetos/[name].astro: the item H1 scales down on mobile and can break long names', () => {
    const html = read('../pages/[lang]/objetos/[name].astro');
    const h1 = html.match(/<h1 class="([^"]*)">\{localizedName\}<\/h1>/)?.[1];
    expect(h1).toBeTruthy();
    expect(h1).toMatch(/text-4xl/);
    expect(h1).toMatch(/\bsm:text-5xl\b/);
    expect(h1).toMatch(/\bbreak-words\b/);
    // never a bare, unscaled text-7xl/text-6xl (the pre-fix bug)
    expect(h1).not.toMatch(/^text-(6|7)xl /);
  });

  it('movimientos/[name].astro: the move H1 scales down on mobile, and the Game Context selects cannot exceed their container', () => {
    const html = read('../pages/[lang]/movimientos/[name].astro');
    const h1 = html.match(/<h1 class="([^"]*)">\{localizedName\}<\/h1>/)?.[1];
    expect(h1).toBeTruthy();
    expect(h1).toMatch(/\bsm:text-5xl\b/);
    expect(h1).toMatch(/\bbreak-words\b/);
    expect(h1).not.toMatch(/^text-(6|7)xl /);

    const selects = [...html.matchAll(/<select[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(selects.length).toBeGreaterThan(0);
    for (const cls of selects) expect(cls).toMatch(/\bmax-w-full\b/);
  });

  it('habilidades/[name].astro: the ability H1 scales down on mobile and can break long names', () => {
    const html = read('../pages/[lang]/habilidades/[name].astro');
    const h1 = html.match(/<h1 class="([^"]*)">\{localizedName\}<\/h1>/)?.[1];
    expect(h1).toBeTruthy();
    expect(h1).toMatch(/\bsm:text-4xl\b/);
    expect(h1).toMatch(/\bbreak-words\b/);
    expect(h1).not.toMatch(/^text-(5|6)xl /);
  });

  it('Breadcrumbs.astro: the trail wraps instead of forcing document width (flex-wrap, no nowrap)', () => {
    const html = read('../components/Breadcrumbs.astro');
    const nav = html.match(/<nav[^>]*class="([^"]*)"/)?.[1];
    expect(nav).toBeTruthy();
    expect(nav).toMatch(/\bflex-wrap\b/);
    expect(nav).not.toMatch(/\bwhitespace-nowrap\b/);
  });

  // Full-audit round (Section 2 of the mobile-audit request): the home hero,
  // the five catalog-hub H1s, the moves index H1, the Pokémon detail page's
  // second (historical-section) H2, and the comparator's narrow stat row —
  // all found overflowing at 320px, all fixed the same way (a real mobile
  // breakpoint under the desktop size, `break-words` where the text is a
  // live entity name, and `min-w-0`/`flex-wrap` on the row containing them).

  it('home (index.astro): the hero H1 scales down on mobile, and its two filter selects cannot exceed their container', () => {
    const html = read('../pages/[lang]/index.astro');
    const h1 = html.match(/<h1 class="([^"]*)">/)?.[1];
    expect(h1).toBeTruthy();
    expect(h1).toMatch(/\bsm:text-5xl\b/);
    expect(h1).toMatch(/\bbreak-words\b/);
    expect(h1).not.toMatch(/^text-(6|7|8)xl /);

    for (const id of ['type-filter', 'sort-order']) {
      const cls = html.match(new RegExp(`id="${id}"[\\s\\S]{0,20}?class="([^"]*)"`))?.[1];
      expect(cls, `expected to find #${id}`).toBeTruthy();
      expect(cls).toMatch(/\bmax-w-full\b/);
    }
  });

  it('catalog hub H1s (generaciones/habilidades/fuentes/objetos/tipos/movimientos) all scale down on mobile', () => {
    const hubs = [
      '../pages/[lang]/generaciones/index.astro',
      '../pages/[lang]/habilidades/index.astro',
      '../pages/[lang]/fuentes/index.astro',
      '../pages/[lang]/objetos/index.astro',
      '../pages/[lang]/tipos/index.astro',
      '../pages/[lang]/movimientos/index.astro',
    ];
    for (const path of hubs) {
      const html = read(path);
      const h1 = html.match(/<h1 class="([^"]*)">/)?.[1];
      expect(h1, `expected an <h1> in ${path}`).toBeTruthy();
      expect(h1, path).toMatch(/\bsm:text-4xl\b/);
      expect(h1, path).not.toMatch(/^text-(5|6)xl /);
    }
  });

  it('objetos/index.astro: the category-filter select cannot exceed its container', () => {
    const html = read('../pages/[lang]/objetos/index.astro');
    const cls = html.match(/id="category-filter"[\s\S]{0,20}?class="([^"]*)"/)?.[1];
    expect(cls).toBeTruthy();
    expect(cls).toMatch(/\bmax-w-full\b/);
  });

  it('pokemon/[name].astro: the historical-section H2 (repeats the entity name) also scales down and can break', () => {
    const html = read('../pages/[lang]/pokemon/[name].astro');
    const h2 = html.match(/<h2 class="([^"]*)">\{localizedName\}<\/h2>/)?.[1];
    expect(h2).toBeTruthy();
    expect(h2).toMatch(/\bsm:text-4xl\b/);
    expect(h2).toMatch(/\bbreak-words\b/);
    expect(h2).not.toMatch(/^text-(5|6)xl /);
  });

  it('comparar/[p1]/[p2].astro: the two-name stat-total row wraps and cannot force the document wider', () => {
    const html = read('../pages/[lang]/comparar/[p1]/[p2].astro');
    const row = html.match(/<div class="(flex flex-wrap justify-between items-center gap-4 mb-10[^"]*)"/)?.[1];
    expect(row, 'expected the base-stats header row').toBeTruthy();
    expect(row).toMatch(/\bflex-wrap\b/);
  });

  it('Layout.astro: the search modal keyboard-shortcut footer is desktop-only (it clipped its own text on mobile)', () => {
    const html = read('../layouts/Layout.astro');
    const footer = html.match(/<div class="([^"]*)">\s*<div class="flex gap-8">/)?.[1];
    expect(footer, 'expected the search modal shortcuts footer').toBeTruthy();
    expect(footer).toMatch(/\bhidden\b/);
    expect(footer).toMatch(/\bsm:flex\b/);
  });
});
