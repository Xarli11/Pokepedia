import { describe, it, expect } from 'vitest';
import { buildPokeTypesUrl, getPoketypesName } from './pokemon';

describe('buildPokeTypesUrl', () => {
  it('builds a single-type deep link with the mapped PokeTypes name', () => {
    const url = buildPokeTypesUrl([{ type: { name: 'electric' } }], 'pikachu');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://www.poketypes.app/');
    expect(parsed.searchParams.get('t1')).toBe('electric');
    expect(parsed.searchParams.get('t2')).toBeNull();
    expect(parsed.searchParams.get('p')).toBe(getPoketypesName('pikachu'));
  });

  it('builds a dual-type deep link', () => {
    const url = buildPokeTypesUrl(
      [{ type: { name: 'grass' } }, { type: { name: 'poison' } }],
      'bulbasaur'
    );
    const parsed = new URL(url);

    expect(parsed.searchParams.get('t1')).toBe('grass');
    expect(parsed.searchParams.get('t2')).toBe('poison');
    expect(parsed.searchParams.get('p')).toBe('bulbasaur');
  });

  it('omits t1/t2 entirely rather than emitting "undefined" when types are missing', () => {
    const url = buildPokeTypesUrl([], 'missingno');
    const parsed = new URL(url);

    expect(parsed.searchParams.has('t1')).toBe(false);
    expect(parsed.searchParams.has('t2')).toBe(false);
    expect(parsed.searchParams.get('p')).toBe('missingno');
  });

  it('applies the PokeTypes name mapping for forms (e.g. deoxys-attack)', () => {
    const url = buildPokeTypesUrl([{ type: { name: 'psychic' } }], 'deoxys-attack');
    expect(new URL(url).searchParams.get('p')).toBe('deoxys-attack');
  });
});
