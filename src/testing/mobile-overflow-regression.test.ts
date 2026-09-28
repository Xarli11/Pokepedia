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
});
