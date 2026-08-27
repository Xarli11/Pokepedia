#!/usr/bin/env tsx
// scripts/data-audit.ts
//
// Maintainable data-integrity audit for entity localized text.
//
// Usage:
//   npm run data:audit                                   -> audits the default curated item sample
//   npm run data:audit -- items                           -> same, explicit
//   npm run data:audit -- items life-orb,leftovers         -> audits just these slugs
//   npm run data:audit -- items --sample=20                -> first 20 items from the curated pool
//   npm run data:audit -- items --lang=en                  -> audit a different requested language
//
// Deliberately bounded: this never scrapes PokeAPI's full item list. It
// only ever fetches slugs you name explicitly, or a slice of the small
// curated CANDIDATE_POOL below (itself hand-picked from the Sprint 0
// investigation, spanning categories/generations). Not wired into CI —
// it hits the live network, which CI runs should not depend on.

import { getItemDetail } from '../src/services/pokeapi';
import { selectItemEffect, selectItemFlavor } from '../src/utils/items';
import { isBlockedCombination } from '../src/services/localizedText';

// Hand-picked during the Sprint 0 investigation: spans held-items, berries,
// poke-balls, medicine, evolution stones, mega stones, plates, and items
// introduced across generations 3-8. Extend deliberately, with evidence,
// not by dumping PokeAPI's full item list here.
const CANDIDATE_POOL = [
  'life-orb', 'choice-specs', 'choice-scarf', 'power-herb', 'light-clay', 'razor-fang',
  'air-balloon', 'eviolite', 'assault-vest', 'heavy-duty-boots',
  'leftovers', 'focus-sash', 'rocky-helmet', 'black-sludge', 'expert-belt', 'weakness-policy',
  'sticky-barb', 'iron-ball', 'shell-bell', 'quick-claw', 'kings-rock', 'muscle-band',
  'oran-berry', 'lum-berry', 'leppa-berry', 'cheri-berry', 'sitrus-berry',
  'poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'premier-ball',
  'fire-stone', 'water-stone', 'thunder-stone', 'moon-stone',
  'venusaurite', 'charizardite-x', 'alakazite', 'blastoisinite',
  'flame-plate', 'toxic-plate', 'meadow-plate',
  'protective-pads', 'terrain-extender', 'adrenaline-orb',
  'throat-spray', 'eject-pack', 'blunder-policy', 'room-service', 'utility-umbrella',
];

interface AuditRow {
  slug: string;
  id: number | null;
  lang: string;
  effectText: string;
  effectLang: string;
  effectFallback: boolean;
  flavorText: string;
  flavorLang: string;
  flavorVersionGroup: string;
  flavorFallback: boolean;
  anomalies: string[];
}

function truncate(s: string, n = 70): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = Object.fromEntries(
    argv
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, v] = a.slice(2).split('=');
        return [k, v ?? true];
      })
  );
  const entityType = positional[0] || 'items';
  const explicitSlugs = positional[1] ? positional[1].split(',').map((s) => s.trim()) : null;
  const sample = flags.sample ? parseInt(String(flags.sample), 10) : null;
  const lang = (flags.lang as string) || 'es';
  return { entityType, explicitSlugs, sample, lang };
}

async function auditItem(slug: string, lang: string): Promise<AuditRow> {
  const anomalies: string[] = [];
  try {
    const data = await getItemDetail(slug);
    const effect = selectItemEffect(data.effect_entries, lang);
    const flavor = selectItemFlavor(data.flavor_text_entries, lang);

    // Detect whether a blocked entry EXISTED for this item/lang (informational —
    // confirms the policy actually had to do something, not a bug in itself).
    const rawFlavorForLang: { version_group?: { name: string } }[] =
      (data.flavor_text_entries || []).filter((e: any) => e.language.name === lang);
    for (const entry of rawFlavorForLang) {
      const vg = entry.version_group?.name;
      if (isBlockedCombination('item', 'flavor', lang, vg)) {
        anomalies.push(`policy_rejected:flavor/${lang}/${vg}`);
      }
    }

    if (!effect) anomalies.push('no_effect_available');
    else if (effect.fallbackUsed) anomalies.push(`effect_fallback:${effect.language}`);

    if (!flavor) anomalies.push('no_reliable_flavor');
    else if (flavor.fallbackUsed) anomalies.push(`flavor_fallback:${flavor.language}`);

    return {
      slug,
      id: data.id,
      lang,
      effectText: effect ? truncate(effect.text) : '(none)',
      effectLang: effect?.language || '-',
      effectFallback: effect?.fallbackUsed ?? false,
      flavorText: flavor ? truncate(flavor.text) : '(none)',
      flavorLang: flavor?.language || '-',
      flavorVersionGroup: flavor?.versionGroup || '-',
      flavorFallback: flavor?.fallbackUsed ?? false,
      anomalies,
    };
  } catch (e: any) {
    return {
      slug,
      id: null,
      lang,
      effectText: '(fetch error)',
      effectLang: '-',
      effectFallback: false,
      flavorText: '(fetch error)',
      flavorLang: '-',
      flavorVersionGroup: '-',
      flavorFallback: false,
      anomalies: [`fetch_error:${e.message}`],
    };
  }
}

async function main() {
  const { entityType, explicitSlugs, sample, lang } = parseArgs(process.argv.slice(2));

  if (entityType !== 'items') {
    console.error(`Unsupported entity type "${entityType}". Only "items" is implemented so far.`);
    console.error('(Sprint 0 found no swap-corruption evidence for abilities/moves — see src/services/localizedText.ts doc comment.)');
    process.exit(1);
  }

  let slugs = explicitSlugs || CANDIDATE_POOL;
  if (sample) slugs = slugs.slice(0, Math.min(sample, CANDIDATE_POOL.length));

  console.log(`Auditing ${slugs.length} item(s) in lang=${lang}...\n`);

  const rows: AuditRow[] = [];
  for (const slug of slugs) {
    rows.push(await auditItem(slug, lang));
  }

  const header = ['slug', 'id', 'effect_lang', 'effect', 'flavor_lang', 'flavor_vg', 'flavor', 'anomalies'];
  console.log(header.join('\t'));
  for (const r of rows) {
    console.log(
      [r.slug, r.id ?? '-', r.effectLang, r.effectText, r.flavorLang, r.flavorVersionGroup, r.flavorText, r.anomalies.join(';') || '-'].join('\t')
    );
  }

  const withAnomalies = rows.filter((r) => r.anomalies.length > 0);
  const rejected = rows.filter((r) => r.anomalies.some((a) => a.startsWith('policy_rejected')));
  const errors = rows.filter((r) => r.anomalies.some((a) => a.startsWith('fetch_error')));

  console.log('\n--- Summary ---');
  console.log(`Total audited:        ${rows.length}`);
  console.log(`With any anomaly:     ${withAnomalies.length}`);
  console.log(`Policy rejected data: ${rejected.length} (the denylist actually intercepted a corrupted entry)`);
  console.log(`Fetch errors:         ${errors.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
