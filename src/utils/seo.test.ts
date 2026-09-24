import { describe, it, expect } from 'vitest';
import {
  buildPageTitle,
  stripBrandSuffix,
  canonicalUrl,
  localeAlternates,
  localizedPath,
  pagePath,
  buildTypeLandingTitle,
  buildTypeLandingDescription,
  buildGenerationLandingTitle,
  buildGenerationLandingDescription,
  SITE_URL,
} from './seo';

describe('stripBrandSuffix', () => {
  it('removes a trailing "| Pokepedia" suffix', () => {
    expect(stripBrandSuffix('Charizard: Stats, Weaknesses & Strategy | Pokepedia')).toBe(
      'Charizard: Stats, Weaknesses & Strategy'
    );
  });

  it('removes a trailing "| Pokepedia.app" suffix case-insensitively', () => {
    expect(stripBrandSuffix('Life Orb | Objetos | POKEPEDIA.APP')).toBe('Life Orb | Objetos');
  });

  it('leaves titles without a brand suffix untouched', () => {
    expect(stripBrandSuffix('Earthquake: Power, Effect & Pokémon')).toBe(
      'Earthquake: Power, Effect & Pokémon'
    );
  });
});

describe('buildPageTitle', () => {
  it('appends the brand exactly once to a plain page title', () => {
    expect(buildPageTitle('Charizard: Stats, Weaknesses & Strategy', 'en')).toBe(
      'Charizard: Stats, Weaknesses & Strategy | Pokepedia.app'
    );
  });

  it('never doubles the brand when the input already has a legacy suffix', () => {
    const title = buildPageTitle('Lunala: Stats, Weaknesses & Strategy | Pokepedia', 'en');
    expect(title).toBe('Lunala: Stats, Weaknesses & Strategy | Pokepedia.app');
    expect(title.match(/Pokepedia/gi)?.length).toBe(1);
  });

  it('falls back to a localized default title when none is given', () => {
    expect(buildPageTitle(undefined, 'es')).toBe('La Enciclopedia Pokémon Técnica Definitiva | Pokepedia.app');
    expect(buildPageTitle('', 'en')).toBe('The Ultimate Technical Pokémon Encyclopedia | Pokepedia.app');
  });

  it('defaults to Spanish for an unknown/missing lang', () => {
    expect(buildPageTitle(undefined, 'fr')).toContain('La Enciclopedia Pokémon Técnica Definitiva');
  });
});

describe('pagePath', () => {
  it('builds the language root with a trailing slash', () => {
    expect(pagePath('es')).toBe('/es/');
    expect(pagePath('en')).toBe('/en/');
  });

  it('builds every main family and entity path with a trailing slash', () => {
    expect(pagePath('es', 'pokemon')).toBe('/es/pokemon/');
    expect(pagePath('es', 'pokemon', 'feraligatr')).toBe('/es/pokemon/feraligatr/');
    expect(pagePath('es', 'movimientos')).toBe('/es/movimientos/');
    expect(pagePath('es', 'movimientos', 'surf')).toBe('/es/movimientos/surf/');
    expect(pagePath('es', 'habilidades', 'levitate')).toBe('/es/habilidades/levitate/');
    expect(pagePath('es', 'objetos', 'leftovers')).toBe('/es/objetos/leftovers/');
    expect(pagePath('es', 'tipo', 'water')).toBe('/es/tipo/water/');
    expect(pagePath('es', 'generacion', 2)).toBe('/es/generacion/2/');
    expect(pagePath('en', 'comparar', 'charizard', 'venusaur')).toBe('/en/comparar/charizard/venusaur/');
  });

  it('keeps the requested language as the first segment', () => {
    expect(pagePath('en', 'objetos', 'leftovers').startsWith('/en/')).toBe(true);
    expect(pagePath('es', 'objetos', 'leftovers').startsWith('/es/')).toBe(true);
  });

  it('never produces a double slash, a host or a template placeholder', () => {
    const samples = [
      pagePath('es'),
      pagePath('en', 'pokemon', 'porygon-z'),
      pagePath('es', 'generacion', 9),
      pagePath('en', 'tipos'),
    ];
    for (const path of samples) {
      expect(path).not.toMatch(/\/\//);
      expect(path).not.toContain('www');
      expect(path).not.toContain('http');
      expect(path).not.toContain('${');
      expect(path.endsWith('/')).toBe(true);
    }
  });

  it('throws on an unsupported language instead of emitting a bogus URL', () => {
    expect(() => pagePath('fr', 'pokemon', 'pikachu')).toThrow(/unsupported lang/);
    expect(() => pagePath('${lang}', 'objetos', 'potion')).toThrow(/unsupported lang/);
    expect(() => pagePath('', 'pokemon')).toThrow(/unsupported lang/);
  });

  it('throws on empty or slash-containing segments', () => {
    expect(() => pagePath('es', '')).toThrow(/invalid path segment/);
    expect(() => pagePath('es', 'pokemon', '  ')).toThrow(/invalid path segment/);
    expect(() => pagePath('es', 'pokemon/pikachu')).toThrow(/invalid path segment/);
  });

  it('is deterministic and percent-encodes unsafe characters in a segment', () => {
    expect(pagePath('es', 'pokemon', 'mr-mime')).toBe(pagePath('es', 'pokemon', 'mr-mime'));
    expect(pagePath('es', 'comparar', 'a b', 'c?d')).toBe('/es/comparar/a%20b/c%3Fd/');
  });
});

describe('canonicalUrl', () => {
  it('builds a stable URL with host + trailing slash', () => {
    expect(canonicalUrl('/en/pokemon/charizard')).toBe(`${SITE_URL}/en/pokemon/charizard/`);
  });

  it('strips query params and tracking noise', () => {
    expect(canonicalUrl('/en/pokemon/charizard/?utm_source=twitter&gen=favorites')).toBe(
      `${SITE_URL}/en/pokemon/charizard/`
    );
  });

  it('collapses duplicate slashes', () => {
    expect(canonicalUrl('//es//objetos//life-orb')).toBe(`${SITE_URL}/es/objetos/life-orb/`);
  });

  it('normalizes the bare root path', () => {
    expect(canonicalUrl('/')).toBe(`${SITE_URL}/`);
  });
});

describe('localizedPath', () => {
  it('rewrites only the locale segment, preserving the rest of the path', () => {
    expect(localizedPath('/es/pokemon/charizard/', 'en')).toBe('/en/pokemon/charizard/');
    expect(localizedPath('/en/movimientos/earthquake/', 'es')).toBe('/es/movimientos/earthquake/');
  });

  it('prefixes the locale when the path has none', () => {
    expect(localizedPath('/habilidades/levitate/', 'en')).toBe('/en/habilidades/levitate/');
  });

  it('does not corrupt a slug that happens to contain a lang code substring', () => {
    // "escavalier" starts with "es" but is not the /es/ locale segment.
    expect(localizedPath('/en/pokemon/escavalier/', 'es')).toBe('/es/pokemon/escavalier/');
  });
});

describe('localeAlternates — representative entity pages', () => {
  const cases: Array<[string, string]> = [
    ['/en/pokemon/charizard/', '/es/pokemon/charizard/'],
    ['/es/pokemon/charizard/', '/en/pokemon/charizard/'],
    ['/en/movimientos/earthquake/', '/es/movimientos/earthquake/'],
    ['/en/habilidades/levitate/', '/es/habilidades/levitate/'],
    ['/en/objetos/life-orb/', '/es/objetos/life-orb/'],
    ['/en/movimientos/', '/es/movimientos/'],
  ];

  it.each(cases)('for %s the reciprocal ES/EN alternates are correct', (path, expectedOther) => {
    const alt = localeAlternates(path);
    const isEnInput = path.startsWith('/en/');
    const other = isEnInput ? alt.es : alt.en;
    expect(other).toBe(`${SITE_URL}${expectedOther}`);
  });

  it('always points x-default at the neutral root, never at /es/', () => {
    expect(localeAlternates('/en/pokemon/charizard/').xDefault).toBe(`${SITE_URL}/`);
    expect(localeAlternates('/es/objetos/life-orb/').xDefault).toBe(`${SITE_URL}/`);
  });

  it('is reciprocal: current locale canonical matches the corresponding alternate entry', () => {
    const alt = localeAlternates('/es/pokemon/charizard/');
    expect(alt.es).toBe(canonicalUrl('/es/pokemon/charizard/'));
    expect(alt.en).toBe(canonicalUrl('/en/pokemon/charizard/'));
  });
});

describe('buildTypeLandingTitle / buildTypeLandingDescription', () => {
  it('builds a localized ES title and description with the real count', () => {
    expect(buildTypeLandingTitle('Dragón', 'es')).toBe('Pokémon de tipo Dragón: lista y estadísticas');
    expect(buildTypeLandingDescription('Dragón', 34, 'es')).toContain('34');
    expect(buildTypeLandingDescription('Dragón', 34, 'es')).toContain('Dragón');
  });

  it('builds a localized EN title and description with the real count', () => {
    expect(buildTypeLandingTitle('Dragon', 'en')).toBe('Dragon-type Pokémon: List & Stats');
    expect(buildTypeLandingDescription('Dragon', 34, 'en')).toContain('34');
    expect(buildTypeLandingDescription('Dragon', 34, 'en')).toContain('Dragon-type');
  });
});

describe('buildGenerationLandingTitle / buildGenerationLandingDescription', () => {
  it('builds a localized ES title and description with roman numeral, region and count', () => {
    expect(buildGenerationLandingTitle('I', 'Kanto', 'es')).toBe('Pokémon de Generación I (Kanto)');
    const desc = buildGenerationLandingDescription('I', 'Kanto', 151, 'es');
    expect(desc).toContain('151');
    expect(desc).toContain('Kanto');
  });

  it('builds a localized EN title and description with roman numeral, region and count', () => {
    expect(buildGenerationLandingTitle('I', 'Kanto', 'en')).toBe('Generation I Pokémon (Kanto)');
    const desc = buildGenerationLandingDescription('I', 'Kanto', 151, 'en');
    expect(desc).toContain('151');
    expect(desc).toContain('Kanto');
  });
});
