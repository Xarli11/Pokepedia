import { describe, it, expect } from 'vitest';
import { buildReportIssueUrl } from './reportIssue';

describe('buildReportIssueUrl', () => {
  it('points at the Data issue form with pre-filled context fields', () => {
    const url = buildReportIssueUrl({
      entityType: 'pokemon',
      entitySlug: 'porygon-z',
      lang: 'es',
      pageUrl: 'https://pokepedia.app/es/pokemon/porygon-z/',
    });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://github.com/Xarli11/Pokepedia/issues/new');
    expect(parsed.searchParams.get('template')).toBe('data_issue.yml');
    expect(parsed.searchParams.get('pokepedia_url')).toBe('https://pokepedia.app/es/pokemon/porygon-z/');
    expect(parsed.searchParams.get('entity')).toBe('pokemon/porygon-z');
    expect(parsed.searchParams.get('language')).toBe('es');
    expect(parsed.searchParams.get('title')).toContain('pokemon/porygon-z');
  });

  it('produces a distinct entity string per entity type', () => {
    const itemUrl = new URL(
      buildReportIssueUrl({ entityType: 'item', entitySlug: 'life-orb', lang: 'en', pageUrl: 'https://pokepedia.app/en/objetos/life-orb/' })
    );
    expect(itemUrl.searchParams.get('entity')).toBe('item/life-orb');
  });

  it('never includes free-form user input — only server-known context', () => {
    const url = buildReportIssueUrl({
      entityType: 'ability',
      entitySlug: 'levitate',
      lang: 'en',
      pageUrl: 'https://pokepedia.app/en/habilidades/levitate/',
    });
    const parsed = new URL(url);
    const keys = [...parsed.searchParams.keys()].sort();
    expect(keys).toEqual(['entity', 'language', 'pokepedia_url', 'template', 'title']);
  });
});
