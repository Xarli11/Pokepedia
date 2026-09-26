import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import MovesTable from './MovesTable.astro';
import { expandMoves, type CompactMoves } from '../utils/movesPayload';

// Pokémon MovesTable: SSR rows (crawlable links) + a minimal client payload.

const VERSIONS = ['red-blue', 'gold-silver', 'sword-shield'];
const moves = Array.from({ length: 60 }, (_, i) => ({
  move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i + 1}/` },
  version_group_details: VERSIONS.map((v, vi) => ({
    level_learned_at: (i * (vi + 1)) % 50,
    move_learn_method: { name: i % 3 ? 'level-up' : 'machine' },
    version_group: { name: v },
  })),
}));

async function render(lang = 'es') {
  const html = await (await AstroContainer.create()).renderToString(MovesTable, { props: { moves, lang } });
  const json = html.match(/<script type="application\/json" id="moves-data">([\s\S]*?)<\/script>/)?.[1];
  return { html, json };
}

describe('MovesTable SSR', () => {
  it('keeps a real canonical <a href> per initial-version row', async () => {
    const { html } = await render();
    const tbody = html.match(/<tbody id="movesTableBody"[^>]*>([\s\S]*?)<\/tbody>/)![1];
    const hrefs = [...tbody.matchAll(/<a href="(\/es\/movimientos\/[^"]+\/)"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(60);
    expect(new Set(hrefs).size).toBe(60);
    expect(tbody.match(/<tr/g)).toHaveLength(60);
  });

  it('ships a minimal, script-safe JSON payload (no HTML-escaped legacy rows)', async () => {
    const { html, json } = await render();
    expect(json, 'payload script present').toBeTruthy();
    expect(json).not.toContain('&quot;');
    const payload = JSON.parse(json!) as CompactMoves;
    expect(payload.m).toHaveLength(60); // each move once
    expect(Object.keys(payload.v).sort()).toEqual([...VERSIONS].sort());
    // Nothing derivable is serialized: no names, URLs or labels per entry.
    expect(json).not.toContain('versionLabel');
    expect(json).not.toContain('methodLabel');
    expect(json).not.toContain('https://pokeapi.co');
    // The payload is a small fraction of the visible table.
    expect(json!.length).toBeLessThan(html.length / 4);
  });

  it('the client payload expands to exactly the rows the server rendered (no drift)', async () => {
    const { html, json } = await render('en');
    const payload = JSON.parse(json!) as CompactMoves;
    const initial = 'red-blue';
    const tbody = html.match(/<tbody id="movesTableBody"[^>]*>([\s\S]*?)<\/tbody>/)![1];
    const ssrSlugs = [...tbody.matchAll(/<a href="\/en\/movimientos\/([^"]+)\/"/g)].map((m) => m[1]).sort();
    expect(expandMoves(payload, initial).map((r) => r.slug).sort()).toEqual(ssrSlugs);
    // other version groups are only in the payload, ready for the version switch
    expect(expandMoves(payload, 'sword-shield')).toHaveLength(60);
  });

  it('no per-cell URL attributes: only the anchor carries data-move-url', async () => {
    const { html } = await render();
    expect(html.match(/data-move-url=/g)).toHaveLength(60);
    expect(html).not.toContain('data-move-cat-url');
    expect(html).not.toContain('data-move-desc-url');
    expect(html).not.toContain('data-move-priority-url');
  });
});
