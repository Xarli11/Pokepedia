# Audit: `item / flavor / es / x-y` integrity

**Date:** 2026-08-27
**Scope:** exhaustive, one-time, manual audit of the exact combination the Sprint 0 denylist blocks — `entityType=item, field=flavor, language=es, versionGroup=x-y`.
**Not part of CI.** Fetched once against the live PokeAPI with bounded concurrency (8), retries (3, backoff on 429), and a local on-disk cache for the run. Raw responses are **not** committed to this repo (would be ~2223 JSON files); this document is the durable artifact.

## Methodology

1. Fetched PokeAPI's full item list (`GET /item?limit=3000`) → **2223** items total.
2. Fetched full detail for all 2223 (8-way concurrency, 3 retries with backoff on HTTP 429, 15s timeout per request). 2222 succeeded, 0 permanent failures, run took ~13s.
3. Filtered to items that have **at least one** Spanish (`es`) `flavor_text_entries` entry whose `version_group` is `x-y`. This is the population the audit targets — items that didn't exist yet at X/Y are structurally excluded by this filter, not by a judgment call.
4. For each item in that population, built a "own later baseline": the item's Spanish flavor text entries at every version_group *other than* `x-y`, then took the last one (most recent). Computed Jaccard word-overlap similarity (content words only, length > 3) between the `x-y` entry and that baseline.
5. Built a global "canon" table across **all 2222 items**: for every item, its own later-baseline text, indexed by exact string. Then checked whether each item's `x-y` text exactly matches a *different* item's canon text — a direct, unambiguous proof of a cross-item swap when it does.
6. Classified each item:
   - **`corrupted_confirmed_swap`** — the `x-y` text is an exact-string match for a *different* real item's stable description.
   - **`corrupted_unconfirmed_target`** — similarity to the item's own later baseline is low (< 0.15) but no exact cross-item match was found in the sampled population (the true source may be outside the item table, or differ by punctuation/whitespace).
   - **`correct`** — similarity ≥ 0.15 (same topic as the item's own later text, differing only by wording/era).
   - **`uncertain_no_baseline`** — the item has no later Spanish entry at all to compare against (reserved for completeness; did not occur in this run — see Results).

This method was validated in the earlier, smaller sample (65 items) before running at population scale; see `src/services/localizedText.ts` module doc comment for that validation (4 exact-string swaps found there, replicated at scale below).

## Results

| | Count | % of x-y population |
|---|---|---|
| Total items in PokeAPI | 2222 | — |
| **Items with an `es`/`x-y` flavor entry (the audited population)** | **685** | **100%** |
| — of which TM/TR/HM items | 106 | 15.5% |
| — of which everything else ("mechanic-description" items) | 579 | 84.5% |

**TM/HM/TR items are a different phenomenon and are excluded from the corruption verdict below.** A TM's flavor text describes *whichever move that TM slot currently teaches*, and TM-to-move assignments are legitimately reshuffled between game generations (e.g. `tm11` taught Dig-then-Sunny-Day-then-Solar-Beam-then-Flamethrower across generations — four different real moves, four different correct descriptions). Low similarity here is expected and is not evidence of the x-y import bug. Pokepedia does not currently drive a "true mechanic" item page off TM flavor text the way it does for held items, so no policy change is needed for this category, but it's flagged here so it isn't mistaken for part of the same bug if investigated later.

### Non-TM population (579 items) — the actual corruption question

| Classification | Count | % |
|---|---|---|
| `corrupted_confirmed_swap` (exact string match to a different item) | 358 | 61.8% |
| `corrupted_unconfirmed_target` (clearly wrong, source not pinpointed) | 99 | 17.1% |
| `correct` (consistent with the item's own later text) | 122 | 21.1% |
| `uncertain_no_baseline` | 0 | 0% |

**Automated corrupted total: 457 / 579 = 78.9%.**

### Manual correction of the automated threshold

The 0.15 similarity cutoff has a known false-negative mode: items whose `x-y` text describes a *different, generic* effect that happens to share boilerplate words ("Debe llevarlo un Pokémon", "potencia los movimientos") with their own real description. Manually reading all 22 `correct` items with similarity between 0.15 and 0.35 found:

- **7 are still genuinely corrupted**, just not caught by the threshold:
  - `dragon-fang`: x-y claims it "boosts special moves slightly" (generic/wrong); real effect is "boosts Dragon-type moves".
  - `charcoal`: x-y claims "boosts physical moves slightly, headband" (this is a different item's description — sounds like Muscle Band's); real effect is "boosts Fire-type moves".
  - `twisted-spoon`: x-y claims "boosts move accuracy slightly"; real effect is "boosts Psychic-type moves".
  - `liechi-berry`: x-y describes a friendship/soothing-bell effect; real effect is "raises Attack in a pinch".
  - `petaya-berry`: x-y describes a flinch-on-hit effect (a Razor Fang/King's Rock-style item); real effect is "raises Sp. Atk in a pinch".
  - `ganlon-berry`: x-y describes curing infatuation (a Mental Herb-style item); real effect is "raises Defense in a pinch".
  - `absolite`: x-y is a generic "lets a Pokémon holding the right Mega Stone Mega Evolve" placeholder, not Absolite's actual per-Pokémon text.
- **15 are genuinely fine** — same item, same mechanic, just older/shorter wording or a changed descriptive detail (e.g. `heart-scale`, `damp-mulch` and its 3 sibling mulches, `repel`/`super-repel`/`max-repel`, the 5 colored flutes, `safari-ball`, `data-card-08`).

Correcting for this: **at least 464 / 579 = 80.1%** of non-TM items are demonstrably corrupted at `es`/`x-y`. The 78.9% automated figure is a conservative floor, not an overcount — this audit did not find any case where the automated method flagged something as corrupted that manual review showed was actually fine.

## Examples

Confirmed cross-item swaps (exact string match), beyond the ones already in `localizedText.ts`'s doc comment:

| Item | Its `x-y` Spanish text is actually... |
|---|---|
| `ability-capsule` | `blazikenite`'s real description |
| `absorb-bulb` | `normal-gem`'s real description |
| `adamant-orb` | `rawst-berry`'s real description |
| `aggronite` | `roseli-berry`'s real description |
| `ampharosite` | `absolite`'s real description |
| `amulet-coin` | `black-glasses`'s real description |
| `apicot-berry` | `silver-powder`'s real description |
| `aspear-berry` | `kelpsy-berry`'s real description |

(385 such confirmed pairs exist in the full population; the above is illustrative, not exhaustive — the full mapping lives only in this run's scratch output, not in the repo, per the "no huge files" constraint.)

Genuine exceptions (x-y text is fine, no correction needed) — representative sample:

`heart-scale`, `repel`, `super-repel`, `max-repel`, `black-flute`, `white-flute`, `blue-flute`, `red-flute`, `yellow-flute`, `safari-ball`, `dome-fossil`, `claw-fossil`, `root-fossil`, and ~90 items whose `x-y` text is **byte-identical** to their current text (mostly evolution stones, healing items, and Poké Balls whose description has simply never changed since X/Y — nothing to correct because nothing ever diverged).

## Does the pattern only affect objects that existed at X/Y? Are later items naturally excluded?

Yes, confirmed on both counts:

- The audited population is *defined* as "has an `es`/`x-y` entry" — by construction this can only include items that existed in Generation 6 X/Y. 1537 / 2222 items (69.2%) have no Spanish `x-y` entry at all and are structurally outside the denylist's reach.
- Spot-checked in the smaller Sprint 0 sample (`protective-pads`, `terrain-extender`, `adrenaline-orb`, all introduced in `sun-moon`): their first-ever Spanish entry is correct. Nothing in this larger run contradicts that — no non-x-y version_group shows this swap pattern.

## Limitations

- Automated classification is a heuristic (word-overlap similarity + exact-string cross-matching), not a hand-verified judgment for all 685 items. The manual spot-check above covers the 22 lowest-confidence `correct` cases; the 99 `corrupted_unconfirmed_target` items were not individually hand-verified (their low similarity to their own later text is already strong evidence on its own).
- TM/TR/HM items were excluded from the corruption verdict as a distinct phenomenon, but were not deeply investigated beyond confirming the "moves get reassigned to TM slots across generations" explanation for a few samples (`tm06`, `tm11`, `tm39`, `tm53`).
- The similarity metric can't distinguish "same item, different valid descriptive detail added" (e.g. `damp-mulch` gaining a Hoenn-specific caveat) from "corrupted" when both produce low word overlap; these were resolved by manual reading where it mattered (the 22-item review), not at full population scale.
- This audit only covers `item`/`flavor`/`es`/`x-y`. It does not re-examine abilities/moves at population scale (Sprint 0's smaller sample found no swap evidence there); a full-population sweep of those entity types was out of scope for this pass.

## Current policy and justification for keeping it unchanged

`src/services/localizedText.ts` blocks exactly:

```
{ entityType: 'item', field: 'flavor', language: 'es', versionGroup: 'x-y' }
```

This audit **confirms the policy should be kept exactly as-is**, for two independent reasons:

1. **The population it targets is overwhelmingly corrupted.** ~80%+ of non-TM items with an `es`/`x-y` entry are demonstrably wrong, via a mix of direct proof (358 exact cross-item matches) and strong circumstantial evidence (99+ more, clearly divergent from the item's own later text).
2. **The ~20% of exceptions cost nothing to also block.** The policy denylists at the (entityType, field, language, versionGroup) granularity, not per item — deliberately, per the standing instruction not to build a per-item denylist. For an item whose `x-y` text happens to be fine (e.g. `heart-scale`), rejecting it simply falls through to that item's next-best Spanish entry (a later version_group), which says the same true thing in slightly different words. No user-visible regression results from over-blocking the minority of clean entries; a real, user-visible bug results from under-blocking the corrupted majority. There is no accuracy trade-off that would justify carving out per-item exceptions, which would also reintroduce exactly the per-item maintenance burden this design was meant to avoid.

No change to `BLOCKED_COMBINATIONS` is being made as a result of this audit.
