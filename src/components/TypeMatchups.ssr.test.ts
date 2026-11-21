import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TypeMatchups from './TypeMatchups.astro';
import { matchupSummary } from '../utils/matchupCopy';
import { TYPE_NAMES, matchupsFor, type TypeName } from '../utils/typeMatchups';
import { uiTranslations } from '../utils/pokemon';

// Component-level SSR checks: content, semantics, accessibility, links.
// Pure props, no network.

const POKETYPES = 'https://www.poketypes.app/?t1=steel&t2=flying&p=corviknight';

async function render(opts: { lang: string; name: string; types: TypeName[] }) {
  const matchups = matchupsFor(opts.types)!;
  const summary = matchupSummary(opts.name, opts.types, matchups, opts.lang);
  const container = await AstroContainer.create();
  const html = await container.renderToString(TypeMatchups, {
    props: { name: opts.name, matchups, summary, lang: opts.lang, pokeTypesHref: POKETYPES },
  });
  // `data-astro-source-*` are dev-only debugging attributes: they are not in the
  // production HTML, so neither the assertions nor the size checks count them.
  return html.replace(/ data-astro-source-(?:file|loc)="[^"]*"/g, '');
}

describe.each([
  ['es', 'Corviknight'],
  ['en', 'Corviknight'],
] as const)('TypeMatchups SSR (%s)', (lang, name) => {
  const t = uiTranslations[lang];
  const heading = t.matchups_heading.replace('{name}', name);

  it('renders a contextual H2, the factual summary and no client script', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    expect(html).toMatch(new RegExp(`<h2 id="matchups-heading"[^>]*>${heading}</h2>`));
    expect(html).toContain(`${name} (${lang === 'es' ? 'Acero/Volador' : 'Steel/Flying'})`);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('client:');
  });

  it('renders one row per non-empty multiplier, in order, and never an x1 row', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    const levels = [...html.matchAll(/data-matchup-level="(\w+)"/g)].map((m) => m[1]);
    expect(levels).toEqual(['x2', 'x05', 'x025', 'x0']); // Corviknight has no x4
    expect(html).toContain('×2');
    expect(html).toContain('×½');
    expect(html).toContain('×¼');
    expect(html).toContain('×0');
    expect(html).not.toContain('×4');
    expect(html).not.toContain('×1<'); // the neutral note mentions ×1 only in prose
  });

  it('shows the x4 row when the typing has one (Gyarados)', async () => {
    const html = await render({ lang, name: 'Gyarados', types: ['water', 'flying'] });
    expect([...html.matchAll(/data-matchup-level="(\w+)"/g)].map((m) => m[1])).toEqual(['x4', 'x2', 'x05', 'x0']);
    expect(html).toContain('×4');
  });

  it('links every type to its canonical, trailing-slash /tipo/ page in the page language', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    const slugs = [...html.matchAll(/data-entity-slug="(\w+)"/g)].map((m) => m[1]);
    // Corviknight: 2 + 6 + 2 + 2 attacking types
    expect(slugs).toHaveLength(12);
    for (const slug of slugs) expect(TYPE_NAMES).toContain(slug);
    const hrefs = [...html.matchAll(/<a\s+href="([^"]+)"[^>]*data-entity-type="type"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(12);
    for (const href of hrefs) expect(href).toMatch(new RegExp(`^/${lang}/tipo/[a-z]+/$`));
    expect(html).not.toMatch(/href="\/(es|en)\/tipo\/[a-z]+"/); // never without the trailing slash
    expect(html).toContain('href="/' + lang + '/tipo/fire/"');
  });

  it('states the scope: modern chart, typing only, abilities/items/Tera excluded', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    expect(html).toContain(t.matchups_note);
    expect(html).toContain(t.matchups_neutral);
    expect(t.matchups_note).toMatch(lang === 'es' ? /generación VI/ : /Generation VI/);
    expect(t.matchups_note).toMatch(lang === 'es' ? /habilidades.*objetos.*Teracristalización/ : /abilities.*items.*Terastallization/);
  });

  it('links to PokeTypes in a new tab, safely, tracked as its own surface', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    const link = html.match(/<a\s+href="https:\/\/www\.poketypes\.app\/[^"]*"[^>]*>/)![0];
    expect(link).toContain(`href="${POKETYPES}"`);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain('data-track-event="cross_site_click"');
    expect(link).toContain('data-track-target="poketypes"');
    expect(link).toContain('data-source-surface="pokemon_matchups"');
    expect(html).toContain(t.matchups_poketypes_cta);
  });

  it('is accessible, semantic HTML', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    // Landmark labelled by its own heading, which exists exactly once.
    expect(html).toMatch(/<section aria-labelledby="matchups-heading"/);
    expect(html.match(/id="matchups-heading"/g)).toHaveLength(1);
    // Exactly one heading, and it is an H2 (the page's H1 is the Pokémon name).
    expect(html.match(/<h[1-6]\b/g)).toEqual(['<h2']);
    // A real table: caption, column headers, row headers.
    expect(html).toContain('<table');
    expect(html).toMatch(new RegExp(`<caption class="sr-only"[^>]*>${t.matchups_caption.replace('{name}', name)}</caption>`));
    expect(html.match(/<th scope="col"/g)).toHaveLength(2);
    expect(html.match(/<th scope="row"/g)).toHaveLength(4);
    // Lists of links are real lists.
    expect(html.match(/<ul\b/g)).toHaveLength(4);
    expect(html.match(/<li>/g)).toHaveLength(12);
    // Colour is never the only cue: each row carries a text label as well as the multiplier.
    for (const key of ['x2', 'x05', 'x025', 'x0']) expect(html).toContain(t[`matchups_level_${key}`]);
    // Every link has visible text (no icon-only link).
    for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      expect(m[1].replace(/<[^>]+>/g, '').trim().length).toBeGreaterThan(0);
    }
  });

  it('renders no unresolved placeholder', async () => {
    const html = await render({ lang, name, types: ['steel', 'flying'] });
    expect(html).not.toMatch(/\{name\}|undefined|\[object|NaN/);
  });
});

describe('TypeMatchups SSR: weight', () => {
  it('the block is bounded for the heaviest typing (most links), ES and EN', async () => {
    // Heaviest = the typing with the most attacking types listed.
    let worst: { typing: TypeName[]; n: number } = { typing: ['normal'], n: 0 };
    const all: TypeName[][] = [];
    for (const a of TYPE_NAMES) all.push([a]);
    for (let i = 0; i < 18; i++) for (let j = i + 1; j < 18; j++) all.push([TYPE_NAMES[i], TYPE_NAMES[j]]);
    for (const typing of all) {
      const m = matchupsFor(typing)!;
      const n = m.x4.length + m.x2.length + m.x05.length + m.x025.length + m.x0.length;
      if (n > worst.n) worst = { typing, n };
    }
    for (const lang of ['es', 'en']) {
      const html = await render({ lang, name: 'Nombre', types: worst.typing });
      expect(Buffer.byteLength(html, 'utf8'), `${worst.typing.join('/')} ${lang}`).toBeLessThan(8 * 1024);
    }
  });
});
