// src/utils/moveFlags.ts
//
// A curated, factual subset of Showdown's move `flags` (verified live
// 2026-09-28 against Showdown's own moves.json, 954 moves, 37 distinct
// flag names total). PokeAPI does not expose move flags at all (`move.meta`
// has no such field, verified against Earthquake) — Showdown is the only
// source already used by this project that has them.
//
// Only flags a factual encyclopedia entry would state as a property of the
// move itself are kept — contact, protect (blocked by Protect), sound,
// powder, punch, bite, pulse, bullet, dance, slicing, wind. Deliberately
// excluded: mechanic-interaction flags that only matter to someone
// building a team/strategy (mirror, metronome, snatch, futuremove, charge,
// recharge, heal, gravity, minimize, distance, reflectable, bypasssub,
// defrost, cantusetwice, mustpressure, nonsky, pledgecombo, allyanim, and
// the fail-* copy-move-interaction flags) — keeping the move page factual,
// not a competitive-analysis surface.
//
// Order is arbitrary but fixed: it is the shared index table
// scripts/generate-catalogs.ts's move-flags builder encodes against and
// this module's own `moveFlagByIndex` decodes with. Treat it as
// append-only.
export const MOVE_FLAG_ORDER = [
  'contact',
  'protect',
  'sound',
  'powder',
  'punch',
  'bite',
  'pulse',
  'bullet',
  'dance',
  'slicing',
  'wind',
] as const;

export type MoveFlag = (typeof MOVE_FLAG_ORDER)[number];

const LABEL_ES: Readonly<Record<MoveFlag, string>> = {
  contact: 'Contacto',
  protect: 'Bloqueable con Protección',
  sound: 'Sonido',
  powder: 'Polvo',
  punch: 'Puño',
  bite: 'Mordisco',
  pulse: 'Pulso',
  bullet: 'Bala',
  dance: 'Danza',
  slicing: 'Corte',
  wind: 'Viento',
};

const LABEL_EN: Readonly<Record<MoveFlag, string>> = {
  contact: 'Contact',
  protect: 'Blocked by Protect',
  sound: 'Sound-based',
  powder: 'Powder',
  punch: 'Punch',
  bite: 'Bite',
  pulse: 'Pulse',
  bullet: 'Bullet',
  dance: 'Dance',
  slicing: 'Slicing',
  wind: 'Wind',
};

/** ES/EN label for a factual move flag; the slug itself for one this module doesn't recognize. */
export function moveFlagLabel(flag: string, lang: string): string {
  const table = lang === 'en' ? LABEL_EN : LABEL_ES;
  return (table as Record<string, string>)[flag] ?? flag;
}

export function moveFlagIndex(flag: string): number {
  return MOVE_FLAG_ORDER.indexOf(flag as MoveFlag);
}

/** '' for an out-of-range index — never throws on corrupted/truncated payload data. */
export function moveFlagByIndex(index: number): string {
  return MOVE_FLAG_ORDER[index] ?? '';
}
