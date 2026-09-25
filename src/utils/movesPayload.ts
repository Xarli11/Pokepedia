// src/utils/movesPayload.ts
//
// The per-version move list of a Pokémon page, in the minimal shape the
// browser needs. MovesTable server-renders the initial version's rows and
// ships the rest (every other version group, for the version switch and the
// filters) as JSON. That JSON used to be the fully processed rows —
// name, slug, url, level, method, methodLabel, version, versionLabel, once
// per (move, version) entry, HTML-escaped inside a <div>: 405 KB of a
// 550 KB Feraligatr page. Everything except (move, level, method) is
// derivable, so only that is sent; names, URLs and labels are rebuilt by
// expandMoves() — the SAME function the server uses for its rows, so the
// SSR table and the client table cannot drift apart.

export interface RawMoveEntry {
    slug: string;
    /** Last path segment of the PokeAPI move URL (numeric id, in practice). */
    ref: string | number;
    level: number;
    method: string;
    version: string;
}

export interface CompactMoves {
    /** Distinct moves: [slug, ref]. */
    m: [string, string | number][];
    /** Distinct learn methods. */
    k: string[];
    /** version group -> [moveIndex, level, methodIndex][] */
    v: Record<string, [number, number, number][]>;
    /** Labels for the methods / versions that appear (page language). */
    l: { m: Record<string, string>; v: Record<string, string> };
}

export interface MoveRowData {
    slug: string;
    name: string;
    url: string;
    level: number;
    method: string;
    methodLabel: string;
    version: string;
    versionLabel: string;
}

const POKEAPI_MOVE = 'https://pokeapi.co/api/v2/move/';

export function formatMoveName(slug: string): string {
    return slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function moveApiUrl(ref: string | number): string {
    return `${POKEAPI_MOVE}${ref}/`;
}

/** Last path segment of a PokeAPI resource URL, numeric when it is. */
export function resourceRef(url: string): string | number {
    const segment = url.split('/').filter(Boolean).pop() ?? '';
    return /^\d+$/.test(segment) ? Number(segment) : segment;
}

export function compactMoves(
    byVersion: Record<string, RawMoveEntry[]>,
    labels: { method: (m: string) => string; version: (v: string) => string }
): CompactMoves {
    const moveIndex = new Map<string, number>();
    const methodIndex = new Map<string, number>();
    const out: CompactMoves = { m: [], k: [], v: {}, l: { m: {}, v: {} } };
    for (const [version, entries] of Object.entries(byVersion)) {
        out.l.v[version] = labels.version(version);
        out.v[version] = entries.map((e) => {
            let mi = moveIndex.get(e.slug);
            if (mi === undefined) {
                mi = out.m.push([e.slug, e.ref]) - 1;
                moveIndex.set(e.slug, mi);
            }
            let ki = methodIndex.get(e.method);
            if (ki === undefined) {
                ki = out.k.push(e.method) - 1;
                methodIndex.set(e.method, ki);
                out.l.m[e.method] = labels.method(e.method);
            }
            return [mi, e.level, ki];
        });
    }
    return out;
}

export function expandMoves(c: CompactMoves, version: string): MoveRowData[] {
    return (c.v[version] || []).map(([mi, level, ki]) => {
        const [slug, ref] = c.m[mi];
        const method = c.k[ki];
        return {
            slug,
            name: formatMoveName(slug),
            url: moveApiUrl(ref),
            level,
            method,
            methodLabel: c.l.m[method] ?? method,
            version,
            versionLabel: c.l.v[version] ?? version,
        };
    });
}

/**
 * JSON for an inline <script type="application/json">: no HTML entity
 * escaping needed, only the sequences that could end the element.
 */
export function jsonForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
