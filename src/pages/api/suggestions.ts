import { getAllPokemonNames } from '../../services/pokeapi';

export async function GET({ url }: { url: URL }) {
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    
    if (query.length < 2) {
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const allPokemon = await getAllPokemonNames();
    const isNumeric = /^\d+$/.test(query) || query.startsWith('#');
    const cleanQuery = query.startsWith('#') ? query.slice(1) : query;

    const matches = allPokemon
        .filter(p => {
            const nameMatch = p.name.toLowerCase().replace(/-/g, ' ').includes(query);
            const idMatch = isNumeric && p.id.toString().includes(cleanQuery);
            return nameMatch || idMatch;
        })
        .sort((a, b) => {
            const aName = a.name.toLowerCase().replace(/-/g, ' ');
            const bName = b.name.toLowerCase().replace(/-/g, ' ');
            
            if (aName === query) return -1;
            if (bName === query) return 1;
            if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
            if (!aName.startsWith(query) && bName.startsWith(query)) return 1;
            
            return (a.id as number) - (b.id as number);
        })
        .slice(0, 10);

    return new Response(JSON.stringify(matches), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
