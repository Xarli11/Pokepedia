// src/utils/seo.ts
//
// Single source of truth for page title / canonical / hreflang generation.
// Root cause this exists to fix: pages already embedded "| Pokepedia" in the
// title they passed to Layout.astro, while Layout.astro *also* appended
// "| Pokepedia" unconditionally -> "X | Pokepedia | Pokepedia" in production.

export const SITE_URL = 'https://pokepedia.app';
export const BRAND_NAME = 'Pokepedia.app';

export const SUPPORTED_LANGS = ['es', 'en'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export function isSupportedLang(value: string): value is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(value);
}

const DEFAULT_TITLE: Record<SupportedLang, string> = {
  es: 'La Enciclopedia Pokémon Técnica Definitiva',
  en: 'The Ultimate Technical Pokémon Encyclopedia',
};

// Matches a trailing "| Pokepedia" or "| Pokepedia.app" brand suffix
// (any casing/spacing) so legacy page titles can be normalized instead of
// silently doubled.
const BRAND_SUFFIX_RE = /\s*\|\s*pokepedia(\.app)?\s*$/i;

export function stripBrandSuffix(title: string): string {
  return title.replace(BRAND_SUFFIX_RE, '').trim();
}

/**
 * Builds the final, single-brand page title.
 * Accepts a raw page-specific title (with or without a legacy brand suffix)
 * and returns it with the brand appended exactly once.
 */
export function buildPageTitle(rawTitle: string | undefined | null, lang: string = 'es'): string {
  const safeLang: SupportedLang = isSupportedLang(lang) ? lang : 'es';
  const trimmed = (rawTitle || '').trim();
  const base = trimmed ? stripBrandSuffix(trimmed) : DEFAULT_TITLE[safeLang];
  return `${base} | ${BRAND_NAME}`;
}

function stripQuery(pathname: string): string {
  return pathname.split('?')[0].split('#')[0];
}

function normalizePath(pathname: string): string {
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  path = path.replace(/\/{2,}/g, '/');
  if (!path.endsWith('/')) path += '/';
  return path;
}

/**
 * Returns the given pathname rewritten under a specific locale, preserving
 * everything after the locale segment. Segment-based (not naive substring
 * replace), so it can't accidentally rewrite an unrelated part of the path.
 */
export function localizedPath(pathname: string, lang: SupportedLang): string {
  const path = normalizePath(stripQuery(pathname));
  const segments = path.split('/').filter(Boolean);
  const [first, ...rest] = segments;
  const restSegments = isSupportedLang(first || '') ? rest : segments;
  return normalizePath(`/${lang}${restSegments.length ? '/' + restSegments.join('/') : ''}`);
}

/**
 * Stable canonical URL for a given pathname: fixed host, no query/tracking
 * params, normalized trailing slash. Never derive canonical from Astro.url
 * directly, since that includes arbitrary request query params.
 */
export function canonicalUrl(pathname: string): string {
  return new URL(normalizePath(stripQuery(pathname)), SITE_URL).toString();
}

export interface LocaleAlternates {
  es: string;
  en: string;
  xDefault: string;
}

/**
 * Reciprocal EN/ES alternates for a given pathname, plus x-default.
 * x-default points to the site root ("/"), which is the actual neutral
 * entry point: middleware negotiates the visitor's language there via
 * Accept-Language (see src/middleware.ts). It is intentionally NOT an
 * alias for "/es/" — that would misrepresent an EN-preferring visitor's
 * neutral entry as an already-localized ES page.
 */
export function localeAlternates(pathname: string): LocaleAlternates {
  return {
    es: new URL(localizedPath(pathname, 'es'), SITE_URL).toString(),
    en: new URL(localizedPath(pathname, 'en'), SITE_URL).toString(),
    xDefault: new URL('/', SITE_URL).toString(),
  };
}

/**
 * Deterministic title/description templates for the type & generation
 * acquisition landing pages (Sprint 3). Take already-localized labels
 * (type name, region) so this file stays decoupled from the translation
 * dictionaries in utils/pokemon.ts — pure functions, easy to unit test.
 */
export function buildTypeLandingTitle(typeLabel: string, lang: SupportedLang): string {
  return lang === 'en'
    ? `${typeLabel}-type Pokémon: List & Stats`
    : `Pokémon de tipo ${typeLabel}: lista y estadísticas`;
}

export function buildTypeLandingDescription(typeLabel: string, count: number, lang: SupportedLang): string {
  return lang === 'en'
    ? `Browse all ${count} ${typeLabel}-type Pokémon with base stats, generations and secondary types.`
    : `Consulta los ${count} Pokémon de tipo ${typeLabel} con sus estadísticas base, generación y tipo secundario.`;
}

export function buildGenerationLandingTitle(genRoman: string, region: string, lang: SupportedLang): string {
  return lang === 'en'
    ? `Generation ${genRoman} Pokémon (${region})`
    : `Pokémon de Generación ${genRoman} (${region})`;
}

export function buildGenerationLandingDescription(
  genRoman: string,
  region: string,
  count: number,
  lang: SupportedLang
): string {
  return lang === 'en'
    ? `All ${count} Generation ${genRoman} Pokémon from the ${region} region, with types and base stats.`
    : `Los ${count} Pokémon de la Generación ${genRoman} de la región ${region}, con tipos y estadísticas base.`;
}
