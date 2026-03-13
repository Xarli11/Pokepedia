import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const languages = ['es', 'en'];
  const siteUrl = 'https://pokepedia.app';

  // Obtener datos dinámicos de PokeAPI en paralelo
  const [pokemonRes, movesRes, abilitiesRes, itemsRes] = await Promise.all([
    fetch('https://pokeapi.co/api/v2/pokemon?limit=1025').then(r => r.json()),
    fetch('https://pokeapi.co/api/v2/move?limit=1000').then(r => r.json()),
    fetch('https://pokeapi.co/api/v2/ability?limit=400').then(r => r.json()),
    fetch('https://pokeapi.co/api/v2/item?limit=500').then(r => r.json())
  ]);

  const pokemon = pokemonRes.results;
  const moves = movesRes.results;
  const abilities = abilitiesRes.results;
  const items = itemsRes.results;

  // Páginas estáticas / Índices
  const staticPages = [
    { path: '', priority: '1.0' },
    { path: '/movimientos', priority: '0.9' },
    { path: '/habilidades', priority: '0.9' },
    { path: '/objetos', priority: '0.9' }
  ];

  const generateUrlEntry = (path: string, priority: string = '0.7', changefreq: string = 'weekly') => {
    return languages.map(lang => {
      const otherLang = lang === 'es' ? 'en' : 'es';
      const fullPath = `${lang}${path}`;
      const otherPath = `${otherLang}${path}`;
      
      // Mapear nombres de sección si es necesario (aunque ahora usamos rutas consistentes)
      let translatedPath = path;
      let translatedOtherPath = path;
      
      // Caso especial para movimientos/moves si las rutas fueran diferentes, 
      // pero según src/pages/[lang]/movimientos/, la ruta base es 'movimientos' para ambos
      
      return `
  <url>
    <loc>${siteUrl}/${fullPath}</loc>
    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}/${fullPath}"/>
    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${siteUrl}/${otherPath}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/es${path}"/>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }).join('');
  };

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${staticPages.map(p => generateUrlEntry(p.path, p.priority)).join('')}
  ${pokemon.map((p: any) => generateUrlEntry(`/pokemon/${p.name}`, '0.8')).join('')}
  ${moves.map((m: any) => generateUrlEntry(`/movimientos/${m.name}`, '0.6')).join('')}
  ${abilities.map((a: any) => generateUrlEntry(`/habilidades/${a.name}`, '0.6')).join('')}
  ${items.map((i: any) => generateUrlEntry(`/objetos/${i.name}`, '0.5')).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
};
